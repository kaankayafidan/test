"""Transcribe the raw recording island by island so Whisper cannot skip repeated takes.

    python3 -I tools/cut/chunks.py <raw16k.wav> <edit.json> <out.json>

Silero VAD (bundled with faster-whisper) splits the audio at every pause ≥ 150 ms. Every speech island that
overlaps a piece window in edit.json is transcribed on its own (Whisper large-v3-turbo, word timestamps),
so a word can never stretch over another take. Islands are cached in data/work/chunks/.
Output: {"islands": [[t0, t1], ...], "words": [{text, start, end, prob, island}]}
"""
import json
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pieces import MODEL, load_wav  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data/cache/chunks"


def main():
    wav, edit_path, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    audio, sr = load_wav(wav)
    from faster_whisper.vad import VadOptions, get_speech_timestamps
    from faster_whisper import WhisperModel

    ts = get_speech_timestamps(audio, VadOptions(min_silence_duration_ms=120, speech_pad_ms=40, threshold=0.45, min_speech_duration_ms=120, max_speech_duration_s=7))
    islands = [[t["start"] / sr, t["end"] / sr] for t in ts]
    edit = json.loads(edit_path.read_text())
    wins = [pc["t"] for k, v in edit.items() if not k.startswith("_") for pc in v]
    need = [i for i, (a, b) in enumerate(islands) if any(a < w1 + 0.5 and b > w0 - 0.5 for w0, w1 in wins)]
    print(f"{len(islands)} islands, {len(need)} inside the edit windows, longest {max(b - a for a, b in islands):.1f} s")
    model = WhisperModel(MODEL, device="cpu", compute_type="int8", cpu_threads=4)
    CACHE.mkdir(parents=True, exist_ok=True)
    words = []
    for n, i in enumerate(need):
        a, b = islands[i]
        key = CACHE / f"{a:.3f}_{b:.3f}.json"
        if key.exists():
            ww = json.loads(key.read_text())
        else:
            pad = 0.15
            seg = audio[int(max(0, a - pad) * sr) : int((b + pad) * sr)]
            off = max(0, a - pad)
            segs, _ = model.transcribe(seg, language="de", word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=False,
                                       initial_prompt="Trading, Trades, Stop-Loss, Swing-Trades, Daytrading, Roulette, Casino, Videokurs, „Mehr dazu“, Standbein.")
            ww = []
            for s in segs:
                for w in s.words or []:
                    t = w.word.strip()
                    if not t:
                        continue
                    st, en = round(off + w.start, 3), round(off + w.end, 3)
                    if ww and (re.match(r"^[,.]\d", t) or t.startswith("-")):
                        p = ww.pop()
                        ww.append({"text": p["text"] + t, "start": p["start"], "end": en, "prob": min(p["prob"], round(w.probability, 3))})
                        continue
                    ww.append({"text": t, "start": max(st, a - 0.05), "end": min(en, b + 0.05), "prob": round(w.probability, 3)})
            key.write_text(json.dumps(ww, ensure_ascii=False))
        for w in ww:
            words.append({**w, "island": i})
        if n % 25 == 0:
            print(f"  {n}/{len(need)}", flush=True)
    out.write_text(json.dumps({"islands": islands, "words": words}, ensure_ascii=False))
    print(f"{len(words)} words -> {out}")


if __name__ == "__main__":
    main()
