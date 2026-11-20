#!/usr/bin/env python3
"""Derived media for Ad 2 (from the Mixkit stock clips in assets/media/stock). Run: python3 -I assets/img/ad2/_prep.py

Clip A (mixkit-48002, escalator, 30 fps): the right escalator runs up. Loop = source frames 84..377 (2.8 s .. 12.6 s,
  the closest matching frame pair), repeated 3x  -> a2-esc-loop.mp4 (29.4 s), loop time t <-> source 2.8 + (t mod 9.8).
  a2-esc-rev.mp4  = the loop reversed (rev time r <-> loop time 29.4 - r).
  a2-esc-rew8.mp4 = the reversed loop at 8x with 4-frame blend (Rueckspul-Effekt; rew time q <-> loop time 29.4 - 8 q).
  a2-freeze.jpg   = source frame 378 (12.6 s), the still for "das Bild friert 0,3 s ein".
Clip B (mixkit-20061, Tokyo, static camera, 7.04 s): forward + reversed + forward -> a2-tokyo.mp4 (21.1 s).
Clip C (mixkit-22137, glass elevator): only 0..16 s (the second cabin after 16.5 s carries lettering). The small mark
  on the cabin panel is tracked (logo top-left samples below) and filled from its surroundings, the faint lettering on
  the side glass is blurred while the cabin is low (< 3.2 s) -> a2-cab.mp4.
  a2-cab-alt.mp4  = up/down legs of 1.2 s (source 2.4 .. 3.6 s) x6, a2-cab-yoyo.mp4 = legs of 5 s (1.5 .. 6.5 s) x3.
"""
import os, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
STOCK = os.path.join(ROOT, "assets", "media", "stock")
A, B, C = (os.path.join(STOCK, f) for f in ("mixkit-48002.mp4", "mixkit-20061.mp4", "mixkit-22137.mp4"))
OUT = lambda f: os.path.join(HERE, f)
X264 = ["-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-g", "15", "-an", "-movflags", "+faststart"]


def ff(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def clip_a():
    seg = "trim=start_frame=84:end_frame=378,setpts=PTS-STARTPTS"
    ff("-i", A, "-vf", f"{seg},loop=loop=2:size=294:start=0", *X264, OUT("a2-esc-loop.mp4"))
    ff("-i", A, "-vf", f"{seg},reverse,loop=loop=2:size=294:start=0", *X264, OUT("a2-esc-rev.mp4"))
    ff("-i", OUT("a2-esc-rev.mp4"), "-vf", "setpts=PTS/8,tmix=frames=4,fps=30", *X264, OUT("a2-esc-rew8.mp4"))
    ff("-i", A, "-vf", "select=eq(n\\,378)", "-frames:v", "1", "-q:v", "2", OUT("a2-freeze.jpg"))


def clip_b():
    ff("-i", B, "-filter_complex", "[0:v]split=3[a][b][c];[b]reverse[r];[a][r][c]concat=n=3:v=1[v]", "-map", "[v]", *X264, OUT("a2-tokyo.mp4"))


# Clip C: top-left of a 50x60 window around the cabin mark, sampled every 0.25 s (NCC tracking), source px.
TRACK = [(0.00, 664, 316), (1.25, 664, 314), (1.50, 664, 310), (1.75, 664, 303), (2.00, 663, 293), (2.25, 662, 279),
         (2.50, 661, 265), (2.75, 660, 249), (3.00, 659, 236), (3.25, 658, 221), (3.50, 657, 208), (3.75, 656, 193),
         (4.00, 655, 180), (4.25, 654, 166), (4.50, 653, 154), (4.75, 652, 140), (5.00, 651, 128), (5.25, 650, 115),
         (5.50, 649, 103), (5.75, 648, 90), (6.00, 647, 79), (6.25, 646, 67), (6.50, 645, 56), (6.75, 644, 44),
         (7.00, 644, 33), (7.25, 643, 22), (7.50, 642, 12), (7.75, 641, 1)]


def mark_at(t):
    ts = [p[0] for p in TRACK]
    if t >= ts[-1]:  # extrapolate with the last second's speed
        return TRACK[-1][1] - 3 * (t - ts[-1]), TRACK[-1][2] - 43 * (t - ts[-1])
    return float(np.interp(t, ts, [p[1] for p in TRACK])), float(np.interp(t, ts, [p[2] for p in TRACK]))


def fill_patch(img, x0, y0, w, h, rng):
    """Coons-patch init from the 1 px ring + Jacobi smoothing, light noise (img: HxWx3 float32, edge-padded)."""
    P = img[y0 - 1:y0 + h + 1, x0 - 1:x0 + w + 1].copy()
    top, bot, lef, rig = P[0], P[-1], P[:, 0], P[:, -1]
    u = np.linspace(0, 1, w + 2)[None, :, None]
    v = np.linspace(0, 1, h + 2)[:, None, None]
    c00, c01, c10, c11 = P[0, 0], P[0, -1], P[-1, 0], P[-1, -1]
    U = (1 - v) * top[None] + v * bot[None] + (1 - u) * lef[:, None] + u * rig[:, None] \
        - ((1 - u) * (1 - v) * c00 + u * (1 - v) * c01 + (1 - u) * v * c10 + u * v * c11)
    U[0], U[-1], U[:, 0], U[:, -1] = top, bot, lef, rig
    for _ in range(60):
        U[1:-1, 1:-1] = 0.25 * (U[:-2, 1:-1] + U[2:, 1:-1] + U[1:-1, :-2] + U[1:-1, 2:])
    U[1:-1, 1:-1] += rng.normal(0, 1.3, (h, w, 1)).astype(np.float32)
    img[y0:y0 + h, x0:x0 + w] = U[1:-1, 1:-1]


def soften(img, x0, y0, w, h, sigma=7.0, feather=8, strength=1.0):
    """Faint lettering on the cabin's side glass: blur the region from its own edge-padded copy, feathered paste."""
    R = img[y0:y0 + h, x0:x0 + w].copy()
    r = int(3 * sigma)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2).astype(np.float32)
    k /= k.sum()
    Pd = np.pad(R, ((r, r), (r, r), (0, 0)), mode="edge")
    Pd = np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), 0, Pd)
    Pd = np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), 1, Pd)
    ry = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None]
    rx = np.minimum(np.arange(w), np.arange(w)[::-1])[None, :]
    m = strength * np.clip(np.minimum(ry, rx) / feather, 0, 1)[..., None]
    img[y0:y0 + h, x0:x0 + w] = R * (1 - m) + Pd * m


def clip_c():
    W, H, FPS = 1280, 720, 30000 / 1001
    n = int(16.0 * FPS)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", C, "-frames:v", str(n), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         check=True, capture_output=True).stdout
    frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W, 3).copy()
    rng = np.random.default_rng(7)
    PAD = 2
    for i in range(len(frames)):
        x, y = mark_at(i / FPS)
        px, py, pw, ph = int(round(x)) + 4, int(round(y)) + 1, 40, 50
        if py + 102 < 0:
            continue
        img = np.pad(frames[i].astype(np.float32), ((PAD + 130, PAD), (PAD, PAD), (0, 0)), mode="edge")
        fill_patch(img, px + PAD, py + PAD + 130, pw, ph, rng)
        sx, sy = int(round(x)) + 70, int(round(y)) - 8  # side glass lettering, 76 x 110 px, moves with the cabin
        st = min(1.0, max(0.0, (3.2 - i / FPS) / 0.6))  # the lettering only reads while the cabin is low
        if st > 0 and sy + 110 > 0:
            soften(img, sx + PAD, sy + PAD + 130, 76, 110, strength=st)
        frames[i] = np.clip(img[PAD + 130:PAD + 130 + H, PAD:PAD + W] + 0.5, 0, 255).astype(np.uint8)

    def enc(seq, name):
        p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                              "-r", "30000/1001", "-i", "-", *X264, OUT(name)], stdin=subprocess.PIPE)
        for k in seq:
            p.stdin.write(frames[k].tobytes())
        p.stdin.close()
        if p.wait():
            sys.exit(f"encode {name} failed")

    def yoyo(f0, leg, reps):
        up = list(range(f0, f0 + leg))
        down = list(range(f0 + leg, f0, -1))
        return (up + down) * reps

    enc(range(len(frames)), "a2-cab.mp4")
    enc(yoyo(round(2.4 * FPS), 36, 6), "a2-cab-alt.mp4")
    enc(yoyo(round(1.5 * FPS), 150, 3), "a2-cab-yoyo.mp4")


def grain():
    from PIL import Image
    rng = np.random.default_rng(3)
    g = np.clip(128 + rng.normal(0, 46, (384, 384)), 0, 255).astype(np.uint8)
    Image.fromarray(g, "L").save(OUT("a2-grain.png"), optimize=True)


if __name__ == "__main__":
    what = sys.argv[1:] or ["a", "b", "c", "grain"]
    if "a" in what: clip_a()
    if "b" in what: clip_b()
    if "c" in what: clip_c()
    if "grain" in what: grain()
    print("ok")
