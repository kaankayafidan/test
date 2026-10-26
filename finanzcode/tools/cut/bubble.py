"""Track Loom's camera bubble (the round webcam overlay) over the whole recording.

    python3 -I tools/cut/bubble.py <raw_video> <out.json> [--step 0.5]

The bubble is a filled circle of camera image on top of the screen recording. Per sampled frame:
HoughCircles on a downscaled frame finds the circle (radius 90–170 px at 720p), a face detector
inside the circle gives the eye line and face size. Output: {"samples": [{t, cx, cy, r, face}]}.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np


def main():
    args = sys.argv[1:]
    step = 0.5
    if "--step" in args:
        i = args.index("--step"); step = float(args[i + 1]); del args[i : i + 2]
    src, out = args[0], Path(args[1])
    cap = cv2.VideoCapture(src)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    eyes_c = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
    samples = []
    every = max(1, int(round(step * fps)))
    prev = None
    for fi in range(0, n, every):
        cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
        ok, frame = cap.read()
        if not ok:
            continue
        g = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        small = cv2.resize(g, None, fx=0.5, fy=0.5)
        blur = cv2.medianBlur(small, 5)
        circles = cv2.HoughCircles(blur, cv2.HOUGH_GRADIENT, dp=1.2, minDist=200, param1=120, param2=40, minRadius=45, maxRadius=90)
        best = None
        if circles is not None:
            # prefer the circle that holds a face, else the one closest to the previous position
            for cx, cy, r in circles[0]:
                cx, cy, r = cx * 2, cy * 2, r * 2
                x0, y0 = int(max(0, cx - r)), int(max(0, cy - r))
                roi = g[y0 : int(cy + r), x0 : int(cx + r)]
                faces = cascade.detectMultiScale(roi, 1.1, 5, minSize=(int(r * 0.5), int(r * 0.5))) if roi.size else []
                face = None
                if len(faces):
                    fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
                    face = [float(x0 + fx), float(y0 + fy), float(fw), float(fh)]
                    ey = eyes_c.detectMultiScale(roi[fy : fy + fh // 2 + fh // 6, fx : fx + fw], 1.1, 4)
                    if len(ey):
                        face.append(float(y0 + fy + np.median([e[1] + e[3] / 2 for e in ey])))
                score = (2 if face else 0) - (0 if prev is None else np.hypot(cx - prev[0], cy - prev[1]) / 300)
                if best is None or score > best[0]:
                    best = (score, float(cx), float(cy), float(r), face)
        if best:
            prev = best[1:3]
            samples.append({"t": round(fi / fps, 2), "cx": round(best[1], 1), "cy": round(best[2], 1), "r": round(best[3], 1), "face": best[4]})
        else:
            samples.append({"t": round(fi / fps, 2), "cx": None, "cy": None, "r": None, "face": None})
    cap.release()
    out.write_text(json.dumps({"samples": samples}))
    ok = [s for s in samples if s["cx"] is not None]
    print(f"{len(ok)}/{len(samples)} frames with a bubble")
    if ok:
        a = np.array([[s["cx"], s["cy"], s["r"]] for s in ok])
        print("median cx,cy,r:", np.median(a, axis=0), " r range:", a[:, 2].min(), a[:, 2].max())


if __name__ == "__main__":
    main()
