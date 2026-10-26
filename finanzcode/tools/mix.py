"""Mix the audio of one variant from its mix.json (written by tools/build.mjs).

    python3 -I tools/mix.py build/<variant>/mix.json out.wav

Voice at -14 LUFS (already normalised per segment), music bed ~20 dB under the voice (~-34 LUFS,
not raised in speech pauses, starts at frame 1 without fade-in, fades out over the last 0.5 s),
sound effects ~12 dB under the voice (levelled in assets/sfx), final true-peak limit -1 dBTP.
48 kHz stereo WAV.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MUSIC = ROOT / "assets/music/bed.wav"
MUSIC_LUFS = -34.0


def lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    tail = r.stderr[r.stderr.rfind("Summary:"):]
    return float(re.search(r"I:\s+(-?[\d.]+) LUFS", tail).group(1)), float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", tail).group(1))


def main():
    mix = json.loads(Path(sys.argv[1]).read_text())
    out = Path(sys.argv[2])
    dur = mix["duration"]
    inputs, chains, labels = [], [], []
    k = 0
    for v in mix["voice"]:
        inputs += ["-i", str(ROOT / v["src"])]
        chains.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(round(v['start'] * 1000))}:all=1[x{k}]")
        labels.append(f"[x{k}]"); k += 1
    for s in mix["sfx"]:
        inputs += ["-i", str(ROOT / s["src"])]
        chains.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,volume={s.get('gainDb', 0)}dB,adelay={int(round(s['start'] * 1000))}:all=1[x{k}]")
        labels.append(f"[x{k}]"); k += 1
    if MUSIC.exists():
        m_i, _ = lufs(MUSIC)
        g = MUSIC_LUFS - m_i
        inputs += ["-stream_loop", "-1", "-i", str(MUSIC)]
        chains.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{dur:.3f},volume={g:.2f}dB,afade=t=out:st={max(0, dur - 0.5):.3f}:d=0.5[x{k}]")
        labels.append(f"[x{k}]"); k += 1
    if not labels:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"anullsrc=r=48000:cl=stereo", "-t", f"{dur:.3f}", str(out)], check=True)
        return
    graph = ";".join(chains) + ";" + "".join(labels) + f"amix=inputs={len(labels)}:duration=longest:normalize=0,apad=whole_dur={dur:.3f},atrim=0:{dur:.3f}," \
        "aresample=192000,alimiter=limit=0.84:attack=1:release=50:level=false,aresample=48000[out]"
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *inputs, "-filter_complex", graph, "-map", "[out]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(out)], check=True)
    i, tp = lufs(out)
    print(json.dumps({"out": str(out), "duration": dur, "lufs": i, "true_peak": tp, "music": MUSIC.exists(), "sfx": len(mix["sfx"])}))


if __name__ == "__main__":
    main()
