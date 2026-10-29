"""Greyscale, trim and optically size the hardware brand logos.

Usage: python _src/tools/logos.py
Reads _src/logo-src/*.png, writes assets/img/brands/<name>.png at 2x and
prints the display width/height to use in the HTML.

Steps per logo:
  1. knock out near-white pixels (white plates, highlights) to transparency
  2. take luminance and remap it into one grey range, so every logo has
     the same darkest tone whatever its original colours
  3. trim to the artwork
  4. size by optical area: wide wordmarks get shorter, compact marks taller
"""
import pathlib

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / '_src' / 'logo-src'
OUT = ROOT / 'assets' / 'img' / 'brands'

INK = np.array([0x3a, 0x40, 0x3b]) / 255     # darkest tone (charcoal with a green cast)
PALE = np.array([0x9a, 0xa0, 0x9b]) / 255    # lightest tone that still reads on paper
AREA = 2300                                  # target display area in px²
H_MIN, H_MAX = 20, 44
SCALE = 2                                    # export density
NUDGE = {'sigenergy': 1.18, 'victron': 1.12, 'suntask': .92, 'deye': .9}   # optical corrections


def process(path):
    im = np.asarray(Image.open(path).convert('RGBA')).astype(float) / 255
    rgb, a = im[..., :3], im[..., 3]
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    a = a * np.clip((0.93 - lum) / 0.12, 0, 1)          # knock out white
    vis = a > 0.5
    lo, hi = np.percentile(lum[vis], 2), np.percentile(lum[vis], 98)
    if hi - lo < 0.3:                                    # essentially one hue: flat ink
        t = np.zeros_like(lum)
    else:                                                # two-tone: keep the structure, gently
        t = np.clip((lum - lo) / (hi - lo), 0, 1) ** 0.8 * 0.7
    grey = INK + (PALE - INK) * t[..., None]
    out = Image.fromarray((np.dstack([grey, a]) * 255).astype(np.uint8), 'RGBA')
    out = out.crop(out.getbbox())
    w, h = out.size
    dh = round(min(H_MAX, max(H_MIN, (AREA / (w / h)) ** 0.5)) * NUDGE.get(path.stem, 1))
    dw = round(w * dh / h)
    out.resize((dw * SCALE, dh * SCALE), Image.LANCZOS).save(OUT / path.name, optimize=True)
    return dw, dh


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for p in sorted(SRC.glob('*.png')):
        dw, dh = process(p)
        print(f'{p.stem:14} width="{dw}" height="{dh}"')
