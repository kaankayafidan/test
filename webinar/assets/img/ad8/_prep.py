#!/usr/bin/env python3
"""Ad 8: one clean still of the backtest balance curve. Run: python3 -I assets/img/ad8/_prep.py [--debug DIR]

Source: data/raw/ad7/freebie.mov (3456 x 2234, ~60 fps VFR, BT.709 tv range), Kilian's screen recording of the
  Strategy Tester. Its Graph tab is on screen 236.5 - 293.5 s (ffmpeg time; Settings tab before, Backtest after).
  The test is finished there, so the graph never changes; only the mouse moves now and then. Used: the per-pixel
  median of 268.0 - 282.5 s at 2 fps (29 frames; the mouse rests at the top-left above the plot the whole time,
  its tooltip covers only the legend row, far from the curve).
  Plot box inside its frame lines (source px): x 46..3365, y 1521..1928. In it: the balance line (dark blue, about
  (0, 0, 160), 4-7 px), the green equity line 3-5 px below it, the grey dashed grid and the legend
  "Balance / Equity" (top-left). Outside the box: price axis, dates, Deposit Load bars, tester tabs, window chrome.
Extraction: per source column the dark-blue pixels (B - max(R, G) > 60, R and G < 120, weight = blueness) inside a
  window of +-80 px around the previous column's line (start: the lowest blue run in the first 40 columns, so the
  legend text is never picked up); centre = weighted mean; columns without blue pixels are interpolated.
  Only the balance line is taken: no equity line, grid, legend, axis, number, date, bar, UI, name or logo.
Output: balance-backtest.png, 1760 x 492 px = 2 x the 880 x 246 card in src/scenes/ad8.html. Flat background
  #F3F4F6 (the scene's card has the same colour, so a wipe of the image reveals only the line), the curve in the
  tester's balance blue #0202A3, 10 px (5 px in the scene), round joins, drawn at 4x and area-downsampled.
  x: the whole test period, first to last column, inside 44 px (scene) side margins; y: the curve's own min..max
  into the band 32..218 px (scene) of the 246 px card. No grid, no axis, no numbers, no text in the image; the
  label "Backtest · Simulation" is HTML in the scene, bottom-right in the card, where the curve is high above it
  (the gap between the label box and the line is checked and printed; the run fails below 12 px).
"""
import os, subprocess, sys
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(ROOT, "data", "raw", "ad7", "freebie.mov")
OUT = os.path.join(HERE, "balance-backtest.png")

T0, T1, FPS = 268.0, 282.5, 2           # static stretch of the Graph tab (mouse parked)
BOX = (46, 1521, 3366, 1929)            # plot box x0, y0, x1, y1 (exclusive), inside the frame lines
CARD_W, CARD_H, S = 880, 246, 2         # scene card (px) and the PNG's scale
MX, TOP, BOT = 44, 32, 28               # scene px: side margins, band top, bottom margin
LABEL = (880 - 20 - 454, 246 - 20 - 58, 880 - 20, 246 - 20)  # scene px: the HTML label's box in the card (bottom-right)
BG = (0xF3, 0xF4, 0xF6)
INK = (0x02, 0x02, 0xA3)
LW = 5                                  # scene px


def median_box():
    x0, y0, x1, y1 = BOX
    w, h = x1 - x0, y1 - y0
    n = int(round((T1 - T0) * FPS))
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{T0:.3f}", "-i", SRC, "-t", f"{T1 - T0 + 0.25:.3f}", "-an",
                          "-vf", f"fps={FPS},crop={w}:{h}:{x0}:{y0}:exact=1,scale=in_color_matrix=bt709:in_range=tv,format=rgb24",
                          "-frames:v", str(n), "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
    fr = []
    while True:
        b = p.stdout.read(w * h * 3)
        if len(b) < w * h * 3:
            break
        fr.append(np.frombuffer(b, np.uint8).reshape(h, w, 3))
    p.wait()
    if len(fr) != n:
        sys.exit(f"expected {n} frames, got {len(fr)}")
    st = np.stack(fr)
    spread = int((st.max(0).astype(int) - st.min(0)).max())
    print(f"{n} frames, max per-pixel spread {spread}/255 (codec noise only if small)")
    return np.median(st, axis=0).astype(np.float32)


def trace(img):
    R, G, B = img[..., 0], img[..., 1], img[..., 2]
    wgt = np.clip((B - np.maximum(R, G) - 60) / 60, 0, 1) * (R < 120) * (G < 120)
    h, w = wgt.shape
    ys = np.full(w, np.nan)
    first = np.nonzero(wgt[:, :40].sum(1) > 0)[0]
    prev = float(first.max())                       # the curve starts bottom-left; the legend is top-left
    for x in range(w):
        lo, hi = int(max(0, prev - 80)), int(min(h, prev + 81))
        col = wgt[lo:hi, x]
        if col.sum() < 0.5:
            continue
        idx = np.nonzero(col > 0)[0]
        # split into runs, keep the run nearest to the previous centre
        runs = np.split(idx, np.nonzero(np.diff(idx) > 2)[0] + 1)
        best = min(runs, key=lambda r: abs(lo + r.mean() - prev))
        c = lo + float((best * col[best]).sum() / col[best].sum())
        ys[x] = c
        prev = c
    ok = ~np.isnan(ys)
    print(f"line found in {ok.sum()}/{w} columns, longest gap {max_gap(ok)} px")
    xs = np.arange(w)
    return np.interp(xs, xs[ok], ys[ok])


def max_gap(ok):
    best = cur = 0
    for v in ok:
        cur = 0 if v else cur + 1
        best = max(best, cur)
    return best


def render(ys):
    Q = 4 * S                                        # supersampling: 4x of the 2x PNG
    W, H = CARD_W * Q, CARD_H * Q
    can = np.zeros((H, W, 3), np.uint8)
    can[:] = BG[::-1]                                # cv2 = BGR
    n = len(ys)
    X = MX + (np.arange(n) / (n - 1)) * (CARD_W - 2 * MX)
    lo, hi = ys.min(), ys.max()                      # source y grows downwards
    Y = TOP + (ys - lo) / (hi - lo) * (CARD_H - TOP - BOT)
    pts = np.stack([X * Q, Y * Q], 1)
    sh = 4
    cv2.polylines(can, [np.round(pts * (1 << sh)).astype(np.int32)], False, INK[::-1], LW * Q, cv2.LINE_AA, sh)
    out = cv2.resize(can, (CARD_W * S, CARD_H * S), interpolation=cv2.INTER_AREA)
    cv2.imwrite(OUT, out)
    # gap between the label box and the line above it (line edge = centre + LW/2), 20 px wider than the label
    lx0, ly0, lx1, ly1 = LABEL
    m = (X >= lx0 - 20) & (X <= lx1 + 20)
    gap = float(ly0 - (Y[m].max() + LW / 2))
    print(f"wrote {OUT} ({CARD_W * S} x {CARD_H * S}); line above the label: min gap {gap:.1f} px (scene)")
    return X, Y, gap


def main():
    img = median_box()
    ys = trace(img)
    X, Y, gap = render(ys)
    if "--debug" in sys.argv:
        d = sys.argv[sys.argv.index("--debug") + 1]
        os.makedirs(d, exist_ok=True)
        dbg = np.clip(img, 0, 255).astype(np.uint8)[..., ::-1].copy()
        for x in range(0, len(ys), 2):
            cv2.circle(dbg, (x, int(round(ys[x]))), 1, (0, 0, 255), -1)
        cv2.imwrite(os.path.join(d, "trace.png"), dbg)
        cv2.imwrite(os.path.join(d, "median.png"), np.clip(img, 0, 255).astype(np.uint8)[..., ::-1])
    if gap < 12:
        sys.exit("the label would touch the curve: move it or change the band")


if __name__ == "__main__":
    main()
