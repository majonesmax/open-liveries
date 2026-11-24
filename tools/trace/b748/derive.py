# The 747-8F (shapes/B748.json) from the 747-400F's measured shape (shapes/B744.json) and the 747-8 document's
# scanned general-dimensions sheets: its two fuselage plugs (the door table's figures), and the new wing, nacelles
# and their positions read off the scans (points below, in pixels of layers.py --mode image rasters at scale 12 of
# D6-58326-3 Rev E page index 14: side clip 155,445,495,535; plan clip 155,145,495,330; front clip 135,560,500,665).
# The scans are binarized at about 2.3 px a point, with the sheet's grid drawn through the aircraft: the points are
# read by eye along the lines, good to about 0.1 m.
#
# Usage: derive.py   (from the repo root; writes shapes/B748.json, then run smooth.py --parts on it)
import json, re, math

src = json.load(open('shapes/B744.json'))
PLUGS = [(16.0, 4.10), (37.5, 1.49)]          # at x on the 747-400F (m from the nose), length (m)
L8 = 74.22                                     # printed nose to tail cone (2.2.1: 243 ft 3 in)
plugged = lambda x: x + sum(n for at, n in PLUGS if x > at)
r3 = lambda v: round(v, 3)

# Scans: one scale (the printed 68.40 m span between the front view's tips; the plan's 51.94 m to the wing tip).
PPM = 51.6
SIDE_NOSE, PLAN_NOSE, PLAN_CL, FRONT_CL = 79, 87, 1906, 1893
SIDE_CENTRE = 741                              # the main tube's middle (crown 557, belly 925)
sx = lambda px: (px - SIDE_NOSE) / PPM; sz = lambda py: (SIDE_CENTRE - py) / PPM
plan = lambda pts: [[r3((PLAN_CL - py) / PPM), r3((px - PLAN_NOSE) / PPM)] for px, py in pts]   # [y, x]

shape = json.loads(json.dumps(src))
fu = shape['fuselage']
for line in ('crown', 'belly', 'halfWidth'):
    fu[line] = [[r3(plugged(x)), v] for x, v in fu[line]]
fu['length'] = L8
fu['hump']['crown'] = [[r3(plugged(x)), z] for x, z in fu['hump']['crown']]
tail = sum(n for _, n in PLUGS)
for k in shape['fin']:
    shape['fin'][k] = [[r3(x + tail), z] for x, z in shape['fin'][k]]
for k in ('leading', 'trailing'):
    shape['stabilizer'][k] = [[y, r3(x + tail)] for y, x in shape['stabilizer'][k]]
for d in shape['cabin']['doors']:
    d['x'] = [r3(plugged(d['x'][0])), r3(plugged(d['x'][1]))]
# Doors the 747-8F has otherwise: one passenger door (the forward one, 2.7.1), and its main-deck cargo door where
# the side scan draws it (x 2473-2659 px; its middle 48.2 m, printed 48.26 m).
doors = shape['cabin']['doors']
aft = max((d for d in doors if d['kind'] == 'door'), key=lambda d: d['x'][0])
doors.remove(aft)
main_cargo = next(d for d in doors if d['kind'] == 'cargo' and d.get('side') == 'left' and d['z'][1] > 1)
main_cargo['x'] = [r3(sx(2473)), r3(sx(2659))]

# The wing: plan edges, root (on the fuselage's side) to the raked tip.
shape['wing']['leading'] = plan([(1347, 1738), (1474, 1600), (1611, 1450), (1750, 1300), (1889, 1150), (2026, 1000),
                                 (2164, 850), (2290, 700), (2418, 550), (2542, 400), (2680, 250), (2765, 141)])
shape['wing']['trailing'] = plan([(2135, 1738), (2200, 1560), (2258, 1390), (2300, 1255), (2360, 1140), (2409, 1000),
                                  (2492, 850), (2580, 700), (2668, 550), (2756, 400), (2848, 250), (2930, 141)])
# Its middle height from the front view, tied to the side view by the inboard inlet's middle (front y 1017.5, side z
# -3.20 m); the root where the upper line leaves the fuselage, less half the thickness (build.py's rule).
fz = lambda py: -3.20 - (py - 1017.5) / PPM
fy = lambda px: (px - FRONT_CL) / PPM
mid = [(2300, 904, 973), (2500, 888, 934), (2700, 868, 909), (2900, 850, 882), (3100, 834, 861), (3300, 818, 840),
       (3500, 802, 824), (3650, 798, 806)]
z = [[r3(fy(x)), r3(fz((u + l) / 2))] for x, u, l in mid]
z.insert(0, [r3(fy(2100)), r3(fz(909) - (fz(904) - fz((904 + 973) / 2)))])
shape['wing']['z'] = z
shape.pop('wingtip', None)                     # raked tips: a plain tip, as the 777's

# The GEnx-2B nacelles from the side scan; out from the centerline from the plan's nacelle edges (Boeing prints to
# their middle there); the inlets from the front.
def nacelle(top, bottom, cowl, y, ring):
    (x0, x1), (zt, zb) = ring
    return {'x': [r3(sx(top[0][0])), r3(sx(top[-1][0]))], 'cowlEnd': r3(sx(cowl)), 'y': r3(y),
            'top': [[r3(sx(a)), r3(sz(b))] for a, b in top], 'bottom': [[r3(sx(a)), r3(sz(b))] for a, b in bottom],
            'inlet': {'z': r3(fz((zt + zb) / 2)), 'width': r3((x1 - x0) / PPM), 'height': r3((zb - zt) / PPM)}}
shape['engines'] = [
    nacelle([(1488, 826), (1550, 817), (1650, 813), (1745, 828), (1750, 860), (1795, 878)],
            [(1488, 985), (1550, 992), (1650, 992), (1745, 975), (1750, 945), (1795, 928)], 1748,
            (1906 - (1200 + 1373) / 2) / PPM, ((2426, 2601), (932, 1103))),
    nacelle([(1930, 772), (2000, 765), (2100, 763), (2185, 775), (2190, 820), (2232, 835)],
            [(1930, 920), (2000, 927), (2100, 925), (2185, 912), (2190, 895), (2232, 880)], 2188,
            (1906 - (725 + 905) / 2) / PPM, ((2894, 3072), (877, 1047))),
]

# Checks: the 747-8F's printed figures (2.2.1, 2.7.1).
span = 2 * max(y for y, x in shape['wing']['leading'] + shape['wing']['trailing'])
fin_x = max(x for x, z in shape['fin']['trailing'])
st_x = max(x for y, x in shape['stabilizer']['trailing'])
meas = {'fuselage length': L8, 'wingspan': r3(span), 'tailplane span': r3(2 * max(y for y, x in shape['stabilizer']['leading'])),
        'engine out from the centerline': shape['engines'][0]['y'], 'outboard engine out from the centerline': shape['engines'][1]['y'],
        'engine inlet from the nose': shape['engines'][0]['x'][0], 'outboard engine inlet from the nose': shape['engines'][1]['x'][0],
        'wing tip leading edge from the nose': shape['wing']['leading'][-1][1], 'overall length': r3(max(L8, fin_x, st_x)),
        'fuselage width': r3(2 * max(y for x, y in fu['halfWidth']))}
printed = {'fuselage length': 74.22, 'fuselage width': 6.5, 'wingspan': 68.4, 'tailplane span': 21.99,
           'engine out from the centerline': 11.93, 'outboard engine out from the centerline': 21.18,
           'engine inlet from the nose': 27.25, 'outboard engine inlet from the nose': 35.86,
           'wing tip leading edge from the nose': 51.94, 'overall length': 76.25}
shape['checks'] = [{'dimension': k, 'printed': v, 'shape': meas[k], 'off': f'{100 * (meas[k] / v - 1):+.1f}%'} for k, v in printed.items()]
shape.update({'id': 'B748', 'name': 'Boeing 747-8F', 'types': ['B748'], 'confidence': 'medium'})
shape['cabin']['windows']['note'] = "The 747-8F has no main-deck cabin windows, and its sheet draws none on the upper deck."
shape['sources'] = [{
    'url': 'https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/747-8_Rev_E.pdf',
    'title': 'Boeing, 747-8 Airplane Characteristics for Airport Planning (D6-58326-3 Rev E, January 2026), 2.2.1 General Dimensions: Model 747-8F, and 2.7.1 Door Locations',
    'accessed': '2026-11-15',
    'note': ("The 747-8's sheets are low-resolution binarized scans with the sheet's grid drawn through the aircraft, too coarse to trace as the other shapes are: "
             "so the shape is the 747-400F's measured outlines (shapes/B744.json, from D6-58326-1) with the 747-8's two fuselage plugs, 4.10 m ahead of the wing and 1.49 m behind it "
             "(the door table 2.7.1 puts doors 2 and 3 4.1 m, doors 4 and 5 5.6 m further back than the 747-400's; 74.22 m nose to tail cone), "
             "and its new wing (raked tips), GEnx-2B nacelles and their positions read off the scans (tools/trace/b748/derive.py) to about 0.1 m. "
             "The fin and tailplane are the 747-400's, moved back with the plugs (the sheet prints the tailplane 21.99 m across, the 747-400's 22.17 m). "
             "Doors as the 747-400F's, moved with the plugs, but for the main-deck cargo door, where the scan draws it (its middle at the printed 48.26 m), and the one passenger door (the forward one). Confidence medium for the scans.")}]
text = json.dumps(shape, indent=1)
text = re.sub(r'\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]', r'[\1, \2]', text)
open('shapes/B748.json', 'w').write(text + '\n')
for c in shape['checks']: print(f"{c['dimension']:40} printed {c['printed']:7} shape {c['shape']:7} {c['off']}")
