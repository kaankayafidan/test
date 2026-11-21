#!/usr/bin/env python3
"""Kilian's two photos for the first image of Ad 6 (damals | heute). Run: python3 -I assets/img/ad6/_prep_photos.py

Sources (sent by the client, phone screenshots 920x2000 with black bars, content rows 180..1818):
  data/raw/kilian_photos/jung_src.webp   Kilian young on a ferry (NYC skyline)          -> jung.jpg
  data/raw/kilian_photos/heute_src.webp  Kilian at his desk today (iMacs + laptop)      -> heute.jpg
Both are cropped square (the polaroid window is 248x248) and saved at 744x744.
Briefing rules applied: no brand logos (cap, shirt, can blurred), no luxury (watch blurred), no readable screens
(every screen blurred: no UI, charts, logos or text).
"""
import os

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(ROOT, "data", "raw", "kilian_photos")
SIZE = 744


def blur_regions(im, regions, radius):
    """Blur rectangles or polygons [(x, y), ...] with a soft-edged mask."""
    blurred = im.filter(ImageFilter.GaussianBlur(radius))
    mask = Image.new("L", im.size, 0)
    d = ImageDraw.Draw(mask)
    for r in regions:
        if len(r) == 4 and not isinstance(r[0], tuple):
            d.rounded_rectangle(r, radius=12, fill=255)
        else:
            d.polygon(r, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(6))
    return Image.composite(blurred, im, mask)


def jung():
    im = Image.open(os.path.join(SRC, "jung_src.webp")).convert("RGB")
    # logos: cap box logo, shirt print, trousers logo (outside the crop, blurred anyway)
    im = blur_regions(im, [(236, 525, 345, 600), (505, 965, 640, 1070), (525, 1415, 625, 1505)], 14)
    box = (0, 330, 920, 1250)  # cap, face, shirt and the phones in his hands; skyline on the left
    return im.crop(box).resize((SIZE, SIZE), Image.LANCZOS)


def heute():
    im = Image.open(os.path.join(SRC, "heute_src.webp")).convert("RGB")
    screens = [
        [(0, 770), (200, 795), (200, 1060), (0, 1040)],                            # left iMac screen
        [(195, 745), (497, 752), (497, 925), (452, 900), (277, 935), (195, 950)],  # right iMac screen above the laptop
        [(277, 935), (452, 900), (497, 1028), (470, 1032), (385, 1040), (345, 1078), (300, 1062)],  # laptop screen above the hands
    ]
    im = blur_regions(im, screens, 22)
    im = blur_regions(im, [(388, 1066, 448, 1118), (538, 903, 578, 992)], 12)  # gold watch, drink can label
    box = (0, 560, 920, 1480)  # desk with the (blurred) screens on the left, Kilian working on the right
    return im.crop(box).resize((SIZE, SIZE), Image.LANCZOS)


if __name__ == "__main__":
    jung().save(os.path.join(HERE, "jung.jpg"), quality=92)
    heute().save(os.path.join(HERE, "heute.jpg"), quality=92)
    print("wrote jung.jpg, heute.jpg")
