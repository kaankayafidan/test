"""Transcribe a German recording with word timestamps (faster-whisper, local model).

    python3 -I tools/cut/transcribe.py <media> <out.json> [--model DIR]

Writes {"words": [{"text", "start", "end", "prob"}], "duration"}.
Numbers with a sign ("2,7%", "500€") are split into number + "Prozent"/"Euro" so they line up
with the script's spelling.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import os
MODEL = os.environ.get("FC_WHISPER_MODEL", "large-v3-turbo")
PROMPT = (
    "Trading, Swing-Trades, Daytrading, Stop, Rache-Trade, Push-Nachricht, Roulette, Casino, "
    "Videokurs, „Mehr dazu“, Strategie, Indikator, 2,7 Prozent, 60 Tage, 500 Euro."
)


def main():
    args = sys.argv[1:]
    model_dir = MODEL
    if "--model" in args:
        i = args.index("--model")
        model_dir = args[i + 1]
        del args[i : i + 2]
    src, out = Path(args[0]), Path(args[1])
    from faster_whisper import WhisperModel

    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / "a.wav"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", str(wav)], check=True)
        import wave
        import numpy as np
        with wave.open(str(wav)) as wf:
            audio = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        model = WhisperModel(model_dir, device="cpu", compute_type="int8", cpu_threads=4)
        segs, info = model.transcribe(
            audio, language="de", word_timestamps=True, beam_size=5, vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 300}, initial_prompt=PROMPT,
            condition_on_previous_text=False,
        )
        words = []
        for s in segs:
            for w in s.words or []:
                t = w.word.strip()
                if not t:
                    continue
                # whisper splits "2,7" into "2" ",7" and compounds into "Roulette" "-Kessel": glue them back
                if words and (re.match(r"^[,.]\d", t) or t.startswith("-")):
                    prev = words.pop()
                    t = prev["text"] + t
                    w = type("W", (), {"start": prev["start"], "end": w.end, "probability": min(prev["prob"], w.probability)})
                m = re.fullmatch(r"(\d+(?:[.,]\d+)?)\s*(%|€)([.,;:?!]?)", t)
                if m:
                    mid = w.start + (w.end - w.start) * 0.6
                    words.append({"text": m.group(1), "start": round(w.start, 3), "end": round(mid, 3), "prob": round(w.probability, 3)})
                    words.append({"text": ("Prozent" if m.group(2) == "%" else "Euro") + m.group(3), "start": round(mid, 3), "end": round(w.end, 3), "prob": round(w.probability, 3)})
                    continue
                words.append({"text": t, "start": round(w.start, 3), "end": round(w.end, 3), "prob": round(w.probability, 3)})
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"duration": info.duration, "words": words}, ensure_ascii=False, indent=0))
    print(f"{len(words)} words, {info.duration:.1f} s -> {out}")


if __name__ == "__main__":
    main()
