# The L-1011-500 TriStar (shapes/L101-500.json) from the L-1011-1's measured shape (shapes/L101.json, read off
# Lockheed's L-1011 Maintenance Manual, chapter 6). No openly available document draws the -500: the maintenance
# manual's chapter 6 covers the standard-body aircraft only (its figures are EFFECTIVITY: ALL for the -1, -100 and
# -200), and Lockheed's -500 airport-planning and maintenance documents aren't in the open. So, as the 777-8 is from
# the 777-9 (docs/SHAPES.md), the -500 is the -1's measured outlines with its published differences:
#
# - Its fuselage is 4.11 m (13 ft 6 in) shorter: 164 ft 2.5 in overall against the -1's 177 ft 8.5 in, as
#   Lockheed's published figures give them. Where the plugs come out isn't published in the open. They're placed
#   2.54 m between doors 1 and 2 and 1.57 m behind the wing, where the -1's Type A door 3 was (the -500 has three Type
#   A doors a side: the -1's doors 1 and 2, and an aft one at the -1's Type I door 4). Two side-on photos of Pan Am's
#   N514PA (November 1984, the shape's sources), fitted by perspective to the nose, door 1 and the fin's tip, put
#   door 2 within 0.5 m and the aft door within 0.9 m of where that puts them (17.5 m and 38.9 m from the nose). They
#   show 18 windows between doors 1 and 2 and 35 from door 2 to the aft door, where the -1's row with these plugs
#   gives 20 and 38: the -500's cabin leaves blanks behind its doors that the -1's drawn row doesn't, which this shape
#   doesn't know. The plugs are placed where the -1's crown, belly and width run straight, so its lines join without
#   a step.
# - Its wing is 9 ft longer (164 ft 4 in span against 155 ft 4 in): the -1's, its tips carried out 1.37 m each along
#   the straight runs of its leading and trailing edges and its middle line, as the -500's extended tips continue its
#   planform. The active ailerons don't show.
# - Everything else is the -1's (moved with the plugs): the fin, tailplane, the S-duct intake and tail engine, the
#   RB211 nacelles (the -500's RB211-524s aren't told apart here), the cockpit and the lower deck's doors (the -500's
#   aren't documented in the open). The -500's fillet under the centre intake and its wing-to-body fairing aren't
#   modeled. Confidence low.
#
# Usage: derive.py   (from the repo root; writes shapes/L101-500.json, then run tools/trace/windshield.py on it)
import json, re

src = json.load(open('shapes/L101.json'))
r3 = lambda v: round(v, 3)
PITCH = 0.508
CUTS = [(10.4, 2.54), (35.93, 1.57)]               # (start on the -1, length): ahead of door 2; door 3's place
SHORT = sum(n for _, n in CUTS)


def body(x):
    for at, n in CUTS:
        if at < x < at + n: return None
    return x - sum(n for at, n in CUTS if x >= at + n)


part = lambda x0: sum(n for at, n in CUTS if at < x0)

shape = json.loads(json.dumps(src))
fu = shape['fuselage']
for line in ('crown', 'belly', 'halfWidth'):
    fu[line] = [[r3(body(x)), v] for x, v in fu[line] if body(x) is not None]
fu['length'] = r3(src['fuselage']['length'] - SHORT)
for k in shape['fin']:
    s = part(shape['fin']['leading'][0][0])
    shape['fin'][k] = [[r3(x - s), z] for x, z in shape['fin'][k]]
s = part(shape['stabilizer']['leading'][0][1])
for k in ('leading', 'trailing'):
    shape['stabilizer'][k] = [[y, r3(x - s)] for y, x in shape['stabilizer'][k]]


def move(obj, s):
    """Every x in an engine's lines moved by s."""
    for k, v in obj.items():
        if k in ('x', 'strut'): obj[k] = [r3(a - s) for a in v]
        elif k == 'cowlEnd': obj[k] = r3(v - s)
        elif k in ('top', 'bottom', 'halfWidth') and v and isinstance(v[0], list): obj[k] = [[r3(a - s), b] for a, b in v]
        elif k == 'nozzle': move(v, s)
        elif k == 'propeller': pass


for e in shape['engines']:
    move(e, part(e['x'][0]))

# The wing: moved with the forward plug, its tips carried out to the -500's span along their straight runs.
SEMI = 50.09 / 2
w = shape['wing']
ws = part(w['leading'][0][1])


def extend(pts, y_from, y_cut):
    """[y, v] points up to y_cut, then on to SEMI along the line from y_from to y_cut."""
    keep = [p for p in pts if p[0] <= y_cut]
    def at(y):
        for (y0, v0), (y1, v1) in zip(pts, pts[1:]):
            if y0 <= y <= y1: return v0 + (v1 - v0) * (y - y0) / ((y1 - y0) or 1e-9)
    a, b = at(y_from), at(y_cut)
    slope = (b - a) / (y_cut - y_from)
    if keep[-1][0] < y_cut: keep.append([r3(y_cut), r3(b)])
    return keep + [[r3(SEMI), r3(b + slope * (SEMI - y_cut))]]


w['leading'] = [[y, r3(x - ws)] for y, x in extend(w['leading'], 16.6, 22.6)]
w['trailing'] = [[y, r3(x - ws)] for y, x in extend(w['trailing'], 19.6, 23.0)]
w['z'] = extend(w['z'], 17.6, 23.0)

# Doors: the -1's moved by the plugs; its door 3 is gone and its Type I door 4 is a Type A door the size of the others.
cab = shape['cabin']
doors = []
for d in cab['doors']:
    mid = (d['x'][0] + d['x'][1]) / 2
    if d['kind'] == 'door' and 35.0 < mid < 37.5: continue
    sh = sum(n for at, n in CUTS if mid > at)
    d['x'] = [r3(d['x'][0] - sh), r3(d['x'][1] - sh)]
    if d['kind'] == 'exit':
        half = 0.533; m = (d['x'][0] + d['x'][1]) / 2
        d.update({'kind': 'door', 'x': [r3(m - half), r3(m + half)], 'z': list(src['cabin']['doors'][2]['z'])})
    doors.append(d)
cab['doors'] = doors
xs = [body(x) for x in src['cabin']['windows']['x']]
xs = [x for x in xs if x is not None]
win = []
for a, b in zip(xs, xs[1:]):
    win.append(a)
    if b - a > 1.5 * PITCH and not any(a < d['x'][0] and d['x'][1] < b for d in doors if d['kind'] == 'door'):
        n = round((b - a) / PITCH)
        win += [a + (b - a) * i / n for i in range(1, n)]
win.append(xs[-1])
aft = max((d for d in doors if d['kind'] == 'door'), key=lambda d: d['x'][0])
win = [x for x in win if x < aft['x'][0] - 0.5]
cab['windows']['x'] = [r3(x) for x in win]
cab['windows']['note'] = ("The L-1011-1's (Lockheed's maintenance manual 6-10-00 Figure 1, on the 20 in pitch) moved with the -500's plugs, door 3's place "
                          "filled at the pitch. N514PA (the sources) shows 18 between doors 1 and 2 and 35 from door 2 to the aft door where this row has 19 and 38: its blanks behind the doors aren't known.")
mains = sorted((d for d in doors if d['kind'] == 'door'), key=lambda d: d['x'][0])
n_fwd = sum(1 for x in win if mains[1]['x'][1] < x < mains[2]['x'][0] + 9) if len(mains) > 2 else 0

span = 2 * max(y for y, _ in w['leading'] + w['trailing'])
meas = {'overall length': fu['length'], 'wingspan': r3(span),
        'fuselage shorter than the L-1011-1': r3(src['fuselage']['length'] - fu['length'])}
printed = {'overall length': 50.05, 'wingspan': 50.09, 'fuselage shorter than the L-1011-1': 4.11}
shape['checks'] = [{'dimension': k, 'printed': v, 'shape': meas[k], 'off': f'{100 * (meas[k] / v - 1):+.1f}%'} for k, v in printed.items()]
shape.update({'id': 'L101-500', 'name': 'Lockheed L-1011-500 TriStar', 'types': ['L101'], 'confidence': 'low'})
shape['sources'] = [
    {**src['sources'][0], 'accessed': '2026-11-25',
     'note': ("The -1's outlines (shapes/L101.json, tools/trace/l101/) are this shape's, taken apart by tools/trace/l101-500/derive.py: this chapter "
              "covers the standard-body aircraft only and no openly available document draws the -500. Its door stations (Figure 6: L1 FS 304.5, "
              "L2 FS 873.0, L3 FS 1513.0, L4 FS 1778.0) are the stations the plugs and doors are placed by.")},
    {'url': 'https://en.wikipedia.org/wiki/Lockheed_L-1011_TriStar',
     'title': "Lockheed L-1011 TriStar, Wikipedia: Specifications (L-1011-1 and L-1011-500: length 177 ft 8.5 in and 164 ft 2.5 in, span 155 ft 4 in and 164 ft 4 in)",
     'accessed': '2026-11-25',
     'note': ("Lockheed's published dimensions as tabled there: the -500's fuselage 13 ft 6 in (4.11 m) shorter than the -1's and its span 9 ft longer "
              "(the extended tips). The -1's 177 ft 8.5 in is 0.27 m under the maintenance manual's 178 ft 7.5 in nose to tail cone, which scales "
              "shapes/L101.json, so this shape's length is 0.5% over the -500's 164 ft 2.5 in.")},
    {'url': 'https://commons.wikimedia.org/wiki/File:Lockheed_L-1011-385-3_TriStar_500,_Pan_American_World_Airways_-_Pan_Am_AN0402355.jpg',
     'title': 'Lockheed L-1011-385-3 TriStar 500 N514PA, Pan Am, Rio de Janeiro, November 1984 (Wikimedia Commons, CC BY-SA 3.0, Pedro Aragão)',
     'accessed': '2026-11-25',
     'note': ("Left side, nearly side-on: three doors a side; fitted by perspective to the nose, door 1 and the fin's tip, it puts door 2 within 0.5 m and "
              "the aft door within 0.9 m of this shape's (the plugs' split isn't published in the open). Only measurements are taken; nothing of the photo is copied.")},
    {'url': 'https://commons.wikimedia.org/wiki/File:Lockheed_L-1011-500_Tristar,_Pan_Am_JP5869430.jpg',
     'title': 'Lockheed L-1011-500 TriStar N514PA, Pan Am, Rio de Janeiro, 1984 (Wikimedia Commons, CC BY-SA 3.0, Pedro Aragão)',
     'accessed': '2026-11-25',
     'note': "The same aircraft and day from a little further forward: the doors and window counts checked (18 and 35). Only measurements are taken."},
]
text = json.dumps(shape, indent=1, ensure_ascii=False)
text = re.sub(r'\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]', r'[\1, \2]', text)
open('shapes/L101-500.json', 'w').write(text + '\n')
for c in shape['checks']: print(f"{c['dimension']:40} printed {c['printed']:7} shape {c['shape']:7} {c['off']}")
print('doors', [(d['kind'], d['x'], d.get('side')) for d in doors])
segs = [sum(1 for x in win if a['x'][1] < x < b['x'][0]) for a, b in zip(mains, mains[1:])]
print('windows', len(win), 'between doors', segs)
