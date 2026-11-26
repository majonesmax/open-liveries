# The 727-200F's tail made straight and clean (after build.py and smooth.py): 2.2's 1978 scan is drawn on graph paper,
# and where the trace crossed the grid's lines its fin edges, the S-duct's intake fairing and the tailplane step and
# wobble by 2-6 cm. On the aircraft the fin's leading and trailing edges, the rudder's hinge line, the fairing's top,
# the tail cone's top under it and the tailplane's edges are straight lines, and the corners between them are curves.
# So each is set to a least-squares line or a fitted curve through the scan's line centres (layers.py --mode image at
# scale 5, clip 110,330,525,432 for the side and 110,65,500,345 for the plan, as the anchors), the points the trace
# picked along it agreeing within 2-5 cm. In meters; the side raster's pixels are x = 46 + 39.602 m, z = 8.586 - px /
# 39.602 (the trace's scale and crown). Fitted on the scan:
#
#   fin leading edge         34.4 deg, rms 0.9 cm over 36.1-39.5 m      trailing edge   46.4 deg, rms 1.3 cm
#   rudder hinge line        42.0 deg, rms 1.3 cm                        fin tip's top   level at 6.818 m to 40.24 m,
#   fin tip's corner         an arc of 0.93 m (rms 0.6 cm)                               then falling as the 3.1th power
#   fin tip fairing's        a parabola from the trailing edge to its                    of the distance to the point
#     underside              point (rms 1.2 cm)                                          behind it (rms 1.3 cm)
#   intake fairing's top     rising 1.3 deg, rms 1.2 cm                  intake lip      raked 1.2 deg, rms 1.3 cm
#   its nose corner          an arc of 0.29 m (rms 2.2 cm)               its fillet into the fin: an arc of 1.2 m
#   under the lip            the lower lip's step back to the fairing's face (0.15 m) and the face down to the crown
#   tail cone's top          -7.6 deg from 31.2 m to the nozzle, rms 1.8 cm (the fairing's lower edge)
#   tailplane (plan)         leading edge x = 0.8327 y + 40.163 (rms 1.5 cm), trailing x = 0.3070 y + 44.839
#                            (1.2 cm) to the traced span, a streamwise tip; its height a line (the front view's tip
#                            rounding left out)
#
# The fin's top runs into the trailing edge (round from the point behind the tip fairing forward to the level run),
# so its chord at each height ends on the outline. The overall length (the point, 46.967 m) and the tailplane's span
# stay as traced; the fin's top is the line's centre, 5 cm under the trace's last point (a hook onto the grid line).
#
# Usage: straighten.py shapes/B722.json   (after smooth.py; then tools/trace/b722-passenger/derive.py)
import json, sys
from pathlib import Path

import numpy as np

path = sys.argv[1]
sys.argv[1:] = []                                       # smooth.py eases the files it's given when imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from smooth import write  # noqa: E402  (the shapes' own layout)

text = open(path).read()
s = json.loads(text)
r3 = lambda v: round(float(v), 3)
P = lambda pts: [[r3(x), r3(z)] for x, z in pts]


def line(point, direction):
    p, d = np.array(point, float), np.array(direction, float)
    return p, d / np.linalg.norm(d)


def z_at(ln, x):
    (p, d) = ln
    return p[1] + (x - p[0]) * d[1] / d[0]


def x_at(ln, z):
    (p, d) = ln
    return p[0] + (z - p[1]) * d[0] / d[1]


def meet(a, b):
    (p, d), (q, e) = a, b
    t = np.linalg.solve(np.c_[d, -e], q - p)
    return p + t[0] * d


def arc(a, b, radius, n=8):
    """The fillet of `radius` from line a (as it runs in) to line b (as it runs out): its points, ends included."""
    (p, d), (q, e) = a, b
    corner = meet(a, b)
    half = np.arccos(np.clip(-d @ e, -1, 1)) / 2
    t1, t2 = corner - d * radius / np.tan(half), corner + e * radius / np.tan(half)
    turn = np.sign(d[0] * e[1] - d[1] * e[0])
    centre = t1 + turn * np.array([-d[1], d[0]]) * radius
    a1, a2 = np.arctan2(*(t1 - centre)[::-1]), np.arctan2(*(t2 - centre)[::-1])
    if turn > 0 and a2 < a1: a2 += 2 * np.pi
    if turn < 0 and a2 > a1: a2 -= 2 * np.pi
    return [centre + radius * np.array([np.cos(t), np.sin(t)]) for t in np.linspace(a1, a2, n + 1)]


LEAD = line((38.1196, 5.5658), (0.82542, 0.56452))      # the fin's leading edge
TRAIL = line((42.387, 3.512), (0.68969, 0.7241))        # its trailing edge
HINGE = line((40.7637, 3.6123), (0.74296, 0.66934))     # the rudder's hinge line
TOP = 6.818                                             # the fin tip's level top
POINT = np.array([46.967, 6.212])                       # the tip fairing's point (the trace's: the overall length)
CONE = line((35.423, 1.6393), (0.99119, -0.13242))      # the tail cone's top, under the intake fairing
FAIRING = line((33.0898, 3.8517), (0.99974, 0.02262))   # the intake fairing's top
LIP = line((30.3389, 3.1594), (0.02135, -0.99977))      # the intake's lip, running down
FACE_X = 30.50                                          # the fairing's face under the lip (the renderer reads the
                                                        # bottom as a function of x: it's upright, a hair aft)
LIP_FOOT = 2.614                                        # the lower lip's step back to the face

fin = s['fin']
tail = next(e for e in s['engines'] if e.get('mount') == 'tail')
crown = s['fuselage']['crown']
old = {k: [list(p) for p in fin[k]] for k in ('leading', 'trailing', 'rudder')}
old_tip = max(z for x, z in fin['leading'] + fin['trailing'])

# The tail cone's top from where it starts down (31.198 m) to the nozzle (40.105 m): its line.
X0, X1 = 31.198, 40.105
crown[:] = [p for p in crown if p[0] < X0] + P([[X0, z_at(CONE, X0)], [X1, z_at(CONE, X1)]]) + [p for p in crown if p[0] > X1]

# The fin. Leading edge: its root (where the trace starts it, inside the fairing's fillet) straight up to the tip's
# corner, round it to the level top.
root_x = old['leading'][0][0]
level = line((40.0, TOP), (1.0, 0.0))
corner = arc(LEAD, level, 0.934)
fin['leading'] = P([[root_x, z_at(LEAD, root_x)]] + corner)
# Trailing edge: from the tail cone's top straight up to the tip fairing's underside, along it (a parabola through the
# scan's centres) to the point, then forward along the top's fall to the level run.
foot = meet(TRAIL, CONE)
B, C = 0.38999, 0.058159                                 # underside: z = POINT + B dx + C dx², dx back from the point
under = lambda x: POINT[1] + B * (x - POINT[0]) + C * (x - POINT[0]) ** 2
lo, hi = TRAIL[0][0] + 0.5, POINT[0] - 0.01
for _ in range(60):                                      # where the trailing edge meets it (bisection)
    mid = (lo + hi) / 2
    if under(mid) > z_at(TRAIL, mid): lo = mid
    else: hi = mid
joint = np.array([lo, under(lo)])
xs = corner[-1][0]
fall = lambda x: TOP - (TOP - POINT[1]) * ((x - xs) / (POINT[0] - xs)) ** 3.106
fin['trailing'] = P(
    [foot, joint]
    + [[x, under(x)] for x in np.arange(joint[0] + 0.25, POINT[0] - 0.1, 0.25)]
    + [POINT]
    + [[x, fall(x)] for x in np.arange(POINT[0] - 0.15, xs + 0.4, -0.25)]
)
z0, z1 = old['rudder'][0][1], old['rudder'][-1][1]
fin['rudder'] = P([[x_at(HINGE, z0), z0], [x_at(HINGE, z1), z1]])

# The S-duct's intake fairing. Top: up the lip from where top and bottom part (2.98 m), round its nose onto the
# fairing's top, along it and up its fillet into the fin's leading edge, then hidden under the fin to the trailing
# edge (as traced: the fin's paint covers it there). Bottom: down the lip to the lower lip's step, back to the face,
# down it to the crown, along the crown and the tail cone's top to the trailing edge's foot and up it.
SPLIT = 2.98
up = (LIP[0], -LIP[1])
nose = arc(up, FAIRING, 0.285)
fillet = arc(FAIRING, LEAD, 1.205)
end_z = tail['top'][-1][1]
end = [x_at(TRAIL, end_z), end_z]
front = [x_at(LIP, SPLIT), SPLIT]
tail['top'] = P([front] + nose + fillet + [end])
face_foot_x = FACE_X + 0.003
on_crown = [p for p in crown if face_foot_x < p[0] < foot[0]]
face_foot = [face_foot_x, np.interp(face_foot_x, *np.array(crown).T)]
tail['bottom'] = P(
    [front, [x_at(LIP, LIP_FOOT), LIP_FOOT], [FACE_X, LIP_FOOT], face_foot] + on_crown + [foot, end]
)
tail['x'][0] = r3(min(tail['top'][0][0], tail['bottom'][0][0], tail['top'][1][0]))

# The tailplane: straight edges in plan to the traced span, a streamwise tip, its height a line.
st = s['stabilizer']
y0, y1 = st['leading'][0][0], st['leading'][-1][0]
st['leading'] = P([[y, 0.8327 * y + 40.1634] for y in (y0, y1)])
st['trailing'] = P([[y, 0.3070 * y + 44.8394] for y in (st['trailing'][0][0], st['trailing'][-1][0])])
zs = np.array([p for p in st['z'] if p[0] <= 4.63] if len(st['z']) > 2 else st['z'])   # (run again: its line)
a, b = np.polyfit(zs[:, 0], zs[:, 1], 1)
st['z'] = P([[y, a * y + b] for y in (st['z'][0][0], st['z'][-1][0])])

# How far the straightened lines sit from the trace's own points along them (the trace's wobble, not a shift).
for name, pts, ln in (('leading', old['leading'], LEAD), ('trailing', old['trailing'], TRAIL), ('rudder', old['rudder'], HINGE)):
    along = [abs(z - z_at(ln, x)) * abs(ln[1][0]) for x, z in pts if 36.2 <= x <= 39.2 or (name != 'leading' and 40.6 <= x <= 44.0)]
    print(f'fin.{name}: trace within {max(along, default=0):.3f} m of its line')
NOTE = (" The tail's straight edges (the fin's, the rudder's hinge line, the intake fairing's top and lip, the tail cone's"
        " top under it, the tailplane's) are set to their least-squares lines through the scan's line centres and its"
        " corners to fitted curves, the grid's steps left out (tools/trace/b722/straighten.py).")
if NOTE not in s['sources'][0]['note']:
    s['sources'][0]['note'] += NOTE
# The fin tip's check (build.py's: its highest point less the crown) follows the tip's new height.
check = next(c for c in s['checks'] if c['dimension'] == 'fin tip above the crown')
check['shape'] = r3(check['shape'] - (old_tip - max(z for x, z in fin['leading'] + fin['trailing'])))
check['off'] = f"{100 * (check['shape'] / check['printed'] - 1):+.1f}%"
write(path, text, s)
print(path, 'straightened: fin root', fin['leading'][0], 'tip', TOP, 'trailing foot', fin['trailing'][0], 'joint', P([joint])[0])
