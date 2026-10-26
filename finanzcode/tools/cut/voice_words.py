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
    model = WhisperModel(MODEL, device="cpu", compute_type="int8", cpu_threads=4)
    for e in sorted((ROOT / "data/edl").glob("*.edl.json")):
        seg = e.name.replace(".edl.json", "")
        if only and seg not in only:
            continue
        wav = ROOT / "assets/media" / f"{seg}.voice.wav"
        text = json.loads(e.read_text())["text"].split()
        raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
        a = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
        dur = len(a) / 16000
        segs, _ = model.transcribe(a, language="de", word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=True,
                                   initial_prompt=" ".join(text[:60]))
        heard = [{"text": w.word.strip(), "start": w.start, "end": w.end} for s in segs for w in (s.words or []) if w.word.strip()]
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
        for k in range(1, len(out)):  # monotonic, no overlaps
            out[k]["start"] = max(out[k]["start"], out[k - 1]["start"] + 0.02)
            out[k]["end"] = max(out[k]["end"], out[k]["start"] + 0.05)
        (ROOT / "data/timing" / f"{seg}.words.json").write_text(json.dumps(out, ensure_ascii=False, indent=0))
        print(f"{seg}: {len(mp)}/{len(text)} words matched, heard: {' '.join(h['text'] for h in heard)}", flush=True)


if __name__ == "__main__":
    main()
