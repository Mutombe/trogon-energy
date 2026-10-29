"""Ray-marched studio renders of the Trogon 3D objects.

Usage: python render3d.py <out_dir>
Each object is a signed distance function, ray-marched with numpy at 2x
and downsampled with premultiplied alpha, then saved as transparent WebP.
Objects: PV panel, sun-orb with orbit ring, battery cell, two-tone ribbon.
"""
import os
import sys

import numpy as np
from PIL import Image

SIZE = 480           # render canvas
SS = 2               # supersample factor
N = SIZE * SS
OUT = 440            # exported square


def norm(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)


def rot(ax, ay, az):
    ax, ay, az = np.radians([ax, ay, az])
    rx = np.array([[1, 0, 0], [0, np.cos(ax), -np.sin(ax)], [0, np.sin(ax), np.cos(ax)]])
    ry = np.array([[np.cos(ay), 0, np.sin(ay)], [0, 1, 0], [-np.sin(ay), 0, np.cos(ay)]])
    rz = np.array([[np.cos(az), -np.sin(az), 0], [np.sin(az), np.cos(az), 0], [0, 0, 1]])
    return rz @ ry @ rx


# ---------- SDF primitives (p: (n, 3)) ----------
def sd_round_box(p, b, r):
    q = np.abs(p) - (np.array(b) - r)
    return np.linalg.norm(np.maximum(q, 0), axis=-1) + np.minimum(q.max(-1), 0) - r


def sd_sphere(p, r):
    return np.linalg.norm(p, axis=-1) - r


def sd_torus(p, R, r):
    q = np.stack([np.hypot(p[:, 0], p[:, 2]) - R, p[:, 1]], -1)
    return np.linalg.norm(q, axis=-1) - r


def sd_round_cyl(p, ra, h, rb):
    d = np.stack([np.hypot(p[:, 0], p[:, 2]) - ra + rb, np.abs(p[:, 1]) - h + rb], -1)
    return np.minimum(d.max(-1), 0) + np.linalg.norm(np.maximum(d, 0), axis=-1) - rb


def twist_q(p, R):
    a = np.arctan2(p[:, 2], p[:, 0])
    qx = np.hypot(p[:, 0], p[:, 2]) - R
    qy = p[:, 1]
    c, s = np.cos(a), np.sin(a)          # one full twist per lap
    return c * qx - s * qy, s * qx + c * qy


# ---------- scenes: return (distance, material id) ----------
RING_R = rot(-18, 0, 22)


def scene_panel(p):
    return sd_round_box(p, (1.05, 0.055, 0.72), 0.035), np.zeros(len(p), int)


def scene_sun(p):
    d1 = sd_sphere(p, 0.78)
    d2 = sd_torus(p @ RING_R, 1.12, 0.045)
    return np.minimum(d1, d2), np.where(d1 < d2, 0, 1)


def scene_battery(p):
    body = sd_round_cyl(p, 0.56, 0.92, 0.12)
    term = sd_round_cyl(p - np.array([0, 0.98, 0]), 0.2, 0.12, 0.04)
    return np.minimum(body, term), np.where(body < term, 0, 1)


def scene_ribbon(p):
    qx, qy = twist_q(p, 0.92)
    d = np.abs(np.stack([qx, qy], -1)) - np.array([0.36, 0.035])
    sd = np.linalg.norm(np.maximum(d, 0), axis=-1) + np.minimum(d.max(-1), 0) - 0.03
    return sd * 0.55, np.zeros(len(p), int)


# ---------- virtual studio ----------
LIGHTS = [  # direction, strength, colour
    (norm(np.array([-0.55, 0.75, 0.65])), 4.2, np.array([1, .98, .95])),    # key, warm
    (norm(np.array([0.85, 0.25, -0.45])), 1.6, np.array([.85, 1., .9])),     # rim, mint
    (norm(np.array([0, 1, 0.1])), 0.6, np.array([1, 1, 1])),                 # top
    (norm(np.array([0.6, -0.4, 0.7])), 0.5, np.array([1., .85, .55])),      # fill, amber
]


def env(d):
    y = d[:, 1:2]
    sky = np.array([.96, .98, .96])
    hor = np.array([.30, .34, .32])
    flo = np.array([.12, .10, .05])
    c = np.where(y > 0, hor + (sky - hor) * np.clip(y * 1.6, 0, 1),
                 hor + (flo - hor) * np.clip(-y * 2.5, 0, 1))
    c = c * (0.75 + 0.25 * np.clip(d[:, 0:1] + 0.6, 0, 1))
    c = c + 1.6 * np.exp(-((y - 0.18) / 0.06) ** 2) * (d[:, 2:3] > -0.2)          # softbox strip
    c = c + 1.1 * np.exp(-((d[:, 0:1] - 0.75) / 0.08) ** 2) * (y > -0.1)          # vertical strip
    return c


def fres(f0, ndv):
    return f0 + (1 - f0) * (1 - ndv) ** 5


def shade(kind, n, v, base, ao):
    ndv = np.clip((n * v).sum(-1, keepdims=True), 0, 1)
    refl = env(norm(2 * (n * v).sum(-1, keepdims=True) * n - v))
    col = np.zeros_like(n)
    sp = {'metal': 120, 'lacquer': 90, 'glass': 240}[kind]
    for L, k, lc in LIGHTS:
        ndl = np.clip((n * L).sum(-1, keepdims=True), 0, 1)
        nh = np.clip((n * norm(L + v)).sum(-1, keepdims=True), 0, 1)
        if kind == 'metal':
            col += base * ndl * 0.03 * k * lc + 0.5 * k / 4.2 * nh ** sp * lc
        else:
            col += base * (0.08 + 0.22 * ndl) * k / 4.2 * lc + 0.35 * k / 4.2 * nh ** sp * lc
    if kind == 'metal':
        col += refl * fres(base, ndv) * 0.95
    elif kind == 'glass':
        col += refl * fres(0.06, ndv) * 1.1 + np.array([0, .12, .25]) * (1 - ndv) ** 3 * 0.3
    else:
        col += refl * fres(0.04, ndv) * 0.75 + base * (1 - ndv) ** 3 * 0.35
    return col * ao


def render(scene, material, pose, scale, out):
    R = rot(*pose)
    xs = (np.arange(N) + 0.5) / N * 2 - 1
    X, Y = np.meshgrid(xs, -xs)
    ro = np.array([0, 0, 5.0])
    rd = norm(np.stack([X * 0.33, Y * 0.33, -np.ones_like(X)], -1).reshape(-1, 3))
    ro_o = (R.T @ ro) / scale             # march in object space
    rd_o = rd @ R
    t = np.full(len(rd), 2.5 / scale)
    hit = np.zeros(len(rd), bool)
    alive = np.ones(len(rd), bool)
    step = 0.9 if scene is scene_ribbon else 1.0
    for _ in range(300):
        idx = np.nonzero(alive)[0]
        if not len(idx):
            break
        d, _ = scene(ro_o + rd_o[idx] * t[idx, None])
        t[idx] += d * step
        h = d < 0.0008
        hit[idx[h]] = True
        alive[idx[h]] = False
        alive[idx[t[idx] > 7.5 / scale]] = False
    idx = np.nonzero(hit)[0]
    p = ro_o + rd_o[idx] * t[idx, None]
    k = np.array([[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]], float)
    n = norm(sum(k[i] * scene(p + k[i] * 0.0015)[0][:, None] for i in range(4)))
    _, mid = scene(p)
    occ = np.zeros(len(p))
    for i in range(1, 6):
        occ += (0.06 * i - scene(p + n * 0.06 * i)[0]) * 0.5 ** i
    ao = np.clip(1 - 2.4 * occ, 0.35, 1)[:, None]
    col = material(p, n, mid, n @ R.T, -rd[idx], ao)
    col = 1 - np.exp(-1.75 * np.clip(col, 0, None))          # tone map
    img = np.zeros((N * N, 4))
    img[idx, :3] = col
    img[idx, 3] = 1
    img = img.reshape(SIZE, SS, SIZE, SS, 4).mean((1, 3))     # premultiplied downsample
    a = img[..., 3:4]
    rgb = np.where(a > 0, img[..., :3] / np.maximum(a, 1e-6), 0)
    im = Image.fromarray((np.clip(np.concatenate([rgb, a], -1), 0, 1) * 255).astype(np.uint8), 'RGBA')
    im = im.crop(im.getbbox())
    w, h = im.size
    s = max(w, h) + 32
    sq = Image.new('RGBA', (s, s))
    sq.paste(im, ((s - w) // 2, (s - h) // 2))
    sq.resize((OUT, OUT), Image.LANCZOS).save(out, 'WEBP', quality=90, method=6)
    print(out, os.path.getsize(out))


# ---------- brand materials ----------
GREEN = np.array([0.0, 0.42, 0.20])
RED = np.array([0.95, 0.06, 0.08])
GOLD = np.array([1.0, 0.80, 0.18])
SILVER = np.array([0.86, 0.88, 0.90])
CELL = np.array([0.02, 0.06, 0.16])
WARM = np.array([1.05, .97, .8])


def mat_panel(p, n, mid, nw, v, ao):
    top = n[:, 1] > 0.6
    x, z = p[:, 0], p[:, 2]
    frame = (np.abs(x) > 0.97) | (np.abs(z) > 0.64) | ~top
    gx = np.abs(((x + 0.96) / (1.92 / 10)) % 1 - 0.5) > 0.46     # 10 x 6 cells
    gz = np.abs(((z + 0.63) / (1.26 / 6)) % 1 - 0.5) > 0.44
    bus = np.abs(((x + 0.96) / (1.92 / 30)) % 1 - 0.5) > 0.485   # busbars
    line = (gx | gz | bus) & ~frame
    metal = shade('metal', nw, v, SILVER, ao)
    out = np.where(frame[:, None], metal, shade('glass', nw, v, CELL, ao))
    return np.where(line[:, None], out * 0.4 + metal * 0.6, out)


def mat_sun(p, n, mid, nw, v, ao):
    ndv = np.clip((nw * v).sum(-1, keepdims=True), 0, 1)
    glow = np.array([1.0, 0.62, 0.08]) * (0.55 + 0.45 * ndv) * 0.9   # self-lit core
    sun = shade('metal', nw, v, GOLD, ao) * WARM * 0.8 + glow
    return np.where(mid[:, None] == 0, sun, shade('lacquer', nw, v, GREEN, ao))


def mat_battery(p, n, mid, nw, v, ao):
    y = p[:, 1]
    out = np.where((y > 0.62)[:, None], shade('metal', nw, v, SILVER, ao),
                   shade('lacquer', nw, v, GREEN, ao))
    bars = np.zeros(len(y), bool)
    for c in (-0.55, -0.25, 0.05):        # charge level bands
        bars |= np.abs(y - c) < 0.07
    out = np.where((bars & (y <= 0.62))[:, None], shade('metal', nw, v, GOLD, ao) * WARM, out)
    return np.where((mid == 1)[:, None], shade('lacquer', nw, v, np.array([.05, .05, .05]), ao), out)


def mat_ribbon(p, n, mid, nw, v, ao):
    _, qy = twist_q(p, 0.92)
    return np.where((qy > 0)[:, None], shade('lacquer', nw, v, RED, ao),
                    shade('lacquer', nw, v, GREEN, ao))


if __name__ == '__main__':
    o = sys.argv[1]
    render(scene_panel, mat_panel, (48, 24, -18), 1.0, os.path.join(o, 'obj-panel.webp'))
    render(scene_sun, mat_sun, (12, -20, -8), 0.95, os.path.join(o, 'obj-sun.webp'))
    render(scene_battery, mat_battery, (16, 18, -16), 0.9, os.path.join(o, 'obj-battery.webp'))
    render(scene_ribbon, mat_ribbon, (64, 18, -30), 1.0, os.path.join(o, 'obj-ribbon.webp'))
