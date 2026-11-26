# The A300-600F's straight parts made straight (after smooth.py), as a30b/straighten.py does for the B4: the 1994
# sheet is a scan, and its traced crown and belly
# zigzag by a couple of centimeters every half meter, too long a wave for smooth.py's ease (its fin's edges are
# straight lines already, placed as free points). On the aircraft the tube is a cylinder from behind the cockpit to
# the tail, so those runs are set to their least-squares line (the scan rises 0.2° over the cabin: kept), and the
# nose's crown is eased over half a meter. It also says where a passenger A300-600's windows would be
# (cabin.windows.wouldBe), for paint drawn beside them: the A300B4's first (shapes/A30B, the same nose) and its
# last moved by the -600's 0.47 m (plan.py).
#
# Usage: straighten.py shapes/A306.json   (after smooth.py; then windshield.py)
import json, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from smooth import write  # noqa: E402  (the shapes' own layout)

path = sys.argv[1]
text = open(path).read()
s = json.loads(text)
fus = s["fuselage"]


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


fus["crown"] = ease_z(flat(fus["crown"], 7.6, 40.9), 0.93, 7.6)
fus["belly"] = flat(fus["belly"], 8.6, 31.6)
b4 = json.load(open(Path(path).parent / "A30B.json"))["cabin"]["windows"]
s["cabin"]["windows"] = {"z": b4["z"], "width": b4["width"], "x": [],
                         "note": ("The A300-600F has no cabin windows. Its z and wouldBe: where a passenger A300-600's are (the "
                                  "A300B4's, shapes/A30B, the same section and nose; the last moved by the -600's 0.47 m longer "
                                  "aft fuselage): for fitting paint drawn beside windows."),
                         "wouldBe": [b4["x"][0], round(b4["x"][-1] + 0.47, 3)]}
write(path, text, s)
print("A306 straightened")
