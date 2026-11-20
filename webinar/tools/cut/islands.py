"""Transcribe the whole raw recording island by island (so Whisper cannot skip a repeated take).

    python3 -I tools/cut/islands.py <raw16k.wav> [out.json]

Silero VAD splits the audio at every pause; every speech island (≤ 7 s) is transcribed on its own with
word timestamps. Islands are cached in data/cache/islands/, so a re-run only transcribes what is missing.
Writes data/cache/islands.words.json ({"islands": [[t0, t1], ...], "words": [{text, start, end, prob, island}]})
and data/cache/transcript.txt (one line per island: "[t0-t1] text") for choosing the cut.
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pieces import MODEL, load_wav  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data/cache/islands"
PAD = 0.15  # s of context on both sides of an island


def main():
    wav = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "data/cache/islands.words.json"
    audio, sr = load_wav(wav)
    from faster_whisper import WhisperModel
    from faster_whisper.vad import VadOptions, get_speech_timestamps

    ts = get_speech_timestamps(audio, VadOptions(min_silence_duration_ms=120, speech_pad_ms=40, threshold=0.45, min_speech_duration_ms=120, max_speech_duration_s=7))
    islands = [[round(t["start"] / sr, 3), round(t["end"] / sr, 3)] for t in ts]
    print(f"{len(islands)} islands, {sum(b - a for a, b in islands) / 60:.1f} min speech", flush=True)
    model = WhisperModel(MODEL, device="cpu", compute_type="int8", cpu_threads=4)
    CACHE.mkdir(parents=True, exist_ok=True)
    words, lines = [], []
    for i, (a, b) in enumerate(islands):
        f = CACHE / f"{a:.3f}_{b:.3f}.json"
        if f.exists():
            iw = json.loads(f.read_text())
        else:
            c0 = max(0.0, a - PAD)
            seg = audio[int(c0 * sr) : int((b + PAD) * sr)]
            segs, _ = model.transcribe(seg, language="de", beam_size=5, vad_filter=False, condition_on_previous_text=False, word_timestamps=True)
            iw = []
            for s in segs:
                for w in s.words or []:
                    mid = c0 + (w.start + w.end) / 2
                    if a - 0.05 <= mid <= b + 0.05 and w.word.strip():  # drop words that belong to the padding
                        iw.append({"text": w.word.strip(), "start": round(c0 + w.start, 3), "end": round(c0 + w.end, 3), "prob": round(w.probability, 3)})
            f.write_text(json.dumps(iw, ensure_ascii=False))
        for w in iw:
            words.append({**w, "island": i})
        lines.append(f"[{a:8.2f}-{b:8.2f}] " + " ".join(w["text"] for w in iw))
        if i % 25 == 0:
            print(f"{i}/{len(islands)} {lines[-1][:110]}", flush=True)
    out.write_text(json.dumps({"islands": islands, "words": words}, ensure_ascii=False))
    (ROOT / "data/cache/transcript.txt").write_text("\n".join(lines) + "\n")
    print(f"done: {len(words)} words", flush=True)


if __name__ == "__main__":
    main()
