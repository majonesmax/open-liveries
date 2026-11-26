# The DC-9s' straight parts made straight (after smooth.py): the 1984 sheet is a 1-bit scan, and its traced crown
# and belly step by a pixel (about 2 cm) every meter or so along the cabin, too small and too long for smooth.py's
# ease. On the aircraft the tube is a cylinder from behind the cockpit to the tail and the fin's leading edge is a
# straight line, so those runs are set to their least-squares line, and the crown where it starts down to the tail
# cone under the fin's fillet is eased over half a meter.
#
# Usage: straighten.py shapes/DC93.json   (DC91, DC95 too; after smooth.py and any fit_height.py; then windshield.py)
import json, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from smooth import write  # noqa: E402  (the shapes' own layout)

path = sys.argv[1]
text = open(path).read()
s = json.loads(text)
fus, fin = s["fuselage"], s["fin"]
# Per shape, in meters from the nose: the crown's and belly's level runs, the crown eased where it starts down to the
# tail cone, and the fin's leading edge's straight run.
RUNS = {
    "DC93": ((5.6, 25.0), (5.1, 22.4), (25.0, 28.6), (28.6, 30.8)),
    "DC91": ((5.8, 22.0), (5.3, 18.3), (22.0, 24.1), (24.1, 26.2)),
    "DC95": ((5.3, 31.5), (4.9, 26.0), (31.5, 33.6), (33.6, 35.2)),
}
CROWN, BELLY, EASE, LEAD = RUNS[s["id"]]


def flat(pts, x0, x1):
    """Points from x0 to x1 replaced by the least-squares line through them (two points)."""
    inside = [p for p in pts if x0 <= p[0] <= x1]
    a, b = np.polyfit([p[0] for p in inside], [p[1] for p in inside], 1)
    return [p for p in pts if p[0] < x0] + [[x0, round(a * x0 + b, 3)], [x1, round(a * x1 + b, 3)]] + [p for p in pts if p[0] > x1]


def ease_z(pts, x0, x1, width=0.5):
    """z eased along x between x0 and x1, the ends held: a locally weighted quadratic at each point (as A30B's)."""
    p = np.array(pts, float); out = p.copy()
    rng = (p[:, 0] >= x0) & (p[:, 0] <= x1)
    for i, (x, z) in enumerate(p):
        if x0 < x < x1:
            w = np.exp(-0.5 * ((p[:, 0] - x) / width) ** 2) * rng
            k = w > 1e-3
            out[i, 1] = np.polyfit(p[k, 0] - x, p[k, 1], 2, w=np.sqrt(w[k]))[-1]
    return [[round(x, 3), round(z, 3)] for x, z in out]


fus["crown"] = ease_z(flat(fus["crown"], *CROWN), *EASE)
fus["belly"] = flat(fus["belly"], *BELLY)
lead = fin["leading"]
line = [p for p in lead if LEAD[0] <= p[0] <= LEAD[1]]
a, b = np.polyfit([p[0] for p in line], [p[1] for p in line], 1)
x0, x1 = line[0][0], line[-1][0]
fin["leading"] = [p for p in lead if p[0] < x0] + [[x, round(a * x + b, 3)] for x in (x0, x1)] + [p for p in lead if p[0] > x1]
write(path, text, s)
print(s["id"], "straightened")
