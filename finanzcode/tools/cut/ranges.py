"""Editorial cut from explicit time ranges of the raw recording (chosen from the island transcript).

    python3 -I tools/cut/ranges.py <raw16k.wav> <ranges.json> <out_dir> [--only seg,seg]

ranges.json: {"<seg>": {"ranges": [[a, b], ...], "text": "what these ranges say (spelling for captions)"}}
Each edge moves to the quietest 10 ms within ±0.08 s; inside a range, every pause longer than 0.42 s is
shortened to 0.22 s (cut in its middle). Writes <out_dir>/<seg>.edl.json with the intended text.
Word timings for captions come later from the cut voice itself (tools/cut/voice_words.py).
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from takes import quietest, rms_frames  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
MAX_PAUSE, KEEP_PAUSE = 0.42, 0.22


def silent_runs(rms, hop, a, b, floor_db):
    i0, i1 = int(a / hop), int(b / hop)
    db = 20 * np.log10(rms[i0:i1] + 1e-9)
    quiet = db < floor_db
    runs, start = [], None
    for k, q in enumerate(quiet):
        if q and start is None:
            start = k
        if (not q or k == len(quiet) - 1) and start is not None:
            end = k if not q else k + 1
            if (end - start) * hop > MAX_PAUSE:
                runs.append(((i0 + start) * hop, (i0 + end) * hop))
            start = None
    return runs


def main():
    args = sys.argv[1:]
    only = args[args.index("--only") + 1].split(",") if "--only" in args else None
    if "--only" in args:
        i = args.index("--only"); del args[i : i + 2]
    wav, spec_path, out = Path(args[0]), Path(args[1]), Path(args[2])
    out.mkdir(parents=True, exist_ok=True)
    rms, hop = rms_frames(wav)
    db_all = 20 * np.log10(rms + 1e-9)
    floor = float(np.percentile(db_all, 10))
    speech = float(np.percentile(db_all, 70))
    thr = floor + 0.35 * (speech - floor)  # quiet enough to count as a pause
    spec = json.loads(spec_path.read_text())
    seg_def = {f"{a['key']}-{'body' if p == 'body' else 'hook' + p}": a for a in json.loads((ROOT / "src/segments.json").read_text())["ads"] for p in ("A", "B", "body")}
    report = ["# Schnitt (Zeitbereiche)\n"]
    for seg, s in spec.items():
        if seg.startswith("_") or (only and seg not in only):
            continue
        edl = []
        for a, b in s["ranges"]:
            a2 = quietest(rms, hop, max(0.0, a - 0.08), a + 0.08)
            b2 = quietest(rms, hop, b - 0.08, b + 0.08)
            pieces = [[a2, b2]]
            for ra, rb in silent_runs(rms, hop, a2 + 0.05, b2 - 0.05, thr):
                s0, e0 = pieces.pop()
                pieces += [[s0, ra + KEEP_PAUSE / 2], [rb - KEEP_PAUSE / 2, e0]]  # keep KEEP_PAUSE of the pause
            edl += [[round(x, 3), round(y, 3)] for x, y in pieces if y - x > 0.05]
        ad = seg_def[seg]
        (out / f"{seg}.edl.json").write_text(json.dumps({"segment": seg, "tempo": ad["tempo"], "edl": edl, "words": [], "text": s["text"]}, ensure_ascii=False, indent=1))
        dur = sum(y - x for x, y in edl)
        report.append(f"## {seg}  ({len(edl)} Stücke, {dur / ad['tempo']:.1f} s nach Tempo {ad['tempo']}×)\n\n{s['text']}\n")
    (out / "edit.md").write_text("\n".join(report) + "\n")
    print("\n".join(report))


if __name__ == "__main__":
    main()
