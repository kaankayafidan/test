"""Splice report for cut segments: every cut between two pieces of the raw recording and what the listener hears there.

    python3 -I tools/cut/splices.py <seg> [<seg> ...] [--whisper]

For each splice (data/edl/<seg>.edl.json "edl" pieces, raw seconds): its time in the cut voice, the raw end of the
left piece and the raw start of the right piece, and flags:
  END-VOICED   the raw recording is still voiced right after the left piece ends (a word may be clipped),
  START-VOICED the raw recording is voiced right before the right piece starts (an onset may be clipped, or a
               fragment of the previous word may come along),
  PAUSE x.xx   the silence the listener hears at the splice (trailing + leading silence, after tempo);
               a sentence boundary below ~0.15 s sounds rushed.
"take" splices join different takes (gap > 1 s in the raw), "pause" splices only shorten a pause inside a take.
With --whisper the cut voice is transcribed 2.5 s around each take splice (word@time) to hear what it sounds like.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/work/raw16k.wav"
HOP = 0.01


def load(path, t0=None, t1=None, sr=16000):
    cmd = ["ffmpeg", "-v", "error"]
    if t0 is not None:
        cmd += ["-ss", f"{max(0.0, t0):.3f}", "-t", f"{t1 - max(0.0, t0):.3f}"]
    cmd += ["-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def db_frames(a, sr=16000):
    n = int(sr * HOP)
    k = len(a) // n
    fr = a[: k * n].reshape(k, n)
    return 20 * np.log10(np.sqrt((fr ** 2).mean(axis=1)) + 1e-9)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    whisper = "--whisper" in sys.argv
    raw = load(RAW)
    db = db_frames(raw)
    thr = np.percentile(db, 70) - 9  # about -45 dB: speech is louder, decays, breaths and pauses are quieter
    voiced = db > thr
    model = None
    if whisper:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from pieces import MODEL  # noqa: E402
        from faster_whisper import WhisperModel
        model = WhisperModel(MODEL, device="cpu", compute_type="int8", cpu_threads=4)
    for seg in args:
        e = json.loads((ROOT / f"data/edl/{seg}.edl.json").read_text())
        tempo, pieces = e["tempo"], e["edl"]
        voice = ROOT / f"assets/media/{seg}.voice.wav"
        print(f"== {seg}  tempo {tempo}  {len(pieces)} pieces")
        t = 0.0
        for i in range(len(pieces) - 1):
            (a0, b0), (a1, b1) = pieces[i], pieces[i + 1]
            t += (b0 - a0) / tempo
            kind = "take" if a1 - b0 > 1.0 else "pause"
            ib, ia = int(round(b0 / HOP)), int(round(a1 / HOP))
            end_voiced = bool(voiced[ib : ib + 8].any())  # 80 ms after the left piece ends
            start_voiced = bool(voiced[max(0, ia - 8) : ia].any())  # 80 ms before the right piece starts
            # silence the listener hears: from the last voiced frame of the left piece to its end, plus the
            # start of the right piece to its first voiced frame
            j = ib - 1
            while j > int(a0 / HOP) and not voiced[j]:
                j -= 1
            k = ia
            while k < int(b1 / HOP) and not voiced[k]:
                k += 1
            pause = ((ib - 1 - j) + (k - ia)) * HOP / tempo
            flags = []
            if end_voiced:
                flags.append("END-VOICED")
            if start_voiced:
                flags.append("START-VOICED")
            flags.append(f"PAUSE {pause:.2f}")
            print(f"  {t:7.2f} s  {kind:5s}  raw {b0:.3f} | {a1:.3f}  " + "  ".join(flags))
            if model is not None and kind == "take":
                w0, w1 = max(0.0, t - 2.5), t + 2.5
                a = load(voice, w0, w1)
                segs, _ = model.transcribe(a, language="de", beam_size=5, word_timestamps=True, vad_filter=False,
                                           condition_on_previous_text=False)
                print("           heard: " + " ".join(f"{w.word.strip()}@{w0 + w.start:.2f}" for s in segs for w in s.words))


if __name__ == "__main__":
    main()
