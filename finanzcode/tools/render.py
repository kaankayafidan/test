"""Render, mix and mux final deliverables.

    python3 -I tools/render.py [--build build] [--out out] [--only NAME,NAME] [--draft]

For every variant in <build>/manifest.json:
  1. HyperFrames render of the picture (H.264 High, 30 fps CFR, ~15 Mbit/s),
  2. tools/mix.py for the sound (voice -14 LUFS, music -20 dB, SFX -12 dB, true peak ≤ -1 dBTP),
  3. mux → <out>/<name>.mp4 with AAC 48 kHz stereo 320 kbit/s, faststart,
  4. verify codec, size, fps, duration and loudness; prints one JSON line per file.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def main():
    a = sys.argv[1:]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    build = ROOT / opt("--build", "build")
    out = ROOT / opt("--out", "out")
    only = opt("--only")
    draft = "--draft" in a
    tmp = out / ".tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((build / "manifest.json").read_text())
    for m in manifest:
        name = m["name"]
        if only and name not in only.split(","):
            continue
        d = build / name
        master = tmp / f"{name}.master.mp4"
        q = ["--quality", "draft"] if draft else ["--crf", "10"]
        r = subprocess.run(["npx", "hyperframes", "render", str(d), *q, "--fps", "30", "--output", str(master), "--quiet"], capture_output=True, text=True, cwd=ROOT)
        if r.returncode != 0 or not master.exists():
            print(json.dumps({"name": name, "error": "render failed", "log": (r.stdout + r.stderr)[-2000:]}))
            continue
        # delivery encode: H.264 High, 30 fps constant, 15 Mbit/s constant bitrate (flat slides alone would
        # only need ~1 Mbit/s; CBR keeps the file at the briefed ~15 Mbit/s)
        vid = tmp / f"{name}.video.mp4"
        if draft:
            vid = master
        else:
            run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(master), "-an",
                 "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-level:v", "4.2", "-pix_fmt", "yuv420p", "-r", "30", "-fps_mode", "cfr",
                 "-b:v", "15M", "-minrate", "15M", "-maxrate", "15M", "-bufsize", "15M", "-g", "60", "-x264-params", "nal-hrd=cbr:force-cfr=1",
                 str(vid)])
        wav = tmp / f"{name}.wav"
        mixinfo = json.loads(run(["python3", "-I", str(ROOT / "tools/mix.py"), str(d / "mix.json"), str(wav)]).stdout.strip().splitlines()[-1])
        final = out / f"{name}.mp4"
        run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(vid), "-i", str(wav), "-map", "0:v:0", "-map", "1:a:0",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", "-t", f"{m['duration']:.3f}", str(final)])
        p = json.loads(run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,profile,width,height,r_frame_rate,avg_frame_rate,bit_rate,sample_rate,channels:format=duration,bit_rate", "-of", "json", str(final)]).stdout)
        v = next(s for s in p["streams"] if s["codec_name"] == "h264")
        au = next(s for s in p["streams"] if s["codec_name"] == "aac")
        r2 = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(final), "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
        tail = r2.stderr[r2.stderr.rfind("Summary:"):]
        info = {
            "name": name, "file": str(final.relative_to(ROOT)), "size_mb": round(final.stat().st_size / 1e6, 1),
            "duration": round(float(p["format"]["duration"]), 2), "expected": m["duration"],
            "video": f"{v['codec_name']} {v.get('profile')} {v['width']}x{v['height']} {v['avg_frame_rate']} {round(int(v.get('bit_rate', 0)) / 1e6, 1)} Mbit/s",
            "audio": f"aac {au['sample_rate']} Hz {au['channels']}ch {round(int(au.get('bit_rate', 0)) / 1e3)} kbit/s",
            "lufs": float(re.search(r"I:\s+(-?[\d.]+) LUFS", tail).group(1)), "true_peak": float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", tail).group(1)),
            "placeholder_timing": m.get("placeholder", False), "music": mixinfo.get("music"),
        }
        print(json.dumps(info, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
