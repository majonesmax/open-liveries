# The BAe 146-200's straight parts made straight, and its tapering lines eased (after build.py and smooth.py; then
# windshield.py), and the schematic's ground-line and gear checks added. The schematic is a small picture (about 21 px a meter, rasterized at 4 px a pixel), so every traced
# line is a staircase of 1.2 cm steps, longer than smooth.py's ease takes out. On the aircraft the cabin is a
# cylinder, so the crown, belly and plan width along it are set to their least-squares lines; the nose and the
# tapering tail are eased by a locally weighted quadratic (a30b/straighten.py's) and thinned back to 5 mm.
#
# Usage: straighten.py shapes/B462.json
import json, math, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from smooth import write  # noqa: E402  (the shapes' own layout)

path = sys.argv[1]
text = open(path).read()
s = json.loads(text)
fus, fin = s["fuselage"], s["fin"]


def flat(pts, x0, x1):
    """Points from x0 to x1 replaced by the least-squares line through them (two points)."""
    inside = [p for p in pts if x0 <= p[0] <= x1]
    xs, zs = np.array([p[0] for p in inside]), np.array([p[1] for p in inside])
    a, b = np.polyfit(xs, zs, 1)
    return [p for p in pts if p[0] < x0] + [[x0, round(a * x0 + b, 3)], [x1, round(a * x1 + b, 3)]] + [p for p in pts if p[0] > x1]


def dense(pts, step=0.05):
    """The line resampled every `step` m along x (a staircase's corners alone weight the ease unevenly)."""
    p = np.array(sorted(pts), float)
    xs = np.unique(np.concatenate([np.arange(p[0, 0], p[-1, 0], step), p[:, 0]]))
    return np.c_[xs, np.interp(xs, p[:, 0], p[:, 1])]


def ease_z(pts, x0, x1, width=0.5):
    """z eased along x between x0 and x1, the ends held: a locally weighted quadratic (a Gaussian of `width` m)."""
    p = dense(pts); out = p.copy()
    rng = (p[:, 0] >= x0) & (p[:, 0] <= x1)
    for i, (x, z) in enumerate(p):
        if x0 < x < x1:
            w = np.exp(-0.5 * ((p[:, 0] - x) / width) ** 2) * rng
            k = w > 1e-3
            c = np.polyfit(p[k, 0] - x, p[k, 1], 2, w=np.sqrt(w[k]))
            out[i, 1] = c[-1]
    return out.tolist()


def thin(pts, tol=0.005):
    pts = np.asarray(pts, float)
    if len(pts) < 3: return pts.tolist()
    a, b = pts[0], pts[-1]
    ab = b - a; n = math.hypot(*ab) or 1.0
    d = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / n
    i = int(np.argmax(d))
    if d[i] <= tol: return [a.tolist(), b.tolist()]
    return thin(pts[: i + 1], tol)[:-1] + thin(pts[i:], tol)


r3 = lambda pts: [[round(float(x), 3), round(float(z), 3)] for x, z in pts]
L = fus["length"]
# The cabin set flat (the crown 4.8-16.3 m, the belly 4.6-17.4 m, the plan's width 4.7-17.9 m), then the nose and the
# tapering tail eased on into it, so they meet the flat run without a step.
fus["crown"] = r3(thin(ease_z(ease_z(flat(fus["crown"], 4.8, 16.3), 0.3, 6.0, 0.25), 15.3, L - 0.15, 0.6)))
fus["belly"] = r3(thin(ease_z(ease_z(flat(fus["belly"], 4.6, 17.4), 0.15, 6.0, 0.3), 16.4, L - 0.1, 0.6)))
fus["halfWidth"] = r3(thin(ease_z(ease_z(flat(fus["halfWidth"], 4.7, 17.9), 0.15, 6.0, 0.3), 16.9, L, 0.6)))
# Checks the shape's lines can't give: the schematic's own ground line and gear (side and front rasters' px, line
# centres, at 85.04 px a meter), against EASA's figures. The height is from the ground line (774) to the fin-top
# fairing's top (43); the wheelbase from the nose wheel's middle (219) to the main wheel's (1182.5); the track
# between the main gear's wheel pairs' middles in the front view (963 and 1345.5).
PPM = 85.04
for name, printed, drawn in (("height (ground to the fin's top)", 8.61, (774 - 43) / PPM),
                             ("wheelbase", 11.20, (1182.5 - 219) / PPM),
                             ("main gear track", 4.72, (1345.5 - 963) / PPM)):
    s["checks"] = [c for c in s["checks"] if c["dimension"] != name] + [
        {"dimension": name, "printed": printed, "shape": round(drawn, 3), "off": f"{100 * (drawn / printed - 1):+.1f}%"}]
write(path, text, s)
print("B462 straightened")
