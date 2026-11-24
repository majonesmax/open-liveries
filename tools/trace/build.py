# Build a shape file (docs/SHAPES.md) from snapped outlines of a type's side, plan and front views.
#
# Usage: build.py recipe.json workdir  (reads the snapped files from workdir; writes the recipe's `out`, relative to
# the recipe)
#
# The recipe names the snapped files (snap.py), the windows and doors (features.py), and where each view's
# references sit in its raster: the nose tip and tail cone (side, plan), the centerline (plan, front), the crown's
# top (front), all as line centres. One scale serves every view (the drawing's own: its printed length over the
# nose-to-tail distance); the printed dimensions are then checks, not inputs.
import json, math, sys
from pathlib import Path
import numpy as np

recipe = json.load(open(sys.argv[1]))
here = Path(sys.argv[1]).resolve().parent
work = Path(sys.argv[2]) if len(sys.argv) > 2 else here
load = lambda name: json.load(open(work / recipe['files'][name]))
side, plan, front, feats = load('side'), load('plan'), load('front'), load('features')
R = recipe['refs']
ppm = (R['side']['tail'] - R['side']['nose']) / recipe['length']


def thin(pts, tol=0.01):
    """Ramer–Douglas–Peucker, in meters."""
    pts = np.asarray(pts, float)
    if len(pts) < 3: return pts.tolist()
    a, b = pts[0], pts[-1]
    ab = b - a; n = math.hypot(*ab) or 1.0
    d = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / n
    i = int(np.argmax(d))
    if d[i] <= tol: return [a.tolist(), b.tolist()]
    return thin(pts[: i + 1], tol)[:-1] + thin(pts[i:], tol)


def r3(pts):
    return [[round(float(a), 3), round(float(b), 3)] for a, b in pts]


def sort_by(pts, i=0):
    p = np.asarray(pts, float); return p[np.argsort(p[:, i], kind='stable')]


# Side view: x back from the nose tip, z up from the fuselage centerline (halfway between crown and belly where the
# fuselage is a constant tube: its middle third).
sx = lambda px: (px - R['side']['nose']) / ppm
crown_px, belly_px = sort_by(side['fuselage.crown']), sort_by(side['fuselage.belly'])
# An upper deck above the main tube (a 747's hump): `mainCrown` in the side refs is the main tube's crown level (px).
# The traced crown above it is the hump's (fuselage.hump.crown, from where it leaves that level to where it rejoins
# it); the main crown is held at that level beneath it, so the main tube, and the paint on it, are as on any type.
# The hump's width is the front view's `fuselage.hump` (from its top at the centerline down one side).
hump_px = None
if 'mainCrown' in R['side']:
    mc = R['side']['mainCrown']
    # The hump is the run of the crown above that level holding its highest point (a fin root's fairing further
    # aft can rise above it too, and stays the crown's).
    above = np.nonzero(crown_px[:, 1] < mc - 1)[0]
    if len(above):
        runs_ = np.split(above, np.nonzero(np.diff(above) > 1)[0] + 1)
        top = int(np.argmin(crown_px[:, 1]))
        run = next(r_ for r_ in runs_ if r_[0] <= top <= r_[-1])
        i0, i1 = max(run[0] - 1, 0), min(run[-1] + 1, len(crown_px) - 1)
        hump_px = crown_px[i0: i1 + 1].copy()
        hump_px[:, 1] = np.minimum(hump_px[:, 1], mc)
        crown_px = crown_px.copy()
        crown_px[i0: i1 + 1, 1] = np.maximum(crown_px[i0: i1 + 1, 1], mc)
L = recipe['length']
mid = np.linspace(R['side']['nose'] + L * ppm / 3, R['side']['nose'] + 2 * L * ppm / 3, 200)
ci, bi = np.interp(mid, *crown_px.T), np.interp(mid, *belly_px.T)
centre_px = float(np.median((ci + bi) / 2))
sz = lambda py: (centre_px - py) / ppm
S = lambda pts: [(sx(x), sz(y)) for x, y in pts]
height = float(np.median(bi - ci)) / ppm

# Plan view: x as the side view's, y out from the centerline.
px_ = lambda px: (px - R['plan']['nose']) / ppm
py_ = lambda py: abs(R['plan']['centerline'] - py) / ppm
P = lambda pts: [(px_(x), py_(y)) for x, y in pts]
# Front view: y out from the centerline, z tied to the side view by the crown's top (the tube's crown).
crown_z = sz(float(np.median(ci)))
fy = lambda px: abs(px - R['front']['centerline']) / ppm
fz = lambda py: crown_z - (py - R['front']['crownTop']) / ppm
F = lambda pts: [(fy(x), fz(y)) for x, y in pts]

out = {}
# Fuselage
clamp = lambda pts: [(min(max(x, 0.0), L), v) for x, v in pts]   # the nose tip and tail cone, to the line centre
def span(pts):
    """A fuselage line from the nose tip (x 0) to the tail cone (x L): its x stretched to those ends where a view's
    line stops short of the side view's references (by a line's width, or a plan drawn a little short)."""
    pts = sorted(pts); a, b = pts[0][0], pts[-1][0]
    return [((x - a) * L / (b - a), v) for x, v in pts]
def nose_hull(pts, outward=-1):
    """A nose is convex from the side: from the tip to where the line reaches the cabin's level (its height a quarter
    of the way back), keep the line's outer hull. Drops the nose gear's doors and the scan's staircase (docs/SHAPES.md)."""
    pts = sorted(pts); ref = np.interp(0.25 * L, *np.asarray(pts).T)
    end = next(i for i, (x, v) in enumerate(pts) if x > 0.02 and outward * (v - ref) >= -0.03)
    h = []
    for p in pts[: end + 1]:
        while len(h) >= 2 and outward * ((h[-1][0] - h[-2][0]) * (p[1] - h[-2][1]) - (h[-1][1] - h[-2][1]) * (p[0] - h[-2][0])) >= 0:
            h.pop()
        h.append(p)
    return h + pts[end + 1:]
crown = span(clamp(S(crown_px))); belly = nose_hull(span(clamp(S(belly_px))))
half = sort_by(span(clamp(P(plan['fuselage.halfWidth']))))
section = F(front['fuselage.section'])
widest_i = int(np.argmax([y for y, z in section]))
out['fuselage'] = {
    'length': L,
    'crown': r3(thin(crown)), 'belly': r3(thin(belly)), 'halfWidth': r3(thin(half)),
    'widest': round(section[widest_i][1], 3),
}
if hump_px is not None:
    # The width at the main crown's level; with the front view's outline carried on down to where it meets the main
    # tube's section (`fuselage.humpSection`), that outline is the deck's own cross-section.
    hs = F(front['fuselage.hump'] + front.get('fuselage.humpSection', [])[1:])        # along the outline, top down
    out['fuselage']['hump'] = {'crown': r3(thin(S(hump_px))),
                               'width': round(2 * max(y for y, z in F(front['fuselage.hump'])), 3),
                               **({'section': r3(thin(hs, 0.02))} if 'fuselage.humpSection' in front else {})}

# Fin: the straight leading edge carried down to the crown is the fin's; the fillet's curve ahead of it isn't.
lead = S(side['fin.leading']); trail = S(side['fin.trailing'])
fillet = S(side['fin.fillet']) if 'fin.fillet' in side else []
rudder = S(side['fin.rudder']) if 'fin.rudder' in side else []
k = max(3, len(lead) // 4)
straight = np.array(lead[: len(lead) // 2])                      # the straight run above the fillet
A = np.polyfit(straight[:, 1], straight[:, 0], 1)                 # x as a function of z
cz_at = lambda x: float(np.interp(x, *np.array(sorted(crown)).T))
# A tail engine's nacelle (the MD-11's) or an S-duct's intake (the 727's) stands on the crown under the fin's root: the
# leading edge meets its top there, not the crown.
if 'tail.top' in side:
    _tail_top, _crown_at = sort_by(S(side['tail.top'])), cz_at
    cz_at = lambda x: max(_crown_at(x), float(np.interp(x, *_tail_top.T, left=-1e9, right=-1e9)))
x_root = float(A[1])
for _ in range(20):                                               # where that line meets the crown
    z = cz_at(x_root); x_root = float(np.polyval(A, z))
root = (x_root, cz_at(x_root))
lead_all = [root] + [p for p in lead if p[1] > root[1]]
out['fin'] = {
    'leading': r3(thin(lead_all)), 'trailing': r3(thin(trail)),
    **({'fillet': r3(thin(fillet))} if fillet else {}), **({'rudder': r3(thin(rudder))} if rudder else {}),
}


def plan_edge(name, y_max):
    e = [p for p in P(plan[name]) if p[1] <= y_max + 1e-9]
    # From the root out: where the edge starts on the fuselage's curving side, drop what runs back inboard.
    while len(e) > 1 and e[1][1] < e[0][1] + 1e-9: e.pop(0)
    # And past it: a pixel path's step back inboard (a rounded tip curling round) isn't the edge.
    out_ = []
    for p in e:
        if not out_ or p[1] > out_[-1][1]: out_.append(p)
    e = out_
    return r3(thin([(y, x) for x, y in e]))                        # [y, x]: out from the centerline, back from the nose


def heights(upper, lower, y_max, n=60):
    """The surface's middle height along its span, from its upper and lower lines in the front view."""
    u = sort_by(F(front[upper])); l = sort_by(F(front[lower]))
    y0 = max(u[0, 0], l[0, 0]); ys = np.linspace(y0, y_max, n)
    z = (np.interp(ys, *u.T) + np.interp(ys, *l.T)) / 2
    return r3(thin(list(zip(ys, z)), 0.005))


# Wing: up to where the wingtip device rises (the front view's lines turn past 30° from the span).
up = F(front['wing.upper'])
clear = max(y for x, y in half) + 1.0                             # past the wing root's fairing on the fuselage side
def rises(i, reach=0.3):
    """The line's slope over the next ~30 cm (a pixel path's single steps are 0° or 45°)."""
    y, z = up[i]
    j = next((j for j in range(i + 1, len(up)) if math.hypot(up[j][0] - y, up[j][1] - z) >= reach), None)
    return j is not None and math.degrees(math.atan2(up[j][1] - z, abs(up[j][0] - y))) > 30
tipped = 'wingtip.leading' in side                                # a plain tip (the 777's raked one) has no device
bend = next(up[i][0] for i in range(len(up)) if up[i][0] > clear and rises(i)) if tipped else max(y for y, z in up)
out['wing'] = {'leading': plan_edge('wing.leading', bend), 'trailing': plan_edge('wing.trailing', bend),
               'z': heights('wing.upper', 'wing.lower', bend)}
# The wing's height at its root. The middle line starts where both its front-view lines are traced, often well out
# along the span (the fairing, the gear and the engines hide the underside inboard: the A380's from 18 m), and a
# renderer holds its first height level inboard of that. The root is where the drawing shows the wing meeting the
# fuselage: the front view's upper line where it leaves the section, less half the wing's thickness where both lines
# are first traced; else, where the front view doesn't show it, the side view's `wing.root` (a point on the fairing at
# the wing's root, its middle height). wing.z then runs from that root to its first traced point.
root_up = sort_by(F(front['wing.upper']))
side_y = max(y for x, y in half)
y_first, z_first = out['wing']['z'][0]
if y_first > side_y + 0.3:
    if root_up[0, 0] <= side_y + 0.6:
        half_t = float(np.interp(y_first, *root_up.T)) - z_first
        out['wing']['z'] = r3([(root_up[0, 0], root_up[0, 1] - half_t)]) + out['wing']['z']
    elif 'wing.root' in side:
        out['wing']['z'] = r3([(side_y, S(side['wing.root'])[0][1])]) + out['wing']['z']
st_tip = max(y for x, y in P(plan['stabilizer.leading']))
out['stabilizer'] = {'leading': plan_edge('stabilizer.leading', st_tip), 'trailing': plan_edge('stabilizer.trailing', st_tip),
                     'z': heights('stabilizer.upper', 'stabilizer.lower', min(st_tip, max(fy(x) for x, y in front['stabilizer.upper'])))}
# A T-tail's tailplane sits on the fin (the 717, CRJ, MD-80): its root is at the fin's side, its height there the fin's.
if recipe.get('stabilizer', {}).get('mount') == 'fin': out['stabilizer']['mount'] = 'fin'
# Where a front view draws the tailplane off the side view's height for it (the 727's, 0.5 m low against its fuselage),
# the side view's: `stabilizerZ`, the side px of the tailplane's middle at its root; its front-view line moves to it.
if 'stabilizerZ' in recipe:
    dz = sz(recipe['stabilizerZ']) - out['stabilizer']['z'][0][1]
    out['stabilizer']['z'] = r3([(y, z + dz) for y, z in out['stabilizer']['z']])
# `"stabilizerSpan": "printed"`: where a sheet draws the tailplane well off its printed span in every view (the
# CN-235's brochure three-view: 11.16 m in plan, about 11.0 m in front, printed 10.20 m), the printed span is the
# measurement: the tailplane is narrowed outboard of its root (its chord at each share of its span kept).
if recipe.get('stabilizerSpan') == 'printed':
    st = out['stabilizer']; root_y = st['leading'][0][0]
    k = (recipe['printed']['tailplane span'] / 2 - root_y) / (st_tip - root_y)
    for edge in ('leading', 'trailing', 'z'):
        st[edge] = r3([(root_y + (y - root_y) * k if y > root_y else y, v) for y, v in st[edge]])
    print(f"tailplane narrowed to its printed span: drawn {2 * st_tip:.3f} m, x{k:.3f} outboard of its root")
    st_tip = root_y + (st_tip - root_y) * k

# Wingtip device: its edges in the side view, and its middle line in the front view from the bend to the tip.
lo = F(front['wing.lower'])
tip_line = []
for a in ([p for p in up if p[0] >= bend - 0.3] if tipped else [],):
    for y, z in a:
        j = int(np.argmin([math.hypot(y - y2, z - z2) for y2, z2 in lo]))
        tip_line.append(((y + lo[j][0]) / 2, (z + lo[j][1]) / 2))
if tipped: out['wingtip'] = {'kind': recipe.get('wingtip', 'winglet'),
                  'leading': r3(thin(S(side['wingtip.leading']))), 'trailing': r3(thin(S(side['wingtip.trailing']))),
                  'front': r3(thin(tip_line, 0.005))}

# Engines: side profile; out from the centerline, the nacelle's middle seen from above where the plan view's
# nacelle edges are traced (Boeing's printed figure is to that), else the inlet's center in the front view.
top = sort_by(S(side['engine.top'])); bot = sort_by(S(side['engine.bottom']))
inlet = np.array(F(front['engine.inlet'])) if 'engine.inlet' in front else None
if 'engine.outer' in plan and 'engine.inner' in plan:
    cy = (np.median([y for x, y in P(plan['engine.outer'])]) + np.median([y for x, y in P(plan['engine.inner'])])) / 2
elif inlet is not None:
    cy = (inlet[:, 0].max() + inlet[:, 0].min()) / 2
else:                                                              # a turboprop placed by its propeller's disc (below)
    cy = sum(fy(v) for v in recipe['propeller']['front']) / 2
cowl = R['side'].get('cowlEnd')
out['engines'] = [{
    'x': [round(float(min(top[0, 0], bot[0, 0])), 3), round(float(max(top[-1, 0], bot[-1, 0])), 3)],
    **({'cowlEnd': round(sx(cowl), 3)} if cowl else {}),
    'y': round(float(cy), 3),
    'top': r3(thin(top)), 'bottom': r3(thin(bot)),
    **({'inlet': {'z': round(float((inlet[:, 1].max() + inlet[:, 1].min()) / 2), 3),
                  'width': round(float(inlet[:, 0].max() - inlet[:, 0].min()), 3),
                  'height': round(float(inlet[:, 1].max() - inlet[:, 1].min()), 3)}} if inlet is not None else {}),
}]
# An engine on the fuselage (the 717, CRJ, MD-80) hangs on a stub pylon from the fuselage's side: its edges from the
# plan view, root (at the fuselage) to tip (at the nacelle), as a surface's; its middle and its thickness from the
# front view's top and bottom lines.
if recipe.get('engines', {}).get('mount') == 'fuselage':
    e = out['engines'][0]; e['mount'] = 'fuselage'
    if 'pylon.leading' in plan and 'pylon.upper' in front:
        u = sort_by(F(front['pylon.upper'])); l = sort_by(F(front['pylon.lower']))
        ys = np.linspace(max(u[0, 0], l[0, 0]), min(u[-1, 0], l[-1, 0]), 12)
        mid = (np.interp(ys, *u.T) + np.interp(ys, *l.T)) / 2
        edge = lambda name: r3(thin(sorted((y, x) for x, y in P(plan[name]))))
        e['pylon'] = {'leading': edge('pylon.leading'), 'trailing': edge('pylon.trailing'),
                      'z': r3(thin(list(zip(ys, mid)), 0.005)),
                      'thickness': round(float(np.median(np.interp(ys, *u.T) - np.interp(ys, *l.T))), 3)}
# Where the document prints the inlet's distance from the nose and the drawing's inlet is more than 1.5% off it, the
# printed figure is the measurement (as fit_height.py takes the printed height): the whole nacelle (its x, cowlEnd,
# top and bottom lines) moves along x so its inlet sits there. Boeing's 737 Classic sheets draw the side view's
# nacelle 0.69 m ahead of their plans. The wing stays where the plan draws it.
inlet_printed = recipe['printed'].get('engine inlet from the nose')
drawn_inlet = out['engines'][0]['x'][0]
if inlet_printed and abs(drawn_inlet / inlet_printed - 1) > 0.015:
    dx = inlet_printed - drawn_inlet
    for e in out['engines']:
        e['x'] = [round(v + dx, 3) for v in e['x']]
        if 'cowlEnd' in e: e['cowlEnd'] = round(e['cowlEnd'] + dx, 3)
        for line in ('top', 'bottom'): e[line] = [[round(x + dx, 3), z] for x, z in e[line]]
    print(f"engine moved {dx:+.3f} m: the drawing's inlet at {drawn_inlet:.3f} m, printed {inlet_printed} m")

# A propeller (a turboprop's: the Dash 8's, ATR's; docs/SHAPES.md): the recipe's `propeller` gives its `blades`, and in
# the side view's px the disc's plane (`x`), the hub's height (`hub`) and the spinner (`spinner`: [tip, base] along x,
# `spinnerHeight`: [top, bottom]); in the front view's px the disc's edges (`front`: [left, right] across). The disc's
# middle in the front view is the engine's place out from the centerline (the document prints the propellers' spacing).
# A nacelle that isn't round (a turboprop's, deep and narrow) has its plan's sides traced as `nacelle.outer` and
# `nacelle.inner`: its `halfWidth` along it, [x, y] from its own middle.
prop = recipe.get('propeller')
if prop:
    e = out['engines'][0]
    left, right = (fy(v) for v in prop['front'])
    diameter = abs(left - right) if (prop['front'][0] - R['front']['centerline']) * (prop['front'][1] - R['front']['centerline']) > 0 else left + right
    e['y'] = cy = round((left + right) / 2, 3)
    tip, base = prop['spinner']; top_, bottom_ = prop['spinnerHeight']
    # `diameter` (m): the propeller's own printed figure where the drawing draws another (the C-130A's 15 ft 1 in
    # discs on the C-130J's sheet, whose 6-bladed propellers are 13 ft 6 in): the disc's middle still places it.
    if 'diameter' in prop: diameter = prop['diameter']
    # `apart` (m): the propellers' printed spacing, where the front view draws the discs further out than the printed
    # figure and the plan (the CN-235's sheet: 7.31 m in front, 7.05 m in plan, printed 7.0 m): it places the engines.
    if 'apart' in prop: e['y'] = cy = round(prop['apart'] / 2, 3)
    e['propeller'] = {'x': round(sx(prop['x']), 3), 'z': round(sz(prop['hub']), 3), 'diameter': round(diameter, 3),
                      'blades': prop['blades'],
                      'spinner': {'x': [round(sx(tip), 3), round(sx(base), 3)], 'diameter': round((bottom_ - top_) / ppm, 3)}}
if 'nacelle.outer' in plan and 'nacelle.inner' in plan:
    o = sort_by(P(plan['nacelle.outer'])); n = sort_by(P(plan['nacelle.inner']))
    xs = np.linspace(max(o[0, 0], n[0, 0]), min(o[-1, 0], n[-1, 0]), 120)
    hw = np.abs(np.interp(xs, *o.T) - np.interp(xs, *n.T)) / 2
    out['engines'][0]['halfWidth'] = r3(thin(list(zip(xs, hw)), 0.005))

# More engines a side (the A340's, A380's and 747's four): `engine2.top`, `engine2.bottom` (side), `engine2.inlet`
# (front), `engine2.outer`/`engine2.inner` (plan), `cowlEnd2` (side refs), and so on outward, each traced as the first
# and placed by the same rules, its own printed inlet included ('outboard engine inlet from the nose'). Seen from the
# side the outboard nacelle is the nearer: the inboard one's lines behind it are bridged with "hidden".
more_engines = {}                                                  # check name -> measured, for the checks below
for k in range(2, 9):
    pre = f'engine{k}'
    if f'{pre}.top' not in side: break
    name = 'outboard engine' if k == 2 and f'engine{k + 1}.top' not in side else f'engine {k}'
    top_k = sort_by(S(side[f'{pre}.top'])); bot_k = sort_by(S(side[f'{pre}.bottom']))
    inlet_k = np.array(F(front[f'{pre}.inlet'])) if f'{pre}.inlet' in front else None
    # A four-engined turboprop's (the C-130's): `propeller{k}` in the recipe, the outer propeller's own disc (`front`),
    # hub and spinner, the rest as `propeller`'s; its disc's middle places the engine across, as on engine 1.
    prop_k = {**prop, **recipe[f'propeller{k}']} if prop and f'propeller{k}' in recipe else None
    if prop_k:
        cy_k = sum(fy(v) for v in prop_k['front']) / 2
    elif f'{pre}.outer' in plan and f'{pre}.inner' in plan:
        cy_k = (np.median([y for x, y in P(plan[f'{pre}.outer'])]) + np.median([y for x, y in P(plan[f'{pre}.inner'])])) / 2
    else:
        cy_k = (inlet_k[:, 0].max() + inlet_k[:, 0].min()) / 2
    cowl_k = R['side'].get(f'cowlEnd{k}')
    e = {
        'x': [round(float(min(top_k[0, 0], bot_k[0, 0])), 3), round(float(max(top_k[-1, 0], bot_k[-1, 0])), 3)],
        **({'cowlEnd': round(sx(cowl_k), 3)} if cowl_k else {}),
        'y': round(float(cy_k), 3),
        'top': r3(thin(top_k)), 'bottom': r3(thin(bot_k)),
        **({'inlet': {'z': round(float((inlet_k[:, 1].max() + inlet_k[:, 1].min()) / 2), 3),
                      'width': round(float(inlet_k[:, 0].max() - inlet_k[:, 0].min()), 3),
                      'height': round(float(inlet_k[:, 1].max() - inlet_k[:, 1].min()), 3)}} if inlet_k is not None else {}),
    }
    printed_k = recipe['printed'].get(f'{name} inlet from the nose')
    drawn_k = e['x'][0]
    if printed_k and abs(drawn_k / printed_k - 1) > 0.015:
        dx = printed_k - drawn_k
        e['x'] = [round(v + dx, 3) for v in e['x']]
        if 'cowlEnd' in e: e['cowlEnd'] = round(e['cowlEnd'] + dx, 3)
        for line in ('top', 'bottom'): e[line] = [[round(x + dx, 3), z] for x, z in e[line]]
        print(f"{name} moved {dx:+.3f} m: the drawing's inlet at {drawn_k:.3f} m, printed {printed_k} m")
    if prop_k:
        tip_k, base_k = prop_k['spinner']; top_k_, bottom_k_ = prop_k['spinnerHeight']
        l_k, r_k = (fy(v) for v in prop_k['front'])
        e['propeller'] = {'x': round(sx(prop_k['x']), 3), 'z': round(sz(prop_k['hub']), 3),
                          'diameter': round(prop_k.get('diameter', abs(l_k - r_k)), 3), 'blades': prop_k['blades'],
                          'spinner': {'x': [round(sx(tip_k), 3), round(sx(base_k), 3)], 'diameter': round((bottom_k_ - top_k_) / ppm, 3)}}
    if f'nacelle{k}.outer' in plan and f'nacelle{k}.inner' in plan:
        o_k = sort_by(P(plan[f'nacelle{k}.outer'])); n_k = sort_by(P(plan[f'nacelle{k}.inner']))
        xs_k = np.linspace(max(o_k[0, 0], n_k[0, 0]), min(o_k[-1, 0], n_k[-1, 0]), 120)
        e['halfWidth'] = r3(thin(list(zip(xs_k, np.abs(np.interp(xs_k, *o_k.T) - np.interp(xs_k, *n_k.T)) / 2)), 0.005))
        more_engines[f'{name} nacelle width'] = round(2 * max(y for x, y in e['halfWidth']), 3)
    out['engines'].append(e)
    more_engines[f'{name} out from the centerline'] = round(float(cy_k), 3)
    more_engines[f'{name} inlet from the nose'] = e['x'][0]
    if inlet_k is not None: more_engines[f'{name} nacelle width'] = e['inlet']['width']

# A turboprop's printed propeller plane, as the printed inlet above: where the side view draws the plane more than
# 1.5% off the printed distance from the nose (the C-130's: 0.21 m behind its 29 ft 11 in, which its plan draws), every
# nacelle and propeller moves along x to it; the wing, and the nacelles' widths from the plan, stay where the plan
# draws them.
plane_printed = recipe['printed'].get('propeller plane from the nose')
if prop and plane_printed:
    drawn_plane = out['engines'][0]['propeller']['x']
    if abs(drawn_plane / plane_printed - 1) > 0.015:
        dx = plane_printed - drawn_plane
        for e in out['engines']:
            e['x'] = [round(v + dx, 3) for v in e['x']]
            if 'cowlEnd' in e: e['cowlEnd'] = round(e['cowlEnd'] + dx, 3)
            for line in ('top', 'bottom'): e[line] = [[round(x + dx, 3), z] for x, z in e[line]]
            if 'propeller' in e:
                pe_ = e['propeller']; pe_['x'] = round(pe_['x'] + dx, 3)
                pe_['spinner']['x'] = [round(v + dx, 3) for v in pe_['spinner']['x']]
        print(f"nacelles and propellers moved {dx:+.3f} m: the drawing's propeller plane at {drawn_plane:.3f} m, printed {plane_printed} m")

# Windows and doors. Where the drawing has cabin windows (Airbus), each is found; where it hasn't (Boeing), the
# recipe places them (`windows`: a pitch from one x to another, or `x`, each one's middle as measured elsewhere,
# with a height band, a width and a note saying so).
if 'windows' in recipe:
    wr = recipe['windows']
    xs = np.arange(wr['from'], wr['to'] + 1e-9, wr['pitch']) if 'x' not in wr else np.array(wr['x'], float)
    if 'x' in wr and wr.get('atExits'):
        # Measured elsewhere (photos), as meters from the nose; an exit's own window at its middle, wherever the
        # exit is placed.
        xs = sorted([*xs, *((sx(d['box'][0]) + sx(d['box'][2])) / 2 for d in recipe['doors'] if d['kind'] == 'exit')])
    if wr.get('clearOfDoors'):
        # No window where a passenger door is (an exit has its own window, on the frame pitch).
        clear = lambda x, a, b: x + wr['width'] / 2 + 0.05 < a or x - wr['width'] / 2 - 0.05 > b
        doors_x = [(sx(d['box'][0]), sx(d['box'][2])) for d in recipe['doors'] if d['kind'] == 'door']
        exits_x = [(sx(d['box'][0]), sx(d['box'][2])) for d in recipe['doors'] if d['kind'] == 'exit']
        xs = [x for x in xs if all(clear(x, a, b) for a, b in doors_x + exits_x)]
        # Nor between a pair of exits side by side (the 737's overwing pair: their middles under 2.2 pitches apart).
        mids = sorted((a + b) / 2 for a, b in exits_x)
        pairs = [(m, n) for m, n in zip(mids, mids[1:]) if n - m < 2.2 * wr['pitch']]
        xs = [x for x in xs if not any(m < x < n for m, n in pairs)]
        xs = sorted(xs + [(a + b) / 2 for a, b in exits_x])   # an exit's own window, at its middle
    windows = {'z': wr['z'], 'width': wr['width'], 'x': [round(float(x), 3) for x in xs], 'note': wr['note']}
else:
    pieces = [p for p in feats['pieces']]
    row = R['side']['windowRow']                                   # [top, bottom] px of the window brackets
    # `windowMinWidth` drops narrower pieces in the row (a door's viewport); `windowGap` is how close two pieces
    # are to be one window's (Airbus's bracket pairs: 25 px; drawn as closed outlines, windows can sit closer).
    win = sorted(p for p in pieces if p[1] >= row[0] - 3 and p[3] <= row[1] + 3
                 and p[2] - p[0] >= R['side'].get('windowMinWidth', 0))
    gap = R['side'].get('windowGap', 25)
    groups = []
    for p in win:
        if groups and p[0] - groups[-1][2] <= gap: groups[-1] = [groups[-1][0], min(groups[-1][1], p[1]), max(groups[-1][2], p[2]), max(groups[-1][3], p[3])]
        else: groups.append(list(p))
    # `windowInset`: px off each side, to the outline's line centres where a picture's thick lines make the
    # pieces wider and taller than the windows.
    inset = R['side'].get('windowInset', 0)
    row = [row[0] + inset, row[1] - inset]
    w = float(np.median([g[2] - g[0] for g in groups])) - 2 * inset
    # A window whose outline joins another line (the wing's, say) isn't a piece of its own: `windowsAlso` lists
    # their centres.
    xs = sorted([(g[0] + g[2]) / 2 for g in groups] + R['side'].get('windowsAlso', []))
    if R['side'].get('dropDoorWindows'):
        # Boeing's 747 sheet draws each door's own window in the row: it's the door's (doorShape draws it). A door on
        # the right only (drawn dashed in the left side view: the Dash 8-400's forward baggage door) leaves the left
        # side's window there.
        xs = [x for x in xs if not any(d['box'][0] < x < d['box'][2] and d['box'][1] < row[1] and d['box'][3] > row[0]
                                       for d in recipe['doors'] if d.get('side') != 'right')]
    # `windowBand`: the windows' top and bottom where the row that picks them is wider (a row that rises aft).
    band = R['side'].get('windowBand', row)
    windows = {'z': [round(sz(band[1]), 3), round(sz(band[0]), 3)], 'width': round(w / ppm, 3),
               'x': [round(sx(x), 3) for x in xs]}
out['cabin'] = {
    'windows': windows,
    'doors': [{'kind': d['kind'], 'x': [round(sx(d['box'][0]), 3), round(sx(d['box'][2]), 3)],
               'z': [round(sz(d['box'][3]), 3), round(sz(d['box'][1]), 3)], **({'side': d['side']} if 'side' in d else {})}
              for d in recipe['doors']],
}
# A double-deck cabin's upper row (the A380's): `upperWindowRow`, `upperWindowBand` and `upperWindowsAlso` in the
# side refs, picked as the main row's are (its `windowGap`, `windowMinWidth`, `windowInset`).
if 'upperWindowRow' in R['side']:
    urow = R['side']['upperWindowRow']
    upieces = sorted(p for p in feats['pieces'] if p[1] >= urow[0] - 3 and p[3] <= urow[1] + 3
                     and p[2] - p[0] >= R['side'].get('windowMinWidth', 0))
    ugroups = []
    for p in upieces:
        if ugroups and p[0] - ugroups[-1][2] <= R['side'].get('windowGap', 25):
            ugroups[-1] = [ugroups[-1][0], min(ugroups[-1][1], p[1]), max(ugroups[-1][2], p[2]), max(ugroups[-1][3], p[3])]
        else: ugroups.append(list(p))
    uinset = R['side'].get('windowInset', 0)
    uw = float(np.median([g[2] - g[0] for g in ugroups])) - 2 * uinset
    uxs = sorted([(g[0] + g[2]) / 2 for g in ugroups] + R['side'].get('upperWindowsAlso', []))
    uband = R['side'].get('upperWindowBand', [urow[0] + uinset, urow[1] - uinset])
    out['cabin']['upperWindows'] = {'z': [round(sz(uband[1]), 3), round(sz(uband[0]), 3)], 'width': round(uw / ppm, 3),
                                    'x': [round(sx(x), 3) for x in uxs]}
out['cockpit'] = {'windows': [r3(thin(S(p), 0.005)) for p in recipe['cockpitPanes']]}
# The windshield meets its twin on the centerline, which from the side is the outline's top (docs/SHAPES.md, Cockpit):
# the windshield's points within `windshieldTolerance` (default 12 cm) of it sit on it. Over an upper deck the
# outline's top is the hump's crown.
tol = recipe.get('windshieldTolerance', 0.12)
if out['cockpit']['windows']:
    top_line = sorted(out['fuselage']['crown'])
    hump_line = sorted(out['fuselage']['hump']['crown']) if 'hump' in out['fuselage'] else None
    def outline_top(x):
        z = float(np.interp(x, *np.array(top_line).T))
        if hump_line and hump_line[0][0] <= x <= hump_line[-1][0]: z = max(z, float(np.interp(x, *np.array(hump_line).T)))
        return z
    # The windshield is the pane reaching nearest the outline's top (not the foremost: the C-17's chin window is
    # further forward); windshield.py, after smooth.py, puts its post on the outline where it's further under.
    i = min(range(len(out['cockpit']['windows'])),
            key=lambda k: min(outline_top(x) - z for x, z in out['cockpit']['windows'][k]))
    out['cockpit']['windows'][i] = [[x, round(outline_top(x), 3)] if 0 <= outline_top(x) - z <= tol else [x, z]
                                    for x, z in out['cockpit']['windows'][i]]

# Checks: the printed dimensions against the shape.
span = 2 * max([y for y, z in tip_line] + [y for y, x in out['wing']['leading'] + out['wing']['trailing']])
meas = {
    'fuselage length': L,
    'fuselage height': round(height, 3),
    # Across the constant tube (the middle third), where the printed width is measured.
    'fuselage width': round(2 * float(np.median([y for x, y in half if L / 3 <= x <= 2 * L / 3])), 3),
    'wingspan': round(span, 3),
    'tailplane span': round(2 * st_tip, 3),
    'engine out from the centerline': round(float(cy), 3),
    'fin tip above the crown': round(max(z for x, z in lead_all + trail) - crown_z, 3),
    # To whatever reaches furthest back: the tail cone, the tailplane's tips or the fin's (the 767's).
    'overall length': round(max(L, *(x for y, x in out['stabilizer']['trailing'] + out['stabilizer']['leading']),
                                *(x for x, z in trail)), 3),
    # Boeing's plans print the wing tip's leading edge back from the nose, the tip's chord and the inlet's lip.
    'wing tip leading edge from the nose': out['wing']['leading'][-1][1],
    'wing tip chord': round(out['wing']['trailing'][-1][1] - out['wing']['leading'][-1][1], 3),
    'engine inlet from the nose': out['engines'][0]['x'][0],
}
if inlet is not None: meas['nacelle width'] = round(float(inlet[:, 0].max() - inlet[:, 0].min()), 3)
# Where the wing's root and tip trailing edge sit (Boeing's 717 plan prints both).
meas['wing root leading edge from the nose'] = out['wing']['leading'][0][1]
meas['wing tip trailing edge from the nose'] = max(x for y, x in out['wing']['trailing'])
# A door's middle from the nose, by the `name` the recipe gives it: door tables print them (cargo doors, main doors).
for d in recipe['doors']:
    if 'name' in d: meas[f"{d['name']} from the nose"] = round((sx(d['box'][0]) + sx(d['box'][2])) / 2, 3)
# Heights above the crown, where the document gives them only as heights above the ground (Boeing's ground clearances:
# the recipe's printed figure is the middle of the clearance's range less the crown's): the fin's tip, the
# tailplane's tip, the nacelle's middle.
st_z = out['stabilizer']['z']
meas['tailplane tip above the crown'] = round(st_z[-1][1] - crown_z, 3)
e0 = out['engines'][0]
meas['nacelle middle below the crown'] = round(crown_z - (max(z for x, z in e0['top']) + min(z for x, z in e0['bottom'])) / 2, 3)
if tipped: meas['winglet height'] = round(max(z for y, z in tip_line) - out['wing']['z'][-1][1], 3)   # above the wing's tip
meas.update(more_engines)
if prop:
    pe = out['engines'][0]['propeller']
    meas['propeller diameter'] = pe['diameter']
    meas['propellers apart'] = round(2 * out['engines'][0]['y'], 3)
    meas['engine out from the centerline'] = out['engines'][0]['y']
    meas['propeller plane from the nose'] = pe['x']
    meas['nacelle width'] = round(2 * max(y for x, y in out['engines'][0].get('halfWidth', [[0, 0]])), 3)

# A tail engine on the centerline (`engines[].mount: "tail"`, docs/SHAPES.md): the recipe's `tailEngine` gives its
# `duct` ("straight": through the fin's base, the MD-11's; "s": an S-duct from an intake on the crown ahead of the fin,
# the 727's) and its `strut` (px along the side view: where a straight duct's nacelle is joined to the crown under
# it). Side: `tail.top` and `tail.bottom` (its outline where it stands clear of the fuselage: the nacelle with the fin
# on its top and the fairing over its nozzle; or the intake's fairing, its bottom on the crown), `tail.nozzleTop` and
# `tail.nozzleBottom` (the bare exhaust where it shows), `tailCowlEnd` and `tailExhaust` (refs, px); plan:
# `tail.halfWidth`; front: `tail.inlet` (the inlet's ring, or the intake's opening). It goes first (y 0, inboard).
if 'tail.top' in side:
    te = recipe.get('tailEngine', {})
    tt, tb = sort_by(S(side['tail.top'])), sort_by(S(side['tail.bottom']))
    noz = {k: r3(thin(sort_by(S(side[f'tail.nozzle{k.title()}'])))) for k in ('top', 'bottom') if f'tail.nozzle{k.title()}' in side}
    t_inlet = np.array(F(front['tail.inlet'])) if 'tail.inlet' in front else None
    lip = round(float(min(tt[0, 0], tb[0, 0])), 3)
    exhaust = (sx(R['side']['tailExhaust']) if 'tailExhaust' in R['side'] else
               max(x for line in noz.values() for x, z in line) if noz else max(tt[-1, 0], tb[-1, 0]))
    tail_engine = {
        'x': [lip, round(float(exhaust), 3)],
        **({'cowlEnd': round(sx(R['side']['tailCowlEnd']), 3)} if 'tailCowlEnd' in R['side'] else {}),
        'mount': 'tail', 'duct': te.get('duct', 'straight'),
        **({'strut': [round(sx(v), 3) for v in te['strut']]} if 'strut' in te else {}),
        'y': 0.0,
        'top': r3(thin(tt)), 'bottom': r3(thin(tb)),
        **({'halfWidth': r3(thin(sort_by(P(plan['tail.halfWidth'])), 0.005))} if 'tail.halfWidth' in plan else {}),
        **({'nozzle': noz} if len(noz) == 2 else {}),
        **({'inlet': {'z': round(float((t_inlet[:, 1].max() + t_inlet[:, 1].min()) / 2), 3),
                      'width': round(float(2 * t_inlet[:, 0].max()), 3),
                      'height': round(float(t_inlet[:, 1].max() - t_inlet[:, 1].min()), 3)}} if t_inlet is not None else {}),
    }
    out['engines'].insert(0, tail_engine)
    meas['tail engine inlet from the nose'] = lip
    meas['tail engine nacelle width'] = round(2 * max(y for x, y in tail_engine.get('halfWidth', [[0, 0]])), 3)
    if t_inlet is not None: meas['tail engine inlet width'] = tail_engine['inlet']['width']
    if t_inlet is not None:   # Boeing's ground clearances give the fin's top and the tail engine inlet's top
        meas['fin tip above the tail engine'] = round(max(z for x, z in lead_all + trail) - float(t_inlet[:, 1].max()), 3)
    # The overall length reaches the tail engine's exhaust where it's the furthest back (the MD-11's plug).
    meas['overall length'] = round(max(meas['overall length'], *(x for line in noz.values() for x, z in line)), 3)
out['checks'] = [{'dimension': k, 'printed': v, 'shape': meas[k], 'off': f'{100 * (meas[k] / v - 1):+.1f}%'}
                 for k, v in recipe['printed'].items()]
meta = recipe['meta']
shape = {'$schema': '../schema/shape.schema.json', **meta, **out}
text = json.dumps(shape, indent=1)
# One point per line is long; keep each [a, b] pair on one line.
import re
text = re.sub(r'\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]', r'[\1, \2]', text)
(here / recipe['out']).write_text(text + '\n')
for c in out['checks']: print(f"{c['dimension']:32} printed {c['printed']:7} shape {c['shape']:7} {c['off']}")
