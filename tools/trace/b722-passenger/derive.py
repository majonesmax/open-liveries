# The passenger 727-200 (shapes/B722-passenger.json) from the 727-200F's measured shape (shapes/B722.json, traced on
# D6-58324 2.2's 1978 scan). The outline, wing, tail and engines are the freighter's. What's the passenger aircraft's:
#
# - Windows. 2.2 draws them (the freighter's recipe leaves them out), but at about 40 px a meter on graph paper, its
#   grid's lines run through the row, and it draws the run a little long (25 windows ahead of the first overwing exit at
#   0.515 m). Two side-on Wikimedia Commons photos settle the count: Eastern's N819EA (left side, 1982) and Piedmont's
#   N555PS (right side), each scaled by door middles of 2.7's table. 26 windows behind the entry door (the first
#   1.05 m behind its middle: 2.2, 2.7's figure and the photo agree), the first overwing exit, 2 windows, the second
#   exit, 15 windows, the aft service door, 2 windows (the second behind the side nacelle from the side). On the 727's
#   20 in (0.508 m) pitch, with the photos' and the drawing's wider steps round the exits (3.3 pitches exit to exit).
#   Exits' windows are windows (as on the 737 and MD-80 shapes), the doors' aren't. The right side's first five, where
#   its galley door is, are blank on the aircraft (N555PS: 21 windows ahead of its exit); the shape has one row for
#   both sides, the left's. Eastern blanks two ahead of its aft door on the left (a cabin fit, left out).
#   Height: the row's middle 1.57 m under the crown at mid-cabin (N819EA, TWA's N64339 and Pan Am's N4740 by their
#   door spacing: 1.56-1.58 m; 2.2 draws 1.45-1.55 m), 0.34 m tall and 0.25 m wide (N819EA; the
#   737's window, the same 20 in frame). One height for the row, the mid-cabin's: with the sheet's skew (below) its
#   ends sit up to 0.08 m off the drawn row.
# - Doors. The freighter's entry door (left), forward galley service door (right) and lower cargo doors stay. Its
#   main-deck cargo door goes. Added: the two Type III overwing exits (both sides, 20 by 38 in from 2.4's 134-seat
#   plan, placed by the window count above, their windows in their upper half as the photos show), and the aft
#   service doors (Type I, both sides: 2.4 "RH & LH"; 2.7's table: 0.76 by 1.52 m, its sill 0.27 m above the entry
#   door's by the table's ground-to-sill heights, as the freighter's doors are placed). Where along: 2.7's table prints
#   29.6 m to its middle, but 2.2 draws it at 29.25 m (1.35 m ahead of the side nacelle's lip, as both photos show it)
#   while drawing every other door within 0.03 m of the table. N555PS, scaled by three doors of the table that agree
#   within 0.06 m (the galley service door, the forward and the optional aft cargo doors), puts it at 29.47 m, and
#   counting N819EA's windows on the pitch at 29.4-29.5: so 29.47. The exits by the same photo: 19.33 and 21.00 m
#   (the shape's, from the count: 19.29 and 20.97).
# - Straight runs. The scan's crown and belly step 2-4 cm every few meters along the cabin, and its
#   width the same from above. The cabin is a cylinder, so those runs are set to their least-squares line, as
#   a30b/straighten.py does: the crown from 8.1 to 30.66 m, the belly ahead of the wing's fairing (5.65-13.63 m), under
#   it (16.21-22.38 m) and behind it (23.70-28.10 m), the width from 6.81 to 30.06 m. The sheet is skewed about 0.4°
#   (the crown rises 0.15 m from 9 to 30 m, the forward belly alike); the lines keep it, as the freighter's do.
#
# Usage: derive.py   (from the repo root; writes shapes/B722-passenger.json)
import json, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from smooth import write  # noqa: E402  (the shapes' own layout)

src_text = open('shapes/B722.json').read()
shape = json.loads(src_text)
r3 = lambda v: round(float(v), 3)
PITCH = 0.508                                   # the 727's 20 in frame and window pitch


def flat(pts, x0, x1):
    """Points from x0 to x1 replaced by the least-squares line through them (two points), as a30b/straighten.py."""
    inside = [p for p in pts if x0 <= p[0] <= x1]
    a, b = np.polyfit([p[0] for p in inside], [p[1] for p in inside], 1)
    return [p for p in pts if p[0] < x0] + [[x0, r3(a * x0 + b)], [x1, r3(a * x1 + b)]] + [p for p in pts if p[0] > x1]


fu = shape['fuselage']
fu['crown'] = flat(fu['crown'], 8.105, 30.66)
belly = fu['belly']
for x0, x1 in ((5.645, 13.633), (16.209, 22.378), (23.704, 28.103)):
    belly = flat(belly, x0, x1)
fu['belly'] = belly
fu['halfWidth'] = flat(fu['halfWidth'], 6.807, 30.064)

# The cabin made level: 2.2 draws the aircraft at its ground attitude, the cabin's crown rising 0.44° aft (its fitted
# line, as the forward belly's), the tail sitting high (2.7's sills: the aft door's 0.27 m over the entry door's). The
# shape's window row is one height, so the whole side view is turned about the wing (20.6 m) to bring the cabin level,
# its windows parallel to its crown as on the aircraft (N64339 shows its row within 0.05 m of parallel).
cr = fu['crown']
lo, hi = next(p for p in cr if p[0] == 8.105), next(p for p in cr if p[0] == 30.66)
SLOPE, MREF = (hi[1] - lo[1]) / (hi[0] - lo[0]), 20.6
lev = lambda m, z: r3(z - SLOPE * (m - MREF))
levline = lambda pts: [[x, lev(x, z)] for x, z in pts]
fu['crown'], fu['belly'] = levline(fu['crown']), levline(fu['belly'])
fin = shape['fin']
for k in ('leading', 'trailing', 'rudder', 'fillet'):
    if k in fin:
        fin[k] = levline(fin[k])


def span_x(surface, y):
    """Mid-chord x at span y of a surface given [y, x] edges."""
    le, te = np.array(surface['leading']), np.array(surface['trailing'])
    return (np.interp(y, le[:, 0], le[:, 1]) + np.interp(y, te[:, 0], te[:, 1])) / 2


for part in ('wing', 'stabilizer'):
    s = shape[part]
    s['z'] = [[y, lev(span_x(s, y), z)] for y, z in s['z']]
for e in shape['engines']:
    for k in ('top', 'bottom'):
        e[k] = levline(e[k])
    if 'nozzle' in e:
        for k in ('top', 'bottom'):
            e['nozzle'][k] = levline(e['nozzle'][k])
    if 'inlet' in e:
        e['inlet']['z'] = lev(e['x'][0], e['inlet']['z'])
    if 'pylon' in e:
        py = e['pylon']
        e['pylon']['z'] = [[y, lev(span_x(py, y), z)] for y, z in py['z']]
shape['cockpit']['windows'] = [levline(pane) for pane in shape['cockpit']['windows']]
for d in shape['cabin']['doors']:
    m = (d['x'][0] + d['x'][1]) / 2
    d['z'] = [lev(m, d['z'][0]), lev(m, d['z'][1])]
CROWN = fu['crown'][[p[0] for p in fu['crown']].index(8.105)][1]   # the cabin's level crown

# Windows (left side, front to back).
first = 5.03 + 1.05                             # 1.05 m behind the entry door's middle (2.7: 5.03 m)
fwd = [first + PITCH * i for i in range(26)]    # 26 to the first exit
exit1 = fwd[-1] + PITCH                         # the first exit's window, on the pitch (photo: +0.54)
between = [exit1 + 0.54, exit1 + 1.08]          # 2 windows; the photos' and drawing's steps
exit2 = between[-1] + 0.60
aft = [exit2 + 0.56 + PITCH * i for i in range(15)]   # N819EA 0.49, N555PS 0.62
DOOR5 = 29.47                                   # N555PS (2.7 prints 29.6, 2.2 draws 29.25): see above
behind = [DOOR5 + 0.75, DOOR5 + 0.75 + PITCH]   # 2.2's two behind it (N555PS: the first 0.79 m, 2.2 0.71)
xs = fwd + [exit1] + between + [exit2] + aft + behind
MID, H = r3(CROWN - 1.57), 0.34                # the row's middle, 1.57 m under the cabin's crown
shape['cabin']['windows'] = {
    'z': [r3(MID - H / 2), r3(MID + H / 2)],
    'width': 0.25,
    'x': [r3(x) for x in xs],
    'note': ("The 727-200's row as two side-on photos count it (2.2 draws it, too coarsely to count): 26 windows "
             "behind the entry door, the overwing exits with 2 between them, 15, the aft service door, 2. On the "
             "0.508 m pitch, wider round the exits. The left side's: on the right the galley door blanks the first "
             "five."),
}

entry = next(d for d in shape['cabin']['doors'] if d['kind'] == 'door' and d.get('side') == 'left')
sill = entry['z'][0]
doors = [d for d in shape['cabin']['doors'] if not (d['kind'] == 'cargo' and d.get('side') == 'left')]
EXIT_W, EXIT_H = 0.51, 0.97                     # Type III, 20 by 38 in (2.4)
EXIT_MID = MID - 0.06                           # its window in its upper half (N819EA: 0.11 of its height above)
for x in (exit1, exit2):
    doors.append({'kind': 'exit', 'x': [r3(x - EXIT_W / 2), r3(x + EXIT_W / 2)],
                  'z': [r3(EXIT_MID - EXIT_H / 2), r3(EXIT_MID + EXIT_H / 2)]})
aft_sill = sill + ((3.31 + 2.74) - (3.07 + 2.45)) / 2   # 2.7: ground to sill, the middles of max and min
aft_sill -= SLOPE * (DOOR5 - (entry['x'][0] + entry['x'][1]) / 2)   # less the attitude's share, the cabin level
doors.append({'kind': 'door', 'x': [r3(DOOR5 - 0.38), r3(DOOR5 + 0.38)], 'z': [r3(aft_sill), r3(aft_sill + 1.52)]})
doors.sort(key=lambda d: (d['kind'] == 'cargo', d['x'][0]))
shape['cabin']['doors'] = doors

shape['id'] = 'B722-passenger'
shape['name'] = 'Boeing 727-200'
boeing = shape['sources'][0]
boeing['title'] = ("Boeing, 727 Airplane Characteristics for Airport Planning (D6-58324, June 1978, revised May 2011), "
                   "2.2 General Dimensions: Model 727-200, 2.3 Ground Clearances, 2.4 Interior Arrangements: Model "
                   "727-200, 2.7 Door Clearances: Models 727-100, -100C and 727-200")
boeing['accessed'] = '2026-11-24'
boeing['note'] = (
    "The 727-200F's measured shape (shapes/B722.json; tools/trace/b722/) with the passenger aircraft's windows and "
    "doors (tools/trace/b722-passenger/derive.py). Outline, wing, tail and engines as the freighter's: read off 2.2's "
    "side, plan and front views, a 1978 scan on graph paper scaled by the printed 41.50 m to the tail cone; the figures "
    "are the aircraft's measurements, not a copy of the drawing. The tail's edges are straight lines and fitted curves "
    "through the scan's line centres (tools/trace/b722/straighten.py). Its crown, belly and width along the cabin are set to "
    "their least-squares lines (the scan steps 2-4 cm). Doors: the entry door (left), forward galley service door "
    "(right) and lower-deck cargo doors (right) at 2.7's 727-200 table, as on the freighter; the two Type III overwing "
    "exits each side (20 by 38 in, 2.4); the aft service doors each side (2.4, Type I; 0.76 by 1.52 m, 2.7; at 29.47 m by "
    "the photo of N555PS, where 2.7 prints 29.6 and 2.2 draws 29.25; the sill from 2.7's ground-to-sill heights "
    "against the entry door's). The window row's count and "
    "spacing from two side-on photos (the other sources), 2.2's drawn row agreeing within a window.")
shape['sources'] = [boeing] + [
    {'url': 'https://commons.wikimedia.org/wiki/File:Eastern_Air_Lines_N819EA,_Las_Vegas_-_Harry_Reid_International,_October_1982.jpg',
     'title': 'Eastern Air Lines N819EA, Las Vegas - Harry Reid International, October 1982 (Leslie Snelleman, CC BY-SA 4.0)',
     'accessed': '2026-11-24',
     'note': ("A 727-225 from its left side, near side-on. Scaled by the door table's entry and aft service doors' middles: "
              "26 windows behind the entry door, the two overwing exits with 2 between, 13 and two blank (Eastern's), "
              "the aft door. The row's height and the windows' size. Measured, not copied.")},
    {'url': 'https://commons.wikimedia.org/wiki/File:Piedmont_Airlines_Boeing_727-200_Silagi-1.jpg',
     'title': 'Piedmont Airlines Boeing 727-200 N555PS (Richard Silagi, GFDL)',
     'accessed': '2026-11-24',
     'note': ("From its right side, side-on. Scaled by the door table's galley service door and forward and optional aft cargo doors (agreeing within 0.06 m): from the back, "
              "a window behind the aft door, the door, 15 windows, the exits with 2 between, 21 and the blank stretch "
              "to the galley door. Measured, not copied.")},
]

out = 'shapes/B722-passenger.json'
write(out, src_text, shape)
print(out, len(xs), 'windows;', 'exits', r3(exit1), r3(exit2), '; last before the aft door', r3(aft[-1]))
