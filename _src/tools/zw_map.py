"""Builds the dot-matrix Zimbabwe map (assets/img/zw-dots.svg) and prints pin coordinates.
Usage: python zw_map.py <ZWE.geo.json> <out.svg>"""
import json, math, sys
geo = json.load(open(sys.argv[1]))
ring = geo['features'][0]['geometry']['coordinates'][0]
K = math.cos(math.radians(19))
W = 800
lons = [p[0] for p in ring]; lats = [p[1] for p in ring]
x0, x1, y0, y1 = min(lons), max(lons), min(lats), max(lats)
s = W / ((x1 - x0) * K)
H = round((y1 - y0) * s)
def proj(lon, lat):
    return (lon - x0) * K * s, (y1 - lat) * s
poly = [proj(*p) for p in ring]
def inside(x, y):
    c = False
    for i in range(len(poly)):
        ax, ay = poly[i]; bx, by = poly[i - 1]
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            c = not c
    return c
step = 13
dots = []
for j in range(int(H / step) + 1):
    for i in range(int(W / step) + 1):
        x = i * step + (step / 2 if j % 2 else 0); y = j * step
        if inside(x, y):
            dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.1"/>')
outline = 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in poly) + 'Z'
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 {W+40} {H+40}">'
       f'<path d="{outline}" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="2 6"/>'
       f'<g fill="currentColor">{"".join(dots)}</g></svg>')
open(sys.argv[2], 'w').write(svg)
print('viewBox', -20, -20, W + 40, H + 40, 'dots', len(dots))
pins = {'harare': (31.05, -17.83), 'marondera': (31.55, -18.19), 'rusape': (32.13, -18.53),
        'mutare': (32.67, -18.97), 'binga': (27.34, -17.62), 'bulawayo': (28.58, -20.15),
        'gweru': (29.81, -19.45), 'masvingo': (30.83, -20.07), 'vicfalls': (25.84, -17.93), 'kariba': (28.80, -16.52)}
for k, (lo, la) in pins.items():
    x, y = proj(lo, la)
    print(k, f'left:{(x + 20) / (W + 40) * 100:.2f}%;top:{(y + 20) / (H + 40) * 100:.2f}%')
