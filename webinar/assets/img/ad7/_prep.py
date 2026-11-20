#!/usr/bin/env python3
"""Derived clips for Ad 7 from Kilian's server recording. Run: python3 -I assets/img/ad7/_prep.py [panel] [screen] [clock]

Source: data/raw/ad7/experiment1.mov (3456 x 2234, ~60 fps VFR, BT.709, 324.5 s). Coordinates below are source px.
  0 - 88.5 s broker web portal and 88.5 - 97.5 s remote-desktop reconnect with the server IP: NEVER used.
  97.5 - 324 s the real terminal on the demo account; at 103.9 - 104.5 s and 117.1 - 117.7 s the macOS menu bar and the
  remote-desktop title (server IP) slide in, at 107.5 s the chart is scrolled back, from 160 s on the mouse wanders over
  the panel and later to the Algo Trading button. Used here ONLY 119.0 - 159.0 s: the mouse is parked the whole time
  at (2404..2430, 746..782) in the chart (template match, 5 fps, 209/209 samples identical 118.0 - 159.8 s), no menu
  bar, no popup, the chart does not move; the panel ticks live (POC/VAH/VAL), Trend BULLISH / Signal WAIT /
  Last Trade SELL / Position FLAT stay as they are; no trade is opened or closed.
All clips start at S0 = 119.0 s: clip time t <-> source time 119.0 + t (fps=30 CFR resample, H.264 yuv420p BT.709,
crf 18, -g 15, no audio). The same t means the same real moment in all three clips.

Panel = the bot's on-chart panel, border box x 744..1405, y 263..1273. Text rows (ink, y): title 285-305 (product name),
  MARKET 337-351, Bid 371-387, Ask 402-417, Spread 432-450, ATR 462-480, Fast EMA 492-507, Slow EMA 521-538,
  Trend 551-567, VOLUME PROFILE band 587-623, POC 635-649, VAH 665-679, VAL 695-709, Signal 723-742, Last Trade
  754-769, Position 783-799, ACCOUNT band 819-854, Balance .. Eq/Bal % 865-1034, POSITIONS band, Positions .. EA P/L
  1097-1233. Labels x 768..910, values x 1085..1180.

a7-panel.mp4 (14 s, 1080 x 710): crop x 757..1180, y 540..818 (423 x 278, only panel inside: below the Slow EMA row
  incl. its faint ringing at y 538-539, above the ACCOUNT band at 818/819), Lanczos x 2.553 (= ~250 %).
  Visible: Trend BULLISH, VOLUME PROFILE, POC/VAH/VAL labels, Signal WAIT, Last Trade SELL, Position FLAT.
  Hidden: POC/VAH/VAL values = mosaic 5 x 1 blocks of 54 x 54 px per line (one block = 1.8 characters x full line
  height incl. ringing), output x 808..1078, rows y 234/310/388 (+54). Everything else of the screen (title with the
  product name, prices, account, toolbar, Market Watch, Navigator, taskbar, chart) is outside the crop.
  Output rows (px): Trend 29-70, VOLUME PROFILE band 120-213, Signal label x 31-209 / WAIT x 836-955 y 467-519 (row
  centre 491), Last Trade 544-587, Position 620-662. a7-panel = a7-screen region x 25.0..310.5, y 191.7..379.3 (x 3.78).
a7-screen.mp4 (40 s, 1080 x 710): crop x 720..2320, y 256..1308 (1600 x 1052, area x 0.675): the whole panel left,
  the chart right of it. Cropped out: title bar, menu, toolbar (Algo Trading), Market Watch, Navigator, the chart's
  symbol/price header line (y 232-254), price axis, the EA label top right, time axis, ATR window, taskbar, the
  parked mouse (x >= 2404). Chart (everything outside the panel box) Gaussian-blurred sigma 12 output px (panel box
  blanked first, nothing of the panel bleeds in); this also smears the bot's input-string line (y 266-282, x >= 1408).
  Mosaic 14 x 14 px blocks on: the panel title (product name), all MARKET values, POC/VAH/VAL values, and the whole
  ACCOUNT and POSITIONS rows, labels included (Balance, Equity, Margin, P/L, %, Lots); 11 x 17 px blocks on the "(14)"
  of ATR(14), so no digit is left. Sharp: section headers, the MARKET / VOLUME PROFILE labels, BULLISH, WAIT, SELL, FLAT.
a7-clock.mp4 (14 s, 832 x 240): the Market Watch server-time digits only, crop x 160..264, y 222..252 (the header bar
  between "Watch:" ending at x 157 and the empty bar; nothing else in it), ink coverage per R/G/B subpixel (ClearType =
  3 horizontal samples per pixel), cubic x 8, smoothed edge -> white digits on black (mix-blend-mode: screen / lighten).
a7-clock.json: the ticks of that clock in clip time ([t, "HH:MM:SS"]; 10:48:34 at t = 0, +1 s per tick, verified
  by eye 118 - 159 s: 10:48:33 .. 10:49:15, no skipped second) - for a drawn clock that ticks exactly like the recording.
Checked (every 0.5 s by eye + every frame numerically): no digit / title / account text / cursor / UI chrome legible;
  outside the mosaics nothing changes over time beyond codec noise (max 20/255), the mosaic blocks stay uniform.
"""
import json, os, subprocess, sys
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(ROOT, "data", "raw", "ad7", "experiment1.mov")
OUT = lambda f: os.path.join(HERE, f)
S0 = 119.0
CLOCK_AT_S0 = (10, 48, 34)  # read off the recording at 119.0 s (changes to 10:48:35 at 119.23 s)
X264 = ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-g", "15", "-an", "-movflags", "+faststart",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]
TO_RGB = "in_color_matrix=bt709:in_range=tv"


def frames(dur, vf, w, h):
    """Source frames S0 .. S0+dur at 30 fps CFR through filter vf (must end at w x h), as HxWx3 uint8 RGB."""
    n = int(round(dur * 30))
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{S0:.3f}", "-i", SRC, "-t", f"{dur + 0.5:.3f}", "-an",
                          "-vf", f"fps=30,{vf},format=rgb24", "-frames:v", str(n), "-f", "rawvideo", "-"],
                         stdout=subprocess.PIPE)
    k = 0
    while True:
        b = p.stdout.read(w * h * 3)
        if len(b) < w * h * 3:
            break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3).copy()
        k += 1
    p.wait()
    if k != n:
        sys.exit(f"expected {n} frames, got {k}")


class Enc:
    def __init__(self, name, w, h):
        self.p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
                                   "-r", "30", "-i", "-", "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
                                   *X264, OUT(name)], stdin=subprocess.PIPE)
        self.name = name

    def put(self, img):
        self.p.stdin.write(np.ascontiguousarray(img, dtype=np.uint8).tobytes())

    def close(self):
        self.p.stdin.close()
        if self.p.wait():
            sys.exit(f"encode {self.name} failed")


def mosaic(img, x0, y0, x1, y1, b, bh=None):
    """Fill every b x bh block of the rectangle (blocks anchored at x0, y0) with its mean colour."""
    bh = bh or b
    for by in range(y0, y1, bh):
        for bx in range(x0, x1, b):
            blk = img[by:min(by + bh, y1), bx:min(bx + b, x1)]
            blk[...] = blk.reshape(-1, 3).mean(0)


# ---------------------------------------------------------------- a7-panel
PANEL_CROP = (757, 540, 423, 278)  # x, y, w, h (source); rows 538-539 / 818 carry faint residue of Slow EMA / ACCOUNT
PANEL_BLOCKS = [(808, y, 1078, y + 54) for y in (234, 310, 388)]  # POC, VAH, VAL values (output px), 54 px blocks


def panel():
    x, y, w, h = PANEL_CROP
    e = Enc("a7-panel.mp4", 1080, 710)
    for f in frames(14.0, f"crop={w}:{h}:{x}:{y}:exact=1,scale=1080:710:flags=lanczos+accurate_rnd+full_chroma_int:{TO_RGB}", 1080, 710):
        img = f.astype(np.float32)
        for r in PANEL_BLOCKS:
            mosaic(img, *r, 54)
        e.put(np.clip(img + 0.5, 0, 255))
    e.close()


# ---------------------------------------------------------------- a7-screen
SCR_CROP = (720, 256, 1600, 1052)
SX, SY = 1080 / 1600, 710 / 1052
PANEL_BOX = (744, 263, 1406, 1274)  # source, border included
SCR_MOSAIC = [  # (source rect, block w, block h in output px): title, MARKET values, VOLUME PROFILE values, ACCOUNT rows,
    #             POSITIONS rows, and the "(14)" of the ATR(14) label (glyphs x 806..849, "R" ends at 803) -> 3 blocks
    ((764, 281, 1094, 309), 14, 14), ((1081, 367, 1186, 541), 14, 14), ((1081, 631, 1174, 713), 14, 14),
    ((764, 861, 1186, 1038), 14, 14), ((764, 1093, 1186, 1237), 14, 14), ((805, 459, 852, 484), 11, 17)]


def to_out(x0, y0, x1, y1):
    X, Y = SCR_CROP[:2]
    return (int(np.floor((x0 - X) * SX)), int(np.floor((y0 - Y) * SY)), int(np.ceil((x1 - X) * SX)), int(np.ceil((y1 - Y) * SY)))


def screen():
    x, y, w, h = SCR_CROP
    X, Y = SCR_CROP[:2]
    px0, py0, px1, py1 = (int(round((v - o) * k)) for v, o, k in zip(PANEL_BOX, (X, Y, X, Y), (SX, SY, SX, SY)))
    e = Enc("a7-screen.mp4", 1080, 710)
    for f in frames(40.0, f"crop={w}:{h}:{x}:{y},scale=1080:710:flags=area+accurate_rnd+full_chroma_int:{TO_RGB}", 1080, 710):
        img = f.astype(np.float32)
        for r, bw, bh in SCR_MOSAIC:
            mosaic(img, *to_out(*r), bw, bh)
        chart = img.copy()
        chart[py0:py1, px0:px1] = 0  # nothing of the panel bleeds into the blur
        out = cv2.GaussianBlur(chart, (0, 0), 12)
        out[py0:py1, px0:px1] = img[py0:py1, px0:px1]
        e.put(np.clip(out + 0.5, 0, 255))
    e.close()


# ---------------------------------------------------------------- a7-clock
CLK_CROP = (160, 222, 104, 30)
CLK_SCALE = 8
CLK_BG = np.array([182, 196, 211], np.float32)  # header bar colour; the digits are ~black


def smoothstep(a, b, v):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def clock():
    x, y, w, h = CLK_CROP
    W, H = w * CLK_SCALE, h * CLK_SCALE
    e = Enc("a7-clock.mp4", W, H)
    ticks, prev = [], None
    hh, mm, ss = CLOCK_AT_S0
    for k, f in enumerate(frames(14.0, f"crop={w}:{h}:{x}:{y}:exact=1,scale={w}:{h}:{TO_RGB}", w, h)):
        lum = f.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
        if prev is None or np.abs(lum - prev).max() > 40:
            if prev is not None:
                ss += 1
                mm, ss = mm + ss // 60, ss % 60
                hh, mm = hh + mm // 60, mm % 60
            ticks.append([round(k / 30, 3), f"{hh:02d}:{mm:02d}:{ss:02d}"])
        prev = lum
        cov = np.clip((CLK_BG - f.astype(np.float32)) / CLK_BG, 0, 1).reshape(h, w * 3)  # ClearType: R,G,B = 3 subpixels
        up = cv2.GaussianBlur(cv2.resize(cov, (W, H), interpolation=cv2.INTER_CUBIC), (0, 0), 2.75)
        e.put(np.repeat((smoothstep(0.23, 0.47, up) * 255)[..., None], 3, axis=2))
    e.close()
    json.dump({"source": "experiment1.mov", "source_start": S0, "fps": 30, "what": "Market Watch server time",
               "ticks": ticks}, open(OUT("a7-clock.json"), "w"), indent=1)


if __name__ == "__main__":
    what = sys.argv[1:] or ["panel", "screen", "clock"]
    if "panel" in what: panel()
    if "screen" in what: screen()
    if "clock" in what: clock()
    print("ok")
