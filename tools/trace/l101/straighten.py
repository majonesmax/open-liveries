# The L-1011-1's straight parts made straight (after build.py, smooth.py --parts): the maintenance manual's figure is
# a coarse scan (about 32 px a meter, lines 5-8 px thick), and its traced crown, belly and fin edges zigzag by up to
# 0.1-0.2 m every half meter. On the aircraft the tube is a cylinder from behind the flight deck to the tail's
# upsweep and the fin's leading and trailing edges are straight, so those runs are set to their least-squares line.
# The nose's crown is eased over a meter. The plan's side is held at its drawn half-width (2.91 m) along the tube: the trace had picked up the wing root's
# fairing and a flap-track bump drawn on it.
#
# Usage: straighten.py shapes/L101.json   (after smooth.py --parts; then windshield.py)
import json, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from smooth import write  # noqa: E402  (the shapes' own layout)

path = sys.argv[1]
text = open(path).read()
s = json.loads(text)
fus, fin = s["fuselage"], s["fin"]


def flat(pts, x0, x1, i=0, j=1):
    """Points from x0 to x1 (along coordinate i) replaced by the least-squares line through them (two points)."""
    inside = [p for p in pts if x0 <= p[i] <= x1]
    a, b = np.polyfit([p[i] for p in inside], [p[j] for p in inside], 1)
    ends = []
    for x in (x0, x1):
        q = [0.0, 0.0]; q[i] = x; q[j] = round(float(a * x + b), 3); ends.append(q)
    return [p for p in pts if p[i] < x0] + ends + [p for p in pts if p[i] > x1]


def ease_z(pts, x0, x1, width=0.5):
    """z eased along x between x0 and x1, the ends held: a locally weighted quadratic (a Gaussian of `width` m)
    through the points in that range, so the nose's curve stays (as tools/trace/a30b/straighten.py)."""
    p = np.array(pts, float); out = p.copy()
    rng = (p[:, 0] >= x0) & (p[:, 0] <= x1)
    for i, (x, z) in enumerate(p):
        if x0 < x < x1:
            w = np.exp(-0.5 * ((p[:, 0] - x) / width) ** 2) * rng
            k = w > 1e-3
            c = np.polyfit(p[k, 0] - x, p[k, 1], 2, w=np.sqrt(w[k]))
            out[i, 1] = c[-1]
    return [[round(x, 3), round(z, 3)] for x, z in out]


# The nose's crown: the scan steps 0.15 m up at 8 m (its line running into the cabin's); eased over a meter.
fus["crown"] = ease_z(flat(fus["crown"], 9.6, 40.5), 1.0, 9.6, 1.0)
fus["belly"] = flat(fus["belly"], 12.2, 37.5)
hw = fus["halfWidth"]
fus["halfWidth"] = [p for p in hw if p[0] < 10.3] + [[10.3, 2.91], [38.5, 2.91]] + [p for p in hw if p[0] > 38.5]
# The fin's edges: x along z (coordinate 1 is the height).
fin["leading"] = flat(fin["leading"], 7.754, 11.4, i=1, j=0)
fin["trailing"] = flat(fin["trailing"], 5.48, 11.49, i=1, j=0)
write(path, text, s)
print("L101 straightened")
