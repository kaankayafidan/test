"""Render the cut voice + camera clip of each segment from the raw Loom recording.

    python3 -I tools/cut/render_seg.py <raw_video> <edl_dir> [--only ad1-hookA,...] [--crop x,y,size] [--no-video]

Per segment (from <edl_dir>/<seg>.edl.json):
  * cuts audio and video at exactly the same points (10 ms fades at every splice),
  * speeds both up by the ad's tempo (1.05×, Ad 3 1.1×; pitch-preserving atempo),
  * voice chain: high-pass 80 Hz, light FFT denoise, compressor ~3:1, loudness -14 LUFS integrated,
    true peak ≤ -1 dBTP (two-pass loudnorm, linear) → assets/media/<seg>.voice.wav (48 kHz stereo),
  * camera: head-and-shoulders square crop (eyes ~40 % from the top, face ~60 % of the circle)
    from face detection, 720×720, 30 fps CFR, keyframe every 15 frames → assets/media/<seg>.cam.mp4,
  * maps the kept words to the new timeline → data/timing/<seg>.words.json,
  * writes data/media/<seg>.json (duration, paths, cut times for the 100→108 % zoom in the circle).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT  # --out-root <dir> writes assets/media, data/timing, data/media there instead (tests)
FPS = 30


def sh(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def probe(path):
    r = sh(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", str(path)])
    d = json.loads(r.stdout)
    v = next((s for s in d["streams"] if s["codec_type"] == "video"), None)
    return d, v


def face_crop(raw, intervals, vw, vh):
    """Median face box over sampled frames → square crop (x, y, size) in source pixels."""
    import cv2

    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    cap = cv2.VideoCapture(str(raw))
    boxes = []
    for a, b in intervals:
        t = a + 0.2
        while t < b and len(boxes) < 400:
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
            ok, frame = cap.read()
            t += 0.7
            if not ok:
                continue
            g = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            sc = 640 / max(g.shape)
            small = cv2.resize(g, None, fx=sc, fy=sc) if sc < 1 else g
            sc = sc if sc < 1 else 1
            f = cascade.detectMultiScale(small, scaleFactor=1.1, minNeighbors=6, minSize=(24, 24))
            if len(f):
                x, y, w, h = max(f, key=lambda r: r[2] * r[3])
                boxes.append((x / sc, y / sc, w / sc, h / sc))
    cap.release()
    if not boxes:
        s = min(vw, vh)
        return (vw - s) // 2, (vh - s) // 2, s, 0
    x, y, w, h = np.median(np.array(boxes), axis=0)
    # haar box ≈ brows to chin. Face (forehead–chin ≈ 1.3 h) fills ~60 % of the circle.
    size = min(vw, vh, int(round(1.3 * h / 0.6)))
    eye_y = y + 0.42 * h
    cx = x + w / 2
    x0 = int(round(min(max(0, cx - size / 2), vw - size)))
    y0 = int(round(min(max(0, eye_y - 0.40 * size), vh - size)))
    return x0, y0, size, len(boxes)


def measure(wav, af=None):
    """Integrated loudness (LUFS) and true peak (dBTP) via ebur128."""
    chain = (af + "," if af else "") + "ebur128=peak=true"
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af", chain, "-f", "null", "-"], capture_output=True, text=True)
    tail = r.stderr[r.stderr.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", tail).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", tail).group(1))
    return i, tp


def shift_trims(graph, ss):
    """Move every atrim/trim window by -ss (the input is opened with -ss)."""
    return re.sub(r"(a?trim=)([\d.]+):([\d.]+)", lambda m: f"{m.group(1)}{float(m.group(2)) - ss:.3f}:{float(m.group(3)) - ss:.3f}", graph)


def render(seg, raw, edl_doc, crop, do_video, vinfo):
    tempo = edl_doc["tempo"]
    edl = edl_doc["edl"]
    media_dir = OUT / "assets/media"
    media_dir.mkdir(parents=True, exist_ok=True)
    work = OUT / "data/work" / seg
    work.mkdir(parents=True, exist_ok=True)
    # 1. cut: one trim per interval, 10 ms fades, concat
    fa, fv, la, lv = [], [], [], []
    # the body's final image holds ~1.2 s after the last word: let Kilian's picture run on that long
    vtail = 1.2 * tempo if seg.endswith("-body") else 0.0
    for i, (a, b) in enumerate(edl):
        d = b - a
        vb = b + vtail if i == len(edl) - 1 else b
        fa.append(f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st={max(0, d - 0.01):.3f}:d=0.01[a{i}]")
        la.append(f"[a{i}]")
        if do_video:
            fv.append(f"[0:v]trim={a:.3f}:{vb:.3f},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={vtail if i == len(edl) - 1 else 0:.3f}[v{i}]")
            lv.append(f"[v{i}]")
    n = len(edl)
    graph_v = (";".join(fv) + ";" + "".join(lv) + f"concat=n={n}:v=1:a=0[vc]") if do_video else ""
    graph_a = ";".join(fa) + ";" + "".join(la) + f"concat=n={n}:v=0:a=1[ac]"
    # every trim decodes from the start of its input: open the input just before the first piece instead
    ss = max(0.0, min(a for a, _ in edl) - 2.0)
    graph_a = shift_trims(graph_a, ss)
    graph_v = shift_trims(graph_v, ss) if do_video else graph_v
    cut_wav = work / "cut.wav"
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{ss:.3f}", "-i", str(raw), "-filter_complex", graph_a + f";[ac]aresample=48000,atempo={tempo}[aout]", "-map", "[aout]", "-ac", "1", "-c:a", "pcm_s24le", str(cut_wav)]
    sh(cmd)
    # 2. voice chain + two-pass loudness
    chain = "highpass=f=80,afftdn=nr=10:nf=-42:tn=1,acompressor=threshold=-21dB:ratio=3:attack=8:release=120:knee=4:makeup=2"
    voice = media_dir / f"{seg}.voice.wav"
    i_in, _ = measure(cut_wav, chain)
    gain = -14.0 - i_in
    for _ in range(3):
        # gain to -14 LUFS, then a peak limiter at -1.6 dBFS (4x oversampled) so the true peak stays ≤ -1 dBTP
        af = f"{chain},volume={gain:.2f}dB,aresample=192000,alimiter=limit=0.832:attack=1:release=50:level=false,aresample=48000"
        sh(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(cut_wav), "-af", af, "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", str(voice)])
        i_out, tp_out = measure(voice)
        if abs(i_out + 14.0) <= 0.15:
            break
        gain += -14.0 - i_out
    m = {"input_i": round(i_in, 1), "output_i": round(i_out, 1), "output_tp": round(tp_out, 1)}
    dur = float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(voice)]).stdout)
    # 3. camera clip
    cam = None
    if do_video:
        x, y, s, found = crop
        cam = media_dir / f"{seg}.cam.mp4"
        out = 360 if s < 360 else min(720, s)  # upscale small Loom bubbles with lanczos, not in the browser
        vf = f"[vc]crop={s}:{s}:{x}:{y},scale={out}:{out}:flags=lanczos,setpts=PTS/{tempo},fps={FPS},format=yuv420p[vo]"
        sh(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{ss:.3f}", "-i", str(raw), "-filter_complex", graph_v + ";" + vf, "-map", "[vo]", "-an",
            "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-g", "15", "-keyint_min", "15", "-sc_threshold", "0", "-t", f"{dur + vtail / tempo:.3f}", str(cam)])
    # 4. timeline mapping of kept words and cut times
    cum, offs = 0.0, []
    for a, b in edl:
        offs.append((a, b, cum))
        cum += b - a
    def to_out(t):
        for a, b, c in offs:
            if t <= b + 1e-6:
                return round((c + max(0.0, t - a)) / tempo, 3)
        return round(cum / tempo, 3)
    words = []
    for w in edl_doc["words"]:
        s0, e0 = to_out(w["start"]), to_out(w["end"])
        if e0 <= s0:
            e0 = s0 + 0.05
        words.append({"text": w["text"], "start": s0, "end": min(e0, dur)})
    (OUT / "data/timing").mkdir(parents=True, exist_ok=True)
    (OUT / "data/timing" / f"{seg}.words.json").write_text(json.dumps(words, ensure_ascii=False, indent=0))
    cuts = [round(c / tempo, 3) for _, _, c in offs[1:]]
    meta = {
        "duration": round(dur, 3),
        "voice": f"assets/media/{seg}.voice.wav",
        "voiceWav": f"assets/media/{seg}.voice.wav",
        "cam": f"assets/media/{seg}.cam.mp4" if cam else None,
        "cuts": cuts,
        "tempo": tempo,
        "crop": {"x": crop[0], "y": crop[1], "size": crop[2], "faces": crop[3]} if do_video else None,
        "loudness_in": m["input_i"], "loudness_out": m["output_i"], "true_peak": m["output_tp"],
    }
    (OUT / "data/media").mkdir(parents=True, exist_ok=True)
    (OUT / "data/media" / f"{seg}.json").write_text(json.dumps(meta, indent=1))
    return meta


def main():
    global OUT
    args = sys.argv[1:]
    only, crop_arg, do_video = None, None, True
    if "--out-root" in args:
        i = args.index("--out-root"); OUT = Path(args[i + 1]); del args[i : i + 2]
    if "--only" in args:
        i = args.index("--only"); only = args[i + 1].split(","); del args[i : i + 2]
    if "--crop" in args:
        i = args.index("--crop"); crop_arg = [int(v) for v in args[i + 1].split(",")]; del args[i : i + 2]
    if "--no-video" in args:
        args.remove("--no-video"); do_video = False
    raw, edl_dir = Path(args[0]), Path(args[1])
    d, v = probe(raw)
    if v is None:
        do_video = False
    vw, vh = (v["width"], v["height"]) if v else (0, 0)
    docs = {p.name.replace(".edl.json", ""): json.loads(p.read_text()) for p in sorted(edl_dir.glob("*.edl.json"))}
    if only:
        docs = {k: x for k, x in docs.items() if k in only}
    # one crop for the whole recording keeps Kilian's framing identical in all ads
    crop = None
    if do_video:
        crop_file = ROOT / "data/edit/crop.json"
        if crop_arg:
            crop = (*crop_arg, -1)
        elif crop_file.exists():
            c = json.loads(crop_file.read_text())
            crop = (c["x"], c["y"], c["size"], -1)
        else:
            ivs = [iv for x in docs.values() for iv in x["edl"]]
            crop = face_crop(raw, ivs[:: max(1, len(ivs) // 60)], vw, vh)
        print(f"crop x={crop[0]} y={crop[1]} size={crop[2]} (faces found in {crop[3]} frames) from {vw}x{vh}")
    for seg, doc in docs.items():
        if not doc["edl"]:
            print(f"{seg}: empty edit list, skipped")
            continue
        m = render(seg, raw, doc, crop, do_video, v)
        print(f"{seg}: {m['duration']:.2f} s, {len(m['cuts'])} cuts, voice {m['loudness_in']} -> {m['loudness_out']} LUFS, peak {m['true_peak']} dBTP")


if __name__ == "__main__":
    main()
