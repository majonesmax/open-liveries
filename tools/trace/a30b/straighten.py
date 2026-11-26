# The A300B4's straight parts made straight (after smooth.py): the 1980 sheet is a scan, and its traced crown, belly
# and fin leading edge zigzag by a couple of centimeters every half meter, too long a wave for smooth.py's ease. On
# the aircraft the tube is a cylinder from behind the cockpit to the tail and the fin's leading edge is a straight
# line, so those runs are set to their least-squares line, and the nose's crown is eased over half a meter.
#
# Usage: straighten.py shapes/A30B.json   (after smooth.py --parts; then windshield.py)
import json, sys
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


def ease_z(pts, x0, x1, width=0.5):
    """z eased along x between x0 and x1, the ends held: at each point, a locally weighted quadratic (a Gaussian of
    `width` m) through the points in that range. A plain weighted mean pulls a curving line inward and, beside a
    held end, lifts it one-sidedly (a 0.3 m step behind the nose tip); the local quadratic keeps the nose's curve."""
    p = np.array(pts, float); out = p.copy()
    rng = (p[:, 0] >= x0) & (p[:, 0] <= x1)
    for i, (x, z) in enumerate(p):
        if x0 < x < x1:
            w = np.exp(-0.5 * ((p[:, 0] - x) / width) ** 2) * rng
            k = w > 1e-3
            c = np.polyfit(p[k, 0] - x, p[k, 1], 2, w=np.sqrt(w[k]))
            out[i, 1] = c[-1]
    return [[round(x, 3), round(z, 3)] for x, z in out]


fus["crown"] = ease_z(flat(fus["crown"], 7.5, 38.6), 0.93, 7.5)
fus["belly"] = flat(fus["belly"], 8.9, 32.5)
lead = fin["leading"]
line = [p for p in lead if 43.4 <= p[0] <= 49.3]
a, b = np.polyfit([p[0] for p in line], [p[1] for p in line], 1)
fin["leading"] = [p for p in lead if p[0] < 43.4] + [[x, round(a * x + b, 3)] for x in (43.46, 49.208)] + [p for p in lead if p[0] > 49.3]
write(path, text, s)
print("A30B straightened")
