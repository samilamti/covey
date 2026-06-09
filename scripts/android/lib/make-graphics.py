#!/usr/bin/env python3
"""Covey brand assets from the FLOCK mark — single source of truth.

A "covey" is a small flock of birds: an amber lead bird with two white birds
behind it. Brand palette: slate #1e293b / #0f172a, amber #f59e0b, white.

Outputs (relative to repo root):
  frontend/assets/icon-foreground.png    1024  transparent, flock in adaptive safe zone
  frontend/assets/icon-background.png     1024  solid slate
  frontend/assets/icon-only.png           1024  slate + flock (full)
  scripts/android/listing/icon.png         512  slate + flock (Play hi-res icon)
  scripts/android/listing/feature-graphic.png 1024x500  flock + "Covey" wordmark
  frontend/public/icon.svg                      flock (web/PWA source)
  frontend/public/icon-512.png, icon-192.png    flock, slate

Flock shapes render via rsvg-convert; the feature-graphic text via PIL.
"""
import os
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SLATE = "#1e293b"
SLATE_TOP = "#0f172a"
AMBER = "#f59e0b"
WHITE = "#ffffff"
GRAY = (203, 213, 225)
MUTED = (148, 163, 184)


def gull(cx, cy, L, dip, body, w, color):
    """Flying-bird stroke: wings up at the tips, body dipping at center."""
    return (f'<path d="M {cx-L:.1f} {cy:.1f} Q {cx-L*0.5:.1f} {cy-dip:.1f} {cx:.1f} {cy+body:.1f} '
            f'Q {cx+L*0.5:.1f} {cy-dip:.1f} {cx+L:.1f} {cy:.1f}" fill="none" stroke="{color}" '
            f'stroke-width="{w:.1f}" stroke-linecap="round" stroke-linejoin="round"/>')


def flock(s=1.0, cx=512, cy=512):
    """Three-bird covey centered at (cx, cy). Light, wide gull strokes so it
    reads as distant birds (not heavy waves). Base tuned for a 1024 canvas."""
    lead = gull(cx,          cy - 42 * s, 150 * s, 120 * s, 26 * s, 36 * s, AMBER)
    left = gull(cx - 160*s,  cy + 108 * s, 95 * s, 78 * s, 17 * s, 29 * s, WHITE)
    right = gull(cx + 160*s, cy + 108 * s, 95 * s, 78 * s, 17 * s, 29 * s, WHITE)
    return lead + left + right


def svg(inner, w=1024, h=1024, extra=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}">{extra}{inner}</svg>')


def render(svg_str, out, w, h):
    with tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False) as f:
        f.write(svg_str)
        sp = f.name
    subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), sp, "-o", out], check=True)
    os.unlink(sp)
    print("wrote", os.path.relpath(out, ROOT))


def font(bold, size):
    paths = (["/System/Library/Fonts/Supplemental/Arial Bold.ttf"] if bold
             else ["/System/Library/Fonts/Supplemental/Arial.ttf"]) + ["/System/Library/Fonts/Helvetica.ttc"]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()


def out(*parts):
    p = os.path.join(ROOT, *parts)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


# --- Capacitor source images ---
slate_bg = f'<rect width="1024" height="1024" fill="{SLATE}"/>'
render(svg(flock(0.82)), out("frontend", "assets", "icon-foreground.png"), 1024, 1024)   # transparent, padded for safe zone
render(svg(slate_bg), out("frontend", "assets", "icon-background.png"), 1024, 1024)
render(svg(slate_bg + flock(1.05)), out("frontend", "assets", "icon-only.png"), 1024, 1024)

# --- Play hi-res icon 512 ---
render(svg(f'<rect width="1024" height="1024" rx="180" fill="{SLATE}"/>' + flock(1.05)),
       out("scripts", "android", "listing", "icon.png"), 512, 512)

# --- Web / PWA icons + canonical svg ---
render(svg(f'<rect width="1024" height="1024" rx="512" fill="{SLATE}"/>' + flock(1.05)),
       out("frontend", "public", "icon-512.png"), 512, 512)
render(svg(f'<rect width="1024" height="1024" rx="512" fill="{SLATE}"/>' + flock(1.05)),
       out("frontend", "public", "icon-192.png"), 192, 192)
open(out("frontend", "public", "icon.svg"), "w").write(
    svg(f'<rect width="1024" height="1024" rx="512" fill="{SLATE}"/>' + flock(1.05)))
print("wrote", "frontend/public/icon.svg")

# --- Feature graphic 1024x500: flock tile + wordmark (PIL for text) ---
mark_png = os.path.join(tempfile.gettempdir(), "covey-flock-mark.png")
render(svg(f'<rect width="1024" height="1024" rx="230" fill="#243042"/>' + flock(0.98)), mark_png, 360, 360)

W, H = 1024, 500
img = Image.new("RGB", (W, H))
px = img.load()
top, bot = (15, 23, 42), (30, 41, 59)
for y in range(H):
    t = y / (H - 1)
    row = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
    for x in range(W):
        px[x, y] = row
d = ImageDraw.Draw(img)
mark = Image.open(mark_png).convert("RGBA")
img.paste(mark, (80, (H - 360) // 2), mark)
tx = 80 + 360 + 60
max_w = W - tx - 44


def fit(text, bold, start):
    size = start
    while size > 10 and d.textlength(text, font=font(bold, size)) > max_w:
        size -= 1
    return font(bold, size)


d.text((tx, 150), "Covey", font=font(True, 104), fill=(255, 255, 255))
tb = d.textbbox((tx, 150), "Covey", font=font(True, 104))
d.rounded_rectangle([tx, tb[3] + 14, tx + 150, tb[3] + 24], radius=5, fill=(245, 158, 11))
d.text((tx, 286), "Trygg hemgång, tillsammans", font=fit("Trygg hemgång, tillsammans", False, 38), fill=GRAY)
sub = "Verifierad med BankID · Ideell · Öppen källkod"
d.text((tx, 344), sub, font=fit(sub, False, 26), fill=MUTED)
img.save(out("scripts", "android", "listing", "feature-graphic.png"), "PNG")

# --- Android launcher icons (deterministic; full-bleed color background) ---
# Avoids @capacitor/assets' 16.7% background inset, which leaves transparent
# edges. Adaptive: full-bleed @color background + padded flock foreground.
RES = os.path.join(ROOT, "frontend", "android", "app", "src", "main", "res")
DENS = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
SQ = f'<rect width="1024" height="1024" rx="160" fill="{SLATE}"/>'
CIRC = f'<circle cx="512" cy="512" r="512" fill="{SLATE}"/>'
for name, dn in DENS.items():
    leg, fg = round(48 * dn), round(108 * dn)
    md = os.path.join(RES, f"mipmap-{name}")
    os.makedirs(md, exist_ok=True)
    render(svg(SQ + flock(1.05)), os.path.join(md, "ic_launcher.png"), leg, leg)
    render(svg(CIRC + flock(1.05)), os.path.join(md, "ic_launcher_round.png"), leg, leg)
    render(svg(flock(1.1)), os.path.join(md, "ic_launcher_foreground.png"), fg, fg)  # transparent, safe-zone
    bgpng = os.path.join(md, "ic_launcher_background.png")  # unused with color bg
    if os.path.exists(bgpng):
        os.remove(bgpng)
adaptive = ('<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <background android:drawable="@color/ic_launcher_background"/>\n'
            '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
            '</adaptive-icon>\n')
anyd = os.path.join(RES, "mipmap-anydpi-v26")
open(os.path.join(anyd, "ic_launcher.xml"), "w").write(adaptive)
open(os.path.join(anyd, "ic_launcher_round.xml"), "w").write(adaptive)
open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    f'    <color name="ic_launcher_background">{SLATE}</color>\n</resources>\n')
print("wrote Android launcher icons (all densities) + adaptive XML + slate background color")

print("wrote", "scripts/android/listing/feature-graphic.png")
