"""Prepare the allowed sound effects (briefing: only pop, whoosh, stamp, lightning; ticks in Ad 2).

Sources are the Pixabay-licensed files bundled with the media-use skill (commercial use, no attribution).
Each effect is trimmed, faded, converted to 48 kHz stereo WAV and levelled so its loudest 400 ms
window sits at -26 LUFS (momentary), i.e. ~12 dB under a -14 LUFS voice. Writes assets/sfx/sfx.json
with the peak offset of every take so the builder can land the peak one frame after the picture.
"""
import json, re, subprocess, sys, wave
from pathlib import Path
import numpy as np

SRC = Path("/home/user/test/.agents/skills/media-use/audio/assets/sfx")
OUT = Path(__file__).resolve().parent.parent / "assets" / "sfx"
OUT.mkdir(parents=True, exist_ok=True)

# name -> list of takes: (source, ffmpeg filter chain)
TAKES = {
    "pop":    [("pop.mp3", "atrim=0:0.5,afade=t=out:st=0.3:d=0.2"),
               ("pop.mp3", "atrim=0:0.5,asetrate=48000*1.12,aresample=48000,afade=t=out:st=0.25:d=0.2")],
    "whoosh": [("whoosh.mp3", "afade=t=out:st=0.4:d=0.17"),
               ("whoosh.mp3", "asetrate=48000*0.9,aresample=48000,afade=t=out:st=0.45:d=0.18")],
    "stamp":  [("impact-bass-1.mp3", "atrim=0:0.7,afade=t=out:st=0.45:d=0.25")],
    "blitz":  [("glitch-1.mp3", "atrim=0:0.45,afade=t=out:st=0.28:d=0.17")],
    "tick":   [("click-soft.mp3", "atrim=0:0.25,afade=t=out:st=0.15:d=0.1")],
}
TARGET_M = -26.0  # momentary max, LUFS

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, check=True)

def momentary_max(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "apad=pad_dur=0.5,ebur128=framelog=info", "-f", "null", "-"], capture_output=True, text=True)
    vals = [float(m) for m in re.findall(r"M:\s*(-?[\d.]+)", r.stderr)]
    vals = [v for v in vals if v > -70]
    return max(vals) if vals else -70.0

def read_wav(path):
    with wave.open(str(path)) as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        a = np.frombuffer(w.readframes(n), dtype=np.int16).reshape(-1, ch).astype(np.float32) / 32768
    return a, sr

out = {}
for name, takes in TAKES.items():
    lst = []
    for i, (src, af) in enumerate(takes):
        dst = OUT / f"{name}-{i + 1}.wav"
        tmp = OUT / f".tmp-{name}-{i}.wav"
        run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(SRC / src), "-af", f"aresample=48000,{af}", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(tmp)])
        gain = TARGET_M - momentary_max(tmp)
        run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(tmp), "-af", f"volume={gain:.2f}dB,alimiter=limit=0.89:level=false", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(dst)])
        tmp.unlink()
        a, sr = read_wav(dst)
        env = np.abs(a).max(axis=1)
        peak = float(np.argmax(env) / sr)
        dur = len(a) / sr
        lst.append({"file": dst.name, "peak": round(peak, 3), "dur": round(dur, 3), "momentary": round(momentary_max(dst), 1)})
    out[name] = {"takes": lst, "vol": 1, "gainDb": 0}
(OUT / "sfx.json").write_text(json.dumps(out, indent=1))
print(json.dumps(out, indent=1))
(OUT / "CREDITS.md").write_text("Sound effects derived from Pixabay files bundled with the HyperFrames media-use skill,\nused under the Pixabay Content License (commercial use allowed, no attribution required).\n")
