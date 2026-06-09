#!/usr/bin/env python3
"""Generate Covey's Play Store listing graphics from brand colors (no external
asset needed): a 1024x500 feature graphic and a 512x512 store icon, both using a
clean "C" monogram. Brand: slate (#1e293b / #0f172a) + amber (#f59e0b) accent.

Usage: make-graphics.py <feature_out.png> <icon_out.png>
"""
import sys
from PIL import Image, ImageDraw, ImageFont

SLATE_TOP = (15, 23, 42)
SLATE = (30, 41, 59)
SLATE_LIGHT = (51, 65, 85)
WHITE = (255, 255, 255)
GRAY = (203, 213, 225)
MUTED = (148, 163, 184)
AMBER = (245, 158, 11)

BOLD = ["/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/HelveticaNeue.ttc", "/Library/Fonts/Arial Bold.ttf"]
REG = ["/System/Library/Fonts/Supplemental/Arial.ttf",
       "/System/Library/Fonts/Helvetica.ttc", "/Library/Fonts/Arial.ttf"]


def font(cands, size):
    for p in cands:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()


def fit(draw, text, cands, start, max_w):
    """Largest font size <= start whose text width fits max_w."""
    size = start
    while size > 10:
        f = font(cands, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 1
    return font(cands, 10)


def monogram_circle(d, cx, cy, r):
    """Slate disc with amber ring + white C, centered at (cx, cy)."""
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=SLATE_LIGHT)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=AMBER, width=max(4, r // 18))
    f = font(BOLD, int(r * 1.3))
    tb = d.textbbox((0, 0), "C", font=f)
    d.text((cx - (tb[2] - tb[0]) / 2 - tb[0], cy - (tb[3] - tb[1]) / 2 - tb[1]),
           "C", font=f, fill=WHITE)


def make_feature(out):
    W, H = 1024, 500
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        px_row = tuple(int(SLATE_TOP[i] + (SLATE[i] - SLATE_TOP[i]) * t) for i in range(3))
        for x in range(W):
            px[x, y] = px_row
    d = ImageDraw.Draw(img)

    r = 150
    monogram_circle(d, 80 + r, H // 2, r)

    tx = 80 + 2 * r + 70
    max_w = W - tx - 50
    d.text((tx, 150), "Covey", font=font(BOLD, 104), fill=WHITE)
    tb = d.textbbox((tx, 150), "Covey", font=font(BOLD, 104))
    d.rounded_rectangle([tx, tb[3] + 14, tx + 150, tb[3] + 24], radius=5, fill=AMBER)
    d.text((tx, 286), "Trygg hemgång, tillsammans",
           font=fit(d, "Trygg hemgång, tillsammans", REG, 40, max_w), fill=GRAY)
    sub = "Verifierad med BankID · Ideell · Öppen källkod"
    d.text((tx, 348), sub, font=fit(d, sub, REG, 27, max_w), fill=MUTED)
    img.save(out, "PNG")
    print(f"wrote {out} (1024x500)")


def make_icon(out):
    S = 512
    img = Image.new("RGB", (S, S), SLATE)
    d = ImageDraw.Draw(img)
    # subtle vignette ring
    d.ellipse([40, 40, S - 40, S - 40], outline=AMBER, width=14)
    f = font(BOLD, 300)
    tb = d.textbbox((0, 0), "C", font=f)
    d.text((S / 2 - (tb[2] - tb[0]) / 2 - tb[0], S / 2 - (tb[3] - tb[1]) / 2 - tb[1]),
           "C", font=f, fill=WHITE)
    img.save(out, "PNG")
    print(f"wrote {out} (512x512)")


if __name__ == "__main__":
    make_feature(sys.argv[1])
    make_icon(sys.argv[2])
