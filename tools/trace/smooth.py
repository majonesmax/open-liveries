# Smooth a shape file's fuselage lines (crown, belly, halfWidth; docs/SHAPES.md): the traced points are a scan's
# pixels, so a curve comes out as straight runs and small stairs. The crown and belly are resampled as one line round
# the nose tip, eased with a Gaussian (sigma 0.12 m; 0.8 m under the nose, 0.4 m under the tail cone), and thinned back to the points needed to
# stay within 5 mm. Stairs of a few cm go, the tip is round, and a real corner (an Airbus windshield's step) is
# rounded over a quarter of a meter. The plan's width, the fin's, wings', tailplane's, wingtip's and engines' lines
# are eased the same way, their ends held.
#
# Usage: smooth.py [--parts] shapes/<TYPE>.json [...]   (rewrites the files in place, keeping their layout)
import json, math, re, subprocess, sys
import numpy as np

SIGMA, NOSE_SIGMA, TAIL_SIGMA, STEP = 0.12, 0.8, 0.4, 0.01


def thin(pts, tol=0.005):
    """Ramer–Douglas–Peucker, in meters."""
    pts = np.asarray(pts, float)
    if len(pts) < 3: return pts.tolist()
    a, b = pts[0], pts[-1]
    ab = b - a; n = math.hypot(*ab) or 1.0
    d = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / n
    i = int(np.argmax(d))
    if d[i] <= tol: return [a.tolist(), b.tolist()]
    return thin(pts[: i + 1], tol)[:-1] + thin(pts[i:], tol)


def ease(p, sigmas, joint):
    """Points along a line every STEP, each the Gaussian average of its neighbours at its own sigma; the window
    shrinks toward the ends, so they stay put, and a wide one stops at point `joint` (the nose tip), so the belly's
    ease doesn't reach round onto the crown."""
    seg = np.hypot(*np.diff(p, axis=0).T); s = np.concatenate([[0], np.cumsum(seg)])
    t = np.append(np.arange(0, s[-1], STEP), s[-1])
    q = np.column_stack([np.interp(t, s, p[:, 0]), np.interp(t, s, p[:, 1])])
    sig = np.interp(t, s, sigmas); j = int(np.searchsorted(t, s[joint]))
    out = q.copy()
    for i in range(1, len(q) - 1):
        r = min(int(3 * sig[i] / STEP), i, len(q) - 1 - i)
        if sig[i] > SIGMA: r = min(r, max(abs(i - j), int(3 * SIGMA / STEP)))
        w = np.exp(-0.5 * (np.arange(-r, r + 1) * STEP / sig[i]) ** 2)
        out[i] = (q[i - r : i + r + 1] * w[:, None]).sum(0) / w.sum()
    return out


def smooth(fuselage):
    """The belly (tail to nose) and the crown (nose to tail) as one line round the nose tip, eased, then split again at
    its foremost point (x 0). The belly's nose, convex (build.py), gets a wider ease, so it rounds instead of
    running in straight chords."""
    crown, belly, L = fuselage['crown'], fuselage['belly'], fuselage['length']
    ref = np.interp(0.25 * L, *np.asarray(belly).T)
    nose_end = next(x for x, v in belly if x > 0.02 and v - ref <= 0.03)
    line = np.asarray(belly[::-1] + crown, float)
    on_belly = np.arange(len(line)) < len(belly)
    x = line[:, 0]   # the wide ease from a meter behind the tip to a meter past the nose, eased in and out over a meter
    ramp = np.clip(np.minimum((x - 0.3) / 1.0, (nose_end + 2 - x) / 1.0), 0, 1)
    # and under the tail cone, from 65% of the length on (the end itself is held)
    tail = np.clip((x / L - 0.65) / 0.1, 0, 1)
    sigmas = np.where(on_belly, np.maximum(SIGMA + (NOSE_SIGMA - SIGMA) * ramp, SIGMA + (TAIL_SIGMA - SIGMA) * tail), SIGMA)
    out = ease(line, sigmas, len(belly) - 1)
    tip = int(np.argmin(out[:, 0])); out[:, 0] -= out[tip, 0]
    r3 = lambda pts: [[round(float(x), 3), round(float(y), 3)] for x, y in pts]
    b = out[: tip + 1][::-1]; c = out[tip:]
    b[:, 0] = np.maximum.accumulate(b[:, 0]); c[:, 0] = np.maximum.accumulate(c[:, 0])   # x never runs backward
    b[-1, 0] = c[-1, 0] = L
    return r3(thin(c)), r3(thin(b))


def ease_line(line):
    """Any other line (the fin's, a wing's, an engine's): eased at SIGMA along its length, its ends held."""
    if len(line) < 3:
        return line
    p = np.asarray(line, float)
    return [[round(float(a), 3), round(float(b), 3)] for a, b in thin(ease(p, np.full(len(p), SIGMA), 0))]


def write(path, text, shape):
    """In the file's own layout: one space an indent and a point a line (the first shapes), or Prettier's."""
    if text.startswith('{\n "'):
        out = re.sub(r'\[\s+(-?[0-9.e-]+),\s+(-?[0-9.e-]+)\s+\]', r'[\1, \2]', json.dumps(shape, indent=1, ensure_ascii=False))
        open(path, 'w').write(out + '\n')
    else:
        open(path, 'w').write(json.dumps(shape, indent=2, ensure_ascii=False) + '\n')
        subprocess.run(['npx', 'prettier', '--write', path], check=True, capture_output=True)


# --parts: the fin, wings, tailplane, wingtip and engines only (a shape whose fuselage is already eased).
parts_only = '--parts' in sys.argv
for path in [a for a in sys.argv[1:] if a != '--parts']:
    text = open(path).read(); shape = json.loads(text); fu = shape['fuselage']
    if not parts_only:
        fu['crown'], fu['belly'] = smooth(fu)
        h = np.asarray(fu['halfWidth'], float)   # the plan's width (3D models are built on it): eased the same
        w = ease(h, np.full(len(h), SIGMA), 0); w[:, 0] = np.maximum.accumulate(w[:, 0])
        fu['halfWidth'] = [[round(float(a), 3), round(float(b), 3)] for a, b in thin(w)]
    for part, keys in (('fin', ('leading', 'trailing', 'rudder', 'fillet')), ('wing', ('leading', 'trailing', 'z')),
                       ('stabilizer', ('leading', 'trailing', 'z')), ('wingtip', ('leading', 'trailing', 'front'))):
        for k in keys:
            if shape.get(part, {}).get(k):
                shape[part][k] = ease_line(shape[part][k])
    for engine in shape['engines']:
        engine['top'], engine['bottom'] = ease_line(engine['top']), ease_line(engine['bottom'])
        if 'halfWidth' in engine: engine['halfWidth'] = ease_line(engine['halfWidth'])   # a tail engine's, from above
        for k in engine.get('nozzle', {}): engine['nozzle'][k] = ease_line(engine['nozzle'][k])
    if shape['fuselage'].get('hump'):                                  # an upper deck's top (a 747's)
        shape['fuselage']['hump']['crown'] = ease_line(shape['fuselage']['hump']['crown'])
    write(path, text, shape)
    print(shape['id'], 'eased')
