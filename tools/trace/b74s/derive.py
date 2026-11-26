# The 747SP (shapes/B74S.json) from the 747-400's measured shape (shapes/B744-passenger.json, traced on D6-58326-1's
# vector sheet) and the 747-100/-200/-300/SP document's 747SP pages (D6-58326, 2.2.2 General Dimensions: Model 747SP,
# August 1975; 2.3.3 Ground Clearances; 2.7.2 Main Entry Door Locations; 2.7.6, 2.7.10, 2.7.11). Those pages are
# scans: 2.2.2 is drawn in lines about 0.35 m thick over a 5 ft grid (about 22 px a meter at layers.py scale 4.627),
# too coarse to trace as the vector sheets are. So, as the 747-8 is from the 747-400 (b748/derive.py), the 747SP is
# the 747-400's outlines taken apart where the SP's printed figures say, with what is the SP's own read off its scan
# and its printed figures:
#
# - The fuselage. The SP shares the 747's nose, section and doors 1 and 2's forward body. Its door table (2.7.2: doors
#   at 9.50, 16.41, 31.60 and 41.35 m) against the 747-100's (2.7.1: 9.50, 18.80, 30.61, 40.74, 55.14 m, as the
#   747-400's) and the cargo doors' tables (2.7.10-11: forward 13.34 m on both; aft 35.94 m against 45.08 m) take
#   2.39 m out between the forward cargo door and door 2, 2.69 m between door 2 and the wing, 4.06 m behind the wing's
#   root (the 747's door 3 at the wing is gone; its door 4 is the SP's door 3) and 4.65 m behind the aft cargo door
#   (where the 747's bulk cargo door is: the SP has none, 2.7.12). Doors and windows move by those. The body behind
#   the aft cargo door isn't the 747's cut short: the SP's taper is steeper. Its scan draws the belly's sweep up to the
#   tail cone along the 747-400's taper squeezed lengthwise into the SP's 16.51 m from the aft cargo door to the
#   printed 53.87 m tail cone (176 ft 9 in): 0.746 of its 22.13 m, within the scan's line. So the fuselage's lines behind 46.5 m (the 747-400's) are squeezed so.
# - The upper deck: the 747-100's short one, which the 747-400F has (shapes/B744.json), not moved: the SP's forward
#   plugs lie under it (its deck reaches back over the wing box) and the scan draws it ending at 21-23 m. Its upper
#   deck door is 2.7.6's 0.61 by 1.22 m hatch at 8.00 m, both sides, at the height the scan draws it. Its windows are
#   Pan Am's SPs' ten a side (N532PA, July 1985: the shape's sources), 11.68-16.32 m, at the 747-400's heights.
# - The fin: the 747-400's moved back with the body ahead of it (13.79 m: its leading edge lands on the scan's), 0.68 m
#   taller to 2.3.3's fin tip 10.76 m above the crown (K less H, either load: the 747-400's is 10.08 m), its edges
#   carried up along their own sweep, and its trailing edge brought to the printed 56.31 m overall length (184 ft
#   9 in, to the fin's top trailing corner, as the 747-100's 70.66 m is) about its root: the scan draws that edge
#   within 0.1 m of the line so made.
# - The tailplane: 3.05 m wider than the 747's (82 ft 9 in, 25.22 m, against 72 ft 9 in), read off the scan's plan
#   (its edges' points below, in plan raster pixels), set to the printed span and its tip's trailing corner to the
#   printed 55.85 m from the nose (183 ft 3 in). Its height and dihedral are the 747-400's, carried out to the tip.
# - The wing: the 747-100's, which is the 747-400's without its 1.83 m tip extensions and winglets: cut at the
#   printed 59.64 m span (195 ft 8 in), moved with the forward plugs (5.08 m). The engines are where the 747-400's are
#   on that wing (11.97 m and 21.18 m out; 2.2.2 prints 11.94 m and 21.18 m), moved with it: the scan draws the
#   inlets within 0.1 m of them. Their outlines are the 747-400 sheet's RB211-524H nacelles: the SP's JT9D-7s are
#   drawn on the scan within its line's width of them, which can't tell the two apart.
#
# Usage: derive.py   (from the repo root; writes shapes/B74S.json, then run tools/trace/smooth.py --parts and
# tools/trace/windshield.py on it, which leave it as it is: every line here is a measured shape's)
import json, re

src = json.load(open('shapes/B744-passenger.json'))
frt = json.load(open('shapes/B744.json'))           # the 747-400F: the 747-100's short upper deck
r3 = lambda v: round(v, 3)
PITCH = 0.508                                      # the 747's 20 in window pitch

# Plugs out, on the 747-400's frame: (start, length).
CUTS = [(15.2, 2.39), (19.5, 2.69), (36.0, 4.06)]
TAPER0 = 46.5                                      # the 747-400's body behind here is squeezed into the SP's tail
SP_TAIL = 53.87                                    # printed nose to tail cone (176 ft 9 in)
SHIFT0 = sum(n for _, n in CUTS)                   # 9.14 m ahead of the taper
K = (SP_TAIL - (TAPER0 - SHIFT0)) / (68.63 - TAPER0)


def body(x):
    """Where a point of the 747-400's fuselage lines lands on the SP's, or None where a plug is taken out."""
    if x > TAPER0:
        return TAPER0 - SHIFT0 + (x - TAPER0) * K
    for at, n in CUTS:
        if at < x < at + n:
            return None
    return x - sum(n for at, n in CUTS if x >= at + n)


# The cabin: doors and windows move by the plugs, the fourth (4.65 m behind the aft cargo door) included.
CAB = CUTS + [(47.0, 4.65)]


def cabin(x):
    for at, n in CAB:
        if at < x < at + n:
            return None
    return x - sum(n for at, n in CAB if x >= at + n)


part = lambda x0: sum(n for at, n in CUTS if at < x0)   # a part moves whole by the plugs ahead of its root

shape = json.loads(json.dumps(src))
fu = shape['fuselage']
for line in ('crown', 'belly', 'halfWidth'):
    fu[line] = [[r3(body(x)), v] for x, v in fu[line] if body(x) is not None]
fu['length'] = SP_TAIL
main = src['fuselage']['hump']['crown'][-1][1]
dz = frt['fuselage']['hump']['crown'][-1][1] - main
fu['hump']['crown'] = [[x, r3(z - dz)] for x, z in frt['fuselage']['hump']['crown']]

# The fin: moved with the body ahead of its root, then 0.68 m taller and its trailing edge to the printed length.
fin = shape['fin']
fshift = 13.79
TIP_Z = r3(main + 10.76)
OVERALL = 56.31
for k in fin:
    fin[k] = [[x - fshift, z] for x, z in fin[k]]
z_top = max(z for _, z in src['fin']['leading'])
ZS = 8.0                                           # the edges are carried up above here, along their own sweep


def raise_line(pts):
    """The edge's points above ZS carried up along its straight run's sweep (between 5 m and the tip's rounding)."""
    run = [p for p in pts if 5.0 < p[1] < z_top - 0.5]
    sx = (run[-1][0] - run[0][0]) / (run[-1][1] - run[0][1])
    out = []
    for x, z in pts:
        d = (TIP_Z - z_top) * max(0.0, z - ZS) / (z_top - ZS)
        out.append([x + d * sx, z + d])
    return out


for k in ('leading', 'trailing', 'rudder'):
    fin[k] = raise_line(fin[k])
te = fin['trailing']
z0 = te[0][1]
top = max(te, key=lambda p: p[1])
shear = (OVERALL - max(x for x, _ in te)) / (top[1] - z0)
for k in ('trailing', 'rudder'):
    fin[k] = [[x + shear * max(0.0, z - z0), z] for x, z in fin[k]]
for k in fin:
    fin[k] = [[r3(x), r3(z)] for x, z in fin[k]]

# The tailplane off the scan's plan (D6-58326 page index 28, layers.py --mode image at 4.627, clip 200,30,490,322;
# line centres): its centerline at 683.5 px, the tip's trailing corner at (1272, 409).
PLAN_CL, TIP = 683.5, (1272, 409)
SPAN = 25.22
sy = (SPAN / 2) / (PLAN_CL - TIP[1])
px = lambda p: [r3((PLAN_CL - p[1]) * sy), r3(55.85 - (TIP[0] - p[0]) / 22.13)]       # [y, x]
le_pts = [(1175.5, 480), (1156.5, 500), (1137.5, 520), (1118.5, 540), (1099.5, 560), (1081.5, 580)]
# The leading edge is straight: a line through the scan's points (0.95 px along per px across), from the fuselage's
# side to the tip's leading corner at the tip's row.
a = (le_pts[-1][0] - le_pts[0][0]) / (le_pts[-1][1] - le_pts[0][1])
le_at = lambda row: (le_pts[0][0] + a * (row - le_pts[0][1]), row)
te_pts = [(1205, 660), (1211, 640), (1216, 620), (1221, 600), (1225.5, 580), (1231.5, 560), (1237.5, 540), (1241.5, 520),
          (1247.5, 500), (1252, 480), (1258, 460), (1262, 440), (1269, 420), TIP]


def half_width(x):
    hw = fu['halfWidth']
    for (x0, y0), (x1, y1) in zip(hw, hw[1:]):
        if x0 <= x <= x1: return y0 + (y1 - y0) * (x - x0) / ((x1 - x0) or 1e-9)
    return 0.0


def from_root(pts):
    """[y, x] points from where the edge meets the fuselage's side, out."""
    out = [px(p) for p in pts]
    out.sort(key=lambda p: p[0])
    for (y0, x0), (y1, x1) in zip(out, out[1:]):
        if y0 <= half_width(x0) and y1 > half_width(x1):
            lo_, hi_ = 0.0, 1.0           # the crossing, by bisection along the stretch
            for _ in range(40):
                m = (lo_ + hi_) / 2
                y, x = y0 + (y1 - y0) * m, x0 + (x1 - x0) * m
                lo_, hi_ = (m, hi_) if y <= half_width(x) else (lo_, m)
            y, x = y0 + (y1 - y0) * lo_, x0 + (x1 - x0) * lo_
            return [[r3(y), r3(x)]] + [p for p in out if p[0] > y]
    return out


st = shape['stabilizer']
row_root = PLAN_CL - 1.5 / sy
st['leading'] = from_root([le_at(row_root), le_at(560), le_at(500), le_at(TIP[1])])
st['trailing'] = from_root(te_pts)
(y0, x0), (y1, x1) = st['trailing'][:2]
if y0 > half_width(x0):                            # carried in along its first stretch to the fuselage's side
    for _ in range(60):
        y0n = y0 - 0.02; x0n = x0 + (x0 - x1) / (y1 - y0) * 0.02
        if y0n <= half_width(x0n): break
        y0, x0 = y0n, x0n
    st['trailing'].insert(0, [r3(y0n), r3(x0n)])
zs = src['stabilizer']['z']
slope = (zs[-1][1] - zs[0][1]) / (zs[-1][0] - zs[0][0])
st['z'] = [p for p in zs] + [[r3(SPAN / 2), r3(zs[-1][1] + slope * (SPAN / 2 - zs[-1][0]))]]

# The wing: the 747-400's cut at the printed span and moved with the forward plugs.
SEMI = 59.64 / 2
w = shape['wing']
ws = part(w['leading'][0][1])


def cut(pts, i_out):
    """[a, b] points along a, cut at a = SEMI (the span's coordinate is i_out)."""
    out = []
    for p, q in zip(pts, pts[1:]):
        out.append(p)
        if p[i_out] < SEMI <= q[i_out]:
            t = (SEMI - p[i_out]) / (q[i_out] - p[i_out])
            out.append([r3(p[0] + (q[0] - p[0]) * t), r3(p[1] + (q[1] - p[1]) * t)])
            return out
    return out + [pts[-1]]


w['leading'] = [[y, r3(x - ws)] for y, x in cut(w['leading'], 0)]
w['trailing'] = [[y, r3(x - ws)] for y, x in cut(w['trailing'], 0)]
w['z'] = cut(w['z'], 0)
for f in w.get('fairings', []):
    f['x'] = [r3(f['x'][0] - ws), r3(f['x'][1] - ws)]
shape.pop('wingtip', None)
for e in shape['engines']:
    s = part(e['x'][0])
    e['x'] = [r3(e['x'][0] - s), r3(e['x'][1] - s)]
    e['cowlEnd'] = r3(e['cowlEnd'] - s)
    for k in ('top', 'bottom'):
        e[k] = [[r3(x - s), z] for x, z in e[k]]

# Doors: the 747-400's moved by the plugs; its door 3 (at the wing), its Type A upper deck door and its bulk cargo
# door aren't the SP's. The SP's upper deck hatch (2.7.6) is added.
cab = shape['cabin']
mains = sorted((d for d in cab['doors'] if d['kind'] == 'door' and d['z'][0] < 0), key=lambda d: d['x'][0])
cargo = sorted((d for d in cab['doors'] if d['kind'] == 'cargo'), key=lambda d: d['x'][0])
up = next(d for d in cab['doors'] if d['kind'] == 'door' and d['z'][0] > 1)
keep = [mains[0], mains[1], mains[3], mains[4], cargo[0], cargo[1]]
for d in keep:
    lo, hi = cabin(d['x'][0]), cabin(d['x'][1])
    d['x'] = [r3(lo), r3(hi)]
hatch = {'kind': 'exit', 'x': [r3(8.0 - 0.305), r3(8.0 + 0.305)], 'z': [2.37, 3.59]}
cab['doors'] = keep[:2] + [hatch] + keep[2:]
names = ['door 1', 'door 2', 'door 3', 'door 4']
door_mid = {n: r3(sum(d['x']) / 2) for n, d in zip(names, keep[:4])}

# Main-deck windows: the 747-400 sheet's moved by the plugs, the gaps the plugs and the 747's door 3 leave filled at
# the pitch, clear of the doors as the 747-400's are (0.6 m ahead of a door, 0.9 m behind it).
xs = [cabin(x) for x in src['cabin']['windows']['x']]
xs = [x for x in xs if x is not None]
spans = [(d['x'][0], d['x'][1]) for d in keep[:4]]
filled = []
for a_, b_ in zip(xs, xs[1:]):
    filled.append(a_)
    if b_ - a_ < 1.5 * PITCH: continue
    door = next(((d0, d1) for d0, d1 in spans if a_ < d0 and d1 < b_), None)
    if door:
        x = a_ + PITCH
        while x < door[0] - 0.55: filled.append(x); x += PITCH
        back, x = [], b_ - PITCH
        while x > door[1] + 0.85: back.append(x); x -= PITCH
        filled += back[::-1]
    else:
        n = round((b_ - a_) / PITCH)
        filled += [a_ + (b_ - a_) * i / n for i in range(1, n)]
filled.append(xs[-1])
# Between doors 2 and 3 and doors 3 and 4 (where the plugs and the 747's door 3 were) the row is evened out to the
# pitch between its first and last window.
win = []
for x in filled:
    if not win or x - win[-1] > 0.75 * PITCH: win.append(x)
for d0, d1 in ((spans[1][1], spans[2][0]), (spans[2][1], spans[3][0])):
    seg = [x for x in win if d0 < x < d1]
    n = round((seg[-1] - seg[0]) / PITCH)
    even = [seg[0] + (seg[-1] - seg[0]) * i / n for i in range(n + 1)]
    win = [x for x in win if not d0 < x < d1] + even
win.sort()
cab['windows']['x'] = [r3(x) for x in win]
cab['windows']['note'] = ("The 747-400 sheet's windows (D6-58326-1 2.2.1, drawn there), moved with the 747SP's plugs and the gaps they and "
                          "the 747's door 3 leave filled at the 0.508 m pitch. D6-58326's SP pages don't draw the windows.")
cab['upperWindows']['x'] = [r3(11.68 + i * (16.32 - 11.68) / 9) for i in range(10)]
cab['upperWindows']['note'] = ("Pan Am's 747SPs' ten a side (N532PA, Paris, July 1985: the sources), placed between doors 1 and 2 on "
                               "the photo (11.68-16.32 m); their heights and width are the 747-400 sheet's.")

# Checks: the 747SP's printed figures.
fin_x = max(x for x, _ in fin['trailing'])
crown_at_fin = main
meas = {
    'fuselage length': SP_TAIL,
    'fuselage width': r3(2 * max(y for _, y in fu['halfWidth'])),
    'wingspan': r3(2 * max(y for y, _ in w['leading'] + w['trailing'])),
    'tailplane span': r3(2 * max(y for y, _ in st['leading'] + st['trailing'])),
    'tailplane tip from the nose': max(x for _, x in st['trailing']),
    'fin tip above the crown': r3(max(z for _, z in fin['leading'] + fin['trailing']) - crown_at_fin),
    'engine out from the centerline': shape['engines'][0]['y'],
    'outboard engine out from the centerline': shape['engines'][1]['y'],
    'overall length': r3(max(SP_TAIL, fin_x)),
    **{f'{n} from the nose': v for n, v in door_mid.items()},
    'upper deck door from the nose': r3(sum(hatch['x']) / 2),
    'forward cargo door from the nose': r3(sum(keep[4]['x']) / 2),
    'aft cargo door from the nose': r3(sum(keep[5]['x']) / 2),
}
printed = {
    'fuselage length': 53.87, 'fuselage width': 6.5, 'wingspan': 59.64, 'tailplane span': 25.22,
    'tailplane tip from the nose': 55.85, 'fin tip above the crown': 10.76,
    'engine out from the centerline': 11.94, 'outboard engine out from the centerline': 21.18, 'overall length': 56.31,
    'door 1 from the nose': 9.5, 'door 2 from the nose': 16.41, 'door 3 from the nose': 31.6, 'door 4 from the nose': 41.35,
    'upper deck door from the nose': 8.0, 'forward cargo door from the nose': 13.34, 'aft cargo door from the nose': 35.94,
}
shape['checks'] = [{'dimension': k, 'printed': v, 'shape': meas[k], 'off': f'{100 * (meas[k] / v - 1):+.1f}%'} for k, v in printed.items()]
shape.update({'id': 'B74S', 'name': 'Boeing 747SP', 'types': ['B74S'], 'confidence': 'medium'})
DOC = 'https://www.boeing.com/content/dam/boeing/v2/airports/acaps/747_123sp.pdf'
shape['sources'] = [
    {'url': 'https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/747-400_Rev_F.pdf',
     'title': 'Boeing, 747-400 Airplane Characteristics for Airport Planning (D6-58326-1 Rev F, December 2024), 2.2.1 General Dimensions: Model 747-400',
     'accessed': '2026-11-25',
     'note': ("The nose, cockpit, section, main-deck windows, doors, wing, nacelles, fin and tailplane heights are the 747-400's measured outlines "
              "(shapes/B744-passenger.json; the upper deck is the 747-400F's short one, shapes/B744.json), taken apart and changed by "
              "tools/trace/b74s/derive.py as the 747SP pages of D6-58326 say.")},
    {'url': DOC,
     'title': 'Boeing, 747 Airplane Characteristics for Airport Planning, Models 747-100, -200, -300, SP (D6-58326, May 1984, the 2023 reissue on boeing.com): 2.2.2 General Dimensions, Model 747SP (August 1975); 2.3.3 Ground Clearances, Model 747SP; 2.7.1-2.7.2 Main Entry Door Locations; 2.7.6, 2.7.10-2.7.12 Door Clearances',
     'accessed': '2026-11-25',
     'note': ("A scan: 2.2.2 is drawn in lines about 0.35 m thick on a 5 ft grid (about 22 px a meter), too coarse to trace. Its figures "
              "(the 56.31 m overall length to the fin's top, 53.87 m to the tail cone, 55.85 m to the tailplane's tip, 59.64 m span, "
              "25.22 m tailplane, 6.5 m width, engines 11.94 m and 21.18 m out), 2.3.3's fin tip 10.76 m above the crown, and the door "
              "tables' positions (doors at 9.50, 16.41, 31.60 and 41.35 m; 1984 tables 2.7.1 for the 747-100's) set the plugs, the tail's "
              "size and the squeezed aft body; the tailplane's plan and the aft body's taper are read off the scan to about 0.15 m (see the "
              "derive script). The JT9D-7 nacelles aren't told apart from the 747-400's RB211s at the scan's resolution, so the 747-400's "
              "stand in for them. The SP's single-slotted flaps' track fairings aren't drawn on the scan: the 747-400's four stand in. "
              "Confidence medium.")},
    {'url': 'https://commons.wikimedia.org/wiki/File:Boeing_747SP-21,_Pan_American_World_Airways_-_Pan_Am_AN1014020.jpg',
     'title': 'Boeing 747SP-21 N532PA, Pan Am, Paris, 17 July 1985 (Wikimedia Commons, GFDL 1.2)',
     'accessed': '2026-11-25',
     'note': "Left side, nearly side-on: the upper deck's ten windows, placed between doors 1 and 2. Only measurements are taken; nothing of the photo is copied."},
]
text = json.dumps(shape, indent=1)
text = re.sub(r'\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]', r'[\1, \2]', text)
open('shapes/B74S.json', 'w').write(text + '\n')
for c in shape['checks']: print(f"{c['dimension']:40} printed {c['printed']:7} shape {c['shape']:7} {c['off']}")
print('windows', len(win), [r3(x) for x in win])
print('stab', st['leading'], st['trailing'][:2])
print('fin', fin['leading'][-1], fin['trailing'][-1], fin['trailing'][0])
