"""Caption words from the cut voice itself: transcribe assets/media/<seg>.voice.wav (no repeats left, so
Whisper cannot skip anything), then give every word of the intended text (data/edl/<seg>.edl.json "text")
the time of the matching spoken word. Unmatched words are interpolated between their neighbours.

    python3 -I tools/cut/voice_words.py [--only seg,seg]

Writes data/timing/<seg>.words.json and prints how many text words were matched.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pieces import MODEL, canon  # noqa: E402
from takes import sim  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


def align(a, b):
    """Needleman-Wunsch over canonical tokens; returns map index_in_a -> index_in_b."""
    n, m = len(a), len(b)
    S = np.zeros((n + 1, m + 1)); B = np.zeros((n + 1, m + 1), dtype=np.int8)
    S[:, 0] = -0.4 * np.arange(n + 1); S[0, :] = -0.4 * np.arange(m + 1); B[1:, 0] = 1; B[0, 1:] = 2
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            s = sim(a[i - 1], b[j - 1])
            d = S[i - 1, j - 1] + (s if s > 0 else -0.6)
            u, l = S[i - 1, j] - 0.4, S[i, j - 1] - 0.4
            S[i, j], B[i, j] = max((d, 0), (u, 1), (l, 2))
    mp, i, j = {}, n, m
    while i > 0 and j > 0:
        if B[i, j] == 0:
            mp[i - 1] = j - 1; i -= 1; j -= 1
        elif B[i, j] == 1:
            i -= 1
        else:
            j -= 1
    return mp


def main():
    args = sys.argv[1:]
    only = args[args.index("--only") + 1].split(",") if "--only" in args else None
    from faster_whisper import WhisperModel
    from faster_whisper.vad import VadOptions, get_speech_timestamps
    model = WhisperModel(MODEL, device="cpu", compute_type="int8", cpu_threads=4)
    fx_path = ROOT / "data/edit/word_fixes.json"
    fixes = {k: v for k, v in json.loads(fx_path.read_text()).items() if not k.startswith("_")} if fx_path.exists() else {}
    for e in sorted((ROOT / "data/edl").glob("*.edl.json")):
        seg = e.name.replace(".edl.json", "")
        if only and seg not in only:
            continue
        wav = ROOT / "assets/media" / f"{seg}.voice.wav"
        text = json.loads(e.read_text())["text"].split()
        raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
        a = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
        dur = len(a) / 16000
        # island by island (VAD, ≤ 7 s): a full-file pass can skip whole sentences, which would leave their captions
        # without real timings; words are kept only where their centre lies inside the island (no doubles at edges)
        ts = get_speech_timestamps(a, VadOptions(min_silence_duration_ms=120, speech_pad_ms=60, threshold=0.4, min_speech_duration_ms=80, max_speech_duration_s=7))
        heard = []
        for t in ts:
            c0 = max(0, t["start"] - 2400)
            segs, _ = model.transcribe(a[c0 : t["end"] + 2400], language="de", word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=False)
            for w in (x for sg in segs for x in (sg.words or [])):
                mid = c0 / 16000 + (w.start + w.end) / 2
                if t["start"] / 16000 <= mid < t["end"] / 16000 and w.word.strip():
                    heard.append({"text": w.word.strip(), "start": c0 / 16000 + w.start, "end": c0 / 16000 + w.end})
        mp = align([canon(t) for t in text], [canon(h["text"]) for h in heard])
        out = []
        for i, t in enumerate(text):
            if i in mp:
                h = heard[mp[i]]
                out.append({"text": t, "start": round(h["start"], 3), "end": round(h["end"], 3)})
            else:
                out.append({"text": t, "start": None, "end": None})
        # spread unmatched runs evenly between their matched neighbours
        i = 0
        while i < len(out):
            if out[i]["start"] is not None:
                i += 1
                continue
            j = i
            while j < len(out) and out[j]["start"] is None:
                j += 1
            t0 = out[i - 1]["end"] if i > 0 else 0.0
            t1 = out[j]["start"] if j < len(out) else dur
            step = max(0.05, (t1 - t0) / (j - i))
            for k in range(j - i):
                out[i + k]["start"], out[i + k]["end"] = round(t0 + k * step, 3), round(t0 + (k + 1) * step, 3)
            i = j
        for k, (a0, b0) in fixes.get(seg, {}).items():  # hand-checked times (data/edit/word_fixes.json)
            for x in out:
                if x["text"] == k:
                    x["start"], x["end"] = a0, b0
        for k in range(1, len(out)):  # monotonic, no overlaps
            out[k]["start"] = max(out[k]["start"], out[k - 1]["start"] + 0.02)
            out[k]["end"] = max(out[k]["end"], out[k]["start"] + 0.05)
        (ROOT / "data/timing" / f"{seg}.words.json").write_text(json.dumps(out, ensure_ascii=False, indent=0))
        print(f"{seg}: {len(mp)}/{len(text)} words matched, heard: {' '.join(h['text'] for h in heard)}", flush=True)


if __name__ == "__main__":
    main()
