"""Editorial cut from hand-picked pieces of the raw recording (precise per-piece transcription).

    python3 -I tools/cut/pieces.py <raw16k.wav> <edit.json> <out_dir> [--only seg,seg]

edit.json: {"<seg>": [ {"t": [t0, t1], "from": "first words", "to": "last words",
                        "drop": ["phrase", ...]}, ... ], ...}
Each piece's window [t0-0.4, t1+0.4] is transcribed on its own (Whisper large-v3-turbo, word timestamps),
the kept words run from the first occurrence of `from` to the last occurrence of `to` (normalised match),
`drop` phrases and fillers are removed. Cuts: spans of consecutive words with short gaps play uncut, pauses
are shortened, every cut lands in the quietest 10 ms of the gap, the segment starts 30 ms before the voice.
Writes <out_dir>/<seg>.edl.json (format of takes.py) and <out_dir>/edit.md.
"""
import json
import re
import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from takes import FILLERS, PAD, PAUSE_IN, PAUSE_SENT, norm, onset, quietest, rms_frames  # noqa: E402
from edit import spelled  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
import os
MODEL = os.environ.get("FC_WHISPER_MODEL", "large-v3-turbo")  # local dir or faster-whisper model name (downloads once)
CACHE = ROOT / "data/cache/win"
_model = None


def model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel(MODEL, device="cpu", compute_type="int8", cpu_threads=4)
    return _model


def load_wav(path):
    with wave.open(str(path)) as f:
        sr = f.getframerate()
        a = np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return a, sr


CHUNK_WORDS = ROOT / "data/cache/chunks.words.json"
_chunk = None


def window_words(audio, sr, t0, t1):
    # island-by-island transcription (tools/cut/chunks.py) when available: no word can hide a skipped take
    global _chunk
    if CHUNK_WORDS.exists():
        if _chunk is None:
            _chunk = json.loads(CHUNK_WORDS.read_text())["words"]
        return [w for w in _chunk if w["start"] >= t0 - 0.05 and w["start"] < t1]
    key = CACHE / f"{t0:.2f}_{t1:.2f}.json"
    if key.exists():
        return json.loads(key.read_text())
    a = audio[int(t0 * sr) : int(t1 * sr)]
    segs, _ = model().transcribe(a, language="de", word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=False,
                                 initial_prompt="Trading, Trades, Stop-Loss, Swing-Trades, Daytrading, Roulette, Casino, Videokurs, „Mehr dazu“, Standbein.")
    words = []
    for s in segs:
        for w in s.words or []:
            t = w.word.strip()
            if not t:
                continue
            if words and (re.match(r"^[,.]\d", t) or t.startswith("-")):
                p = words.pop()
                words.append({"text": p["text"] + t, "start": p["start"], "end": round(t0 + w.end, 3), "prob": min(p["prob"], round(w.probability, 3))})
                continue
            words.append({"text": t, "start": round(t0 + w.start, 3), "end": round(t0 + w.end, 3), "prob": round(w.probability, 3)})
    CACHE.mkdir(parents=True, exist_ok=True)
    key.write_text(json.dumps(words, ensure_ascii=False))
    return words


NUMW = {"eins": "1", "zwei": "2", "drei": "3", "vier": "4", "fünf": "5", "sechs": "6", "sieben": "7", "acht": "8", "neun": "9", "zehn": "10",
        "dritten": "3", "vierten": "4", "zehnmal": "10mal", "welche": "welcher", "beider": "beide", "klick": "klicke"}


def canon(t):
    n = norm(t)
    return NUMW.get(n, n)


def find(tokens, phrase, start=0, last=False):
    p = [canon(x) for x in phrase.split() if norm(x)]
    hits = [i for i in range(start, len(tokens) - len(p) + 1) if tokens[i : i + len(p)] == p]
    if not hits:
        return None, len(p)
    return (hits[-1] if last else hits[0]), len(p)


def main():
    args = sys.argv[1:]
    only = None
    if "--only" in args:
        i = args.index("--only"); only = args[i + 1].split(","); del args[i : i + 2]
    wav, edit_path, out = Path(args[0]), Path(args[1]), Path(args[2])
    out.mkdir(parents=True, exist_ok=True)
    audio, sr = load_wav(wav)
    rms, hop = rms_frames(wav)
    edit = json.loads(edit_path.read_text())
    seg_def = {f"{a['key']}-{'body' if p == 'body' else 'hook' + p}": a for a in json.loads((ROOT / "src/segments.json").read_text())["ads"] for p in ("A", "B", "body")}
    report = ["# Schnitt (redaktionell)\n"]
    problems = []
    for seg, pieces in edit.items():
        if seg.startswith("_") or (only and seg not in only):
            continue
        keep = []  # (word dict, piece index)
        for pi, pc in enumerate(pieces):
            t0, t1 = pc["t"]
            ww = window_words(audio, sr, max(0.0, t0 - 0.4), t1 + 0.4)
            toks = [canon(w["text"]) for w in ww]
            a, _ = find(toks, pc["from"], last=pc.get("from_last", False)) if pc.get("from") else (0, 0)
            if a is None:
                problems.append(f"{seg} piece {pi}: 'from' not found: {pc['from']!r} in: {' '.join(w['text'] for w in ww)}")
                continue
            if pc.get("to"):
                b, nb = find(toks, pc["to"], a, last=True)
                if b is None:
                    problems.append(f"{seg} piece {pi}: 'to' not found: {pc['to']!r} in: {' '.join(w['text'] for w in ww)}")
                    continue
                b = b + nb - 1
            else:
                b = len(ww) - 1
            dropped = set()
            for ph in pc.get("drop", []):
                d, nd = find(toks, ph, a)
                if d is None or d > b:
                    problems.append(f"{seg} piece {pi}: drop phrase not found: {ph!r}")
                    continue
                dropped.update(range(d, d + nd))
            fixes = {}
            for src_ph, dst_ph in pc.get("fix", []):
                f, nf = find(toks, src_ph, a)
                dst = dst_ph.split()
                if f is None:
                    problems.append(f"{seg} piece {pi}: fix not applied: {src_ph!r}")
                    continue
                if len(dst) == nf:
                    for k in range(nf):
                        fixes[f + k] = dst[k]
                else:  # different word count: whole replacement on the first word, the rest silent in captions
                    fixes[f] = dst_ph
                    for k in range(1, nf):
                        fixes[f + k] = ""
            for j in range(a, b + 1):
                if j in dropped or norm(ww[j]["text"]) in FILLERS:
                    continue
                w = dict(ww[j])
                if j in fixes:
                    w["text"] = fixes[j]
                if w["end"] - w["start"] > 1.0:
                    problems.append(f"{seg} piece {pi}: suspicious word timing {w['text']!r} {w['start']}-{w['end']}")
                if keep and keep[-1][1] == pi and keep[-1][2] == j - 1 and w["start"] - keep[-1][0]["end"] > 0.8:
                    problems.append(f"{seg} piece {pi}: {w['start'] - keep[-1][0]['end']:.1f} s gap before {w['text']!r} (skipped speech?)")
                keep.append((w, pi, j))
        # spans
        spans = []
        for w, pi, j in keep:
            if spans and spans[-1]["pi"] == pi and j == spans[-1]["j"] + 1 and w["start"] - spans[-1]["end"] <= PAUSE_IN:
                spans[-1]["end"], spans[-1]["j"], spans[-1]["last"] = w["end"], j, w
            else:
                spans.append({"pi": pi, "start": w["start"], "end": w["end"], "j0": j, "j": j, "first": w, "last": w})
        edl = []
        for k, sp in enumerate(spans):
            a, b = sp["start"], sp["end"]
            ends_sentence = sp["last"]["text"].rstrip("\"“”")[-1:] in ".?!"
            limit = PAUSE_SENT if ends_sentence else PAUSE_IN
            if k:
                prev = spans[k - 1]
                lo = max(a - PAD, prev["end"]) if (prev["pi"] == sp["pi"] and prev["j"] + 1 == sp["j0"]) else a - PAD
                cin = quietest(rms, hop, max(0.0, lo), a - 0.02)
            else:
                on = onset(rms, hop, max(0.0, a - 0.35), a + 0.15, first=True)
                cin = max(0.0, (on if on is not None else a) - 0.03)
            if k + 1 < len(spans):
                nxt = spans[k + 1]
                hi = min(nxt["start"], b + max(PAD, limit / 2)) if (nxt["pi"] == sp["pi"] and nxt["j0"] == sp["j"] + 1) else b + max(PAD, limit / 2)
                cout = quietest(rms, hop, b + 0.02, hi)
            else:
                off = onset(rms, hop, b - 0.15, b + 0.45, first=False)
                cout = (off if off is not None else b) + 0.12
            edl.append([round(cin, 3), round(cout, 3)])
        merged = []
        for e in edl:
            if merged and abs(e[0] - merged[-1][1]) < 0.03:
                merged[-1][1] = e[1]
            else:
                merged.append(e)
        kw = [{"text": spelled(w["text"]), "start": w["start"], "end": w["end"], "raw": w["text"], "prob": w["prob"]} for w, _, _ in keep]
        ad = seg_def[seg]
        (out / f"{seg}.edl.json").write_text(json.dumps({"segment": seg, "tempo": ad["tempo"], "edl": merged, "words": kw}, ensure_ascii=False, indent=1))
        dur = sum(b - a for a, b in merged)
        low = [w["text"] for w in kw if w["prob"] < 0.5]
        report.append(f"## {seg}  ({len(merged)} Stücke, {dur / ad['tempo']:.1f} s nach Tempo {ad['tempo']}×)\n\n{' '.join(w['text'] for w in kw)}\n" + (f"\n_unsicher erkannt: {', '.join(low)}_\n" if low else ""))
    (out / "edit.md").write_text("\n".join(report) + "\n")
    print("\n".join(report))
    if problems:
        print("\nPROBLEMS:\n" + "\n".join(problems))


if __name__ == "__main__":
    main()
