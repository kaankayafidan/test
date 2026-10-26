"""Check every cut voice file against the planned text: nothing extra (left-over takes, slips), nothing lost.

    python3 -I tools/cut/verify.py [--only seg,seg]

Transcribes assets/media/<seg>.voice.wav island by island (VAD, ≤ 7 s, so Whisper cannot skip a repeat)
and diffs the words against data/timing/<seg>.words.json. Prints one block per segment with every
insertion (+) and deletion (-); writes data/work/verify.md.
"""
import json
import subprocess
import sys
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pieces import MODEL, canon  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


def main():
    args = sys.argv[1:]
    only = args[args.index("--only") + 1].split(",") if "--only" in args else None
    from faster_whisper import WhisperModel
    from faster_whisper.vad import VadOptions, get_speech_timestamps

    model = WhisperModel(MODEL, device="cpu", compute_type="int8", cpu_threads=4)
    out = ["# Prüfung der Schnitte (neu transkribiert vs. geplant)\n"]
    for wj in sorted((ROOT / "data/timing").glob("*.words.json")):
        seg = wj.name.replace(".words.json", "")
        if only and seg not in only:
            continue
        wav = ROOT / "assets/media" / f"{seg}.voice.wav"
        if not wav.exists():
            continue
        raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
        a = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
        ts = get_speech_timestamps(a, VadOptions(min_silence_duration_ms=120, speech_pad_ms=60, threshold=0.4, min_speech_duration_ms=80, max_speech_duration_s=7))
        heard = []
        for t in ts:
            segs, _ = model.transcribe(a[max(0, t["start"] - 2400) : t["end"] + 2400], language="de", beam_size=5, vad_filter=False, condition_on_previous_text=False)
            heard += " ".join(s.text for s in segs).split()
        plan = [w["text"] for w in json.loads(wj.read_text()) if w["text"]]
        P, H = [canon(x) for x in plan], [canon(x) for x in heard]
        sm = SequenceMatcher(None, P, H, autojunk=False)
        issues = []
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == "equal":
                continue
            if op in ("delete", "replace"):
                issues.append(f"- geplant, nicht gehört: {' '.join(plan[i1:i2])}")
            if op in ("insert", "replace"):
                issues.append(f"+ gehört, nicht geplant: {' '.join(heard[j1:j2])}")
        ratio = sm.ratio()
        out.append(f"## {seg}  (Übereinstimmung {ratio:.0%})\n")
        out.append("gehört: " + " ".join(heard) + "\n")
        out += [f"    {x}" for x in issues] + [""]
        print(f"{seg}: {ratio:.0%}, {len(issues)} Abweichungen", flush=True)
    (ROOT / "data/work/verify.md").write_text("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
