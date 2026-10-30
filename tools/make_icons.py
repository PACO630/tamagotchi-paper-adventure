#!/usr/bin/env python3
"""Generate the PWA icons: a deliberately wobbly MS Paint Mametchi on a paper card.

Usage: python3 tools/make_icons.py   (writes public/icons/*.png)
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)


def wobble_ellipse(cx, cy, rx, ry, rnd, jitter, n=40):
    pts = []
    for i in range(n + 2):  # overshoot a little: the line never closes neatly
        a = i / n * math.tau
        r = 1 + rnd.uniform(-jitter, jitter)
        pts.append((cx + math.cos(a) * rx * r, cy + math.sin(a) * ry * r))
    return pts


def draw_icon(size, pad_ratio, bg):
    rnd = random.Random(7)
    s = 256
    img = Image.new("RGB", (s, s), bg)
    d = ImageDraw.Draw(img)
    pad = s * pad_ratio
    # paper card
    d.rounded_rectangle((pad, pad, s - pad, s - pad), radius=36, fill=(255, 250, 235), outline=(60, 40, 20), width=5)
    cx, cy = s / 2, s / 2 + 18
    sc = (s - pad * 2) / 256
    # ears (navy, pointy)
    for side in (-1, 1):
        ear = [(cx + side * 30 * sc, cy - 58 * sc), (cx + side * 62 * sc, cy - 118 * sc + rnd.uniform(-6, 6)), (cx + side * 66 * sc, cy - 40 * sc)]
        d.polygon([(x + rnd.uniform(-3, 3), y + 4) for x, y in ear], fill=(0, 0, 128))
        d.line(ear + [ear[0]], fill=(0, 0, 0), width=4)
    # body (cream, spills over outline)
    body = wobble_ellipse(cx, cy, 74 * sc, 66 * sc, rnd, 0.07)
    d.polygon([(x + 5, y + 3) for x, y in body], fill=(255, 255, 128))
    d.line(body, fill=(0, 0, 0), width=5)
    # asymmetric eyes
    d.ellipse((cx - 34 * sc, cy - 22 * sc, cx - 18 * sc, cy + 2 * sc), fill=(0, 0, 0))
    d.ellipse((cx + 16 * sc, cy - 16 * sc, cx + 28 * sc, cy - 2 * sc), fill=(0, 0, 0))
    # cheeks (spray-can dots)
    for side, ox in ((-1, -46), (1, 40)):
        for _ in range(90):
            a, r = rnd.uniform(0, math.tau), rnd.uniform(0, 12 * sc)
            x, y = cx + ox * sc + math.cos(a) * r, cy + 16 * sc + math.sin(a) * r
            d.point((x, y), fill=(255, 0, 128))
    # wonky smile
    d.line([(cx - 14 * sc, cy + 18 * sc), (cx - 2 * sc, cy + 30 * sc), (cx + 16 * sc, cy + 20 * sc)], fill=(0, 0, 0), width=4)
    return img.resize((size, size), Image.NEAREST)


draw_icon(192, 0.04, (255, 214, 102)).save(OUT / "icon-192.png")
draw_icon(512, 0.04, (255, 214, 102)).save(OUT / "icon-512.png")
draw_icon(512, 0.14, (255, 214, 102)).save(OUT / "icon-maskable-512.png")
draw_icon(180, 0.04, (255, 214, 102)).save(OUT / "apple-touch-icon.png")
draw_icon(64, 0.0, (255, 214, 102)).save(OUT / "favicon.png")
print("icons written to", OUT)
