"""Editorial cut: build the edit list of each segment from hand-picked word ranges of the raw transcript.

    python3 -I tools/cut/edit.py <raw.words.json> <raw16k.wav> <edit_dir> <out_dir> [--only seg,seg]

<edit_dir>/<seg>.json:
    {"ranges": [[i0, i1], ...],          # inclusive word indices into raw.words.json, in playback order
     "drop": [i, ...],                    # words to remove inside the ranges (repeats, slips, ad-libs)
     "text": {"i": "Spelling"}}           # caption spelling override for word i
Fillers (äh, ähm …) are removed automatically, pauses are shortened, every cut point sits in the
quietest 10 ms near the gap, the first cut sits 30 ms before the real voice onset.
Writes <out_dir>/<seg>.edl.json (same format as takes.py) and <out_dir>/edit.md (the edited text).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from takes import FILLERS, PAD, PAUSE_IN, PAUSE_SENT, norm, onset, quietest, rms_frames  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SPELL = {
    "stoploss": "Stop-Loss", "stoplos": "Stop-Loss", "stoplost": "Stop-Loss", "stoplosses": "Stop-Losses",
    "daytrading": "Daytrading", "swingtrades": "Swing-Trades", "pushnachricht": "Push-Nachricht",
    "rachetrade": "Rache-Trade", "rachetrades": "Rache-Trades", "videokurs": "Videokurs",
}


def spelled(text):
    n = norm(text)
    if n in SPELL:
        core = SPELL[n]
        tail = text[len(text.rstrip(".,;:?!")):]
        return core + tail
    return text


def main():
    args = sys.argv[1:]
    only = None
    if "--only" in args:
        i = args.index("--only"); only = args[i + 1].split(","); del args[i : i + 2]
    words = json.loads(Path(args[0]).read_text())["words"]
    rms, hop = rms_frames(Path(args[1]))
    edit_dir, out = Path(args[2]), Path(args[3])
    out.mkdir(parents=True, exist_ok=True)
    seg_def = {f"{a['key']}-{'body' if p == 'body' else 'hook' + p}": a for a in json.loads((ROOT / "src/segments.json").read_text())["ads"] for p in ("A", "B", "body")}
    report = ["# Schnitt (redaktionell)\n"]
    for f in sorted(edit_dir.glob("*.json")):
        seg = f.stem
        if only and seg not in only:
            continue
        spec = json.loads(f.read_text())
        drop = set(spec.get("drop", []))
        text = {int(k): v for k, v in spec.get("text", {}).items()}
        keep = []
        for ri, (i0, i1) in enumerate(spec["ranges"]):
            for j in range(i0, i1 + 1):
                if j in drop or norm(words[j]["text"]) in FILLERS:
                    continue
                keep.append((j, ri))
        # spans: consecutive words of the same range with a short gap play uncut
        spans = []
        for j, ri in keep:
            w = words[j]
            if spans and spans[-1]["ri"] == ri and j == spans[-1]["j1"] + 1 and w["start"] - spans[-1]["end"] <= PAUSE_IN:
                spans[-1]["end"], spans[-1]["j1"] = w["end"], j
            else:
                spans.append({"ri": ri, "start": w["start"], "end": w["end"], "j0": j, "j1": j})
        edl = []
        for k, sp in enumerate(spans):
            a, b = sp["start"], sp["end"]
            prev_end = spans[k - 1]["end"] if k else max(0.0, a - 0.5)
            next_start = spans[k + 1]["start"] if k + 1 < len(spans) else b + 0.5
            ends_sentence = words[sp["j1"]]["text"].rstrip("\"“”")[-1:] in ".?!"
            limit = PAUSE_SENT if ends_sentence else PAUSE_IN
            if k:
                lo = max(a - PAD, prev_end) if spans[k - 1]["j1"] + 1 == sp["j0"] else a - PAD
                cin = quietest(rms, hop, max(0.0, lo), a - 0.02)
            else:
                on = onset(rms, hop, max(0.0, a - 0.35), a + 0.15, first=True)
                cin = max(0.0, (on if on is not None else a) - 0.03)
            if k + 1 < len(spans):
                hi = min(next_start, b + max(PAD, limit / 2)) if sp["j1"] + 1 == spans[k + 1]["j0"] else b + max(PAD, limit / 2)
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
        kw = [{"text": text.get(j, spelled(words[j]["text"])), "start": words[j]["start"], "end": words[j]["end"], "raw": words[j]["text"], "i": j} for j, _ in keep]
        ad = seg_def[seg]
        (out / f"{seg}.edl.json").write_text(json.dumps({"segment": seg, "tempo": ad["tempo"], "edl": merged, "words": kw}, ensure_ascii=False, indent=1))
        dur = sum(b - a for a, b in merged)
        report.append(f"## {seg}  ({len(merged)} Schnitte, {dur / ad['tempo']:.1f} s nach Tempo {ad['tempo']}×)\n\n{' '.join(w['text'] for w in kw)}\n")
    (out / "edit.md").write_text("\n".join(report) + "\n")
    print("\n".join(report))


if __name__ == "__main__":
    main()
