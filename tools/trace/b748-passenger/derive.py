# The 747-8 Intercontinental (shapes/B748-passenger.json) from the 747-400's measured shape (shapes/B744-passenger.json,
# traced on D6-58326-1's vector sheet), as the 747-8F (b748/derive.py) is from the 747-400F's: the same two fuselage
# plugs from the 747-8 door table (D6-58326-3 Rev E 2.7.1: 4.10 m ahead of the wing, 1.49 m behind it), and the 747-8F's
# wing and GEnx-2B nacelles (shapes/B748.json, read off that document's scans). What's the -8I's own:
#
# - The upper deck: the 747-400's, with the forward plug under it (16.0 m), so 4.10 m longer, as the 747-8 document's
#   side views draw it (2.2.2 and 2.7.1: its cabin's end 6.8 m behind door 2's middle on both types). Both scans draw the
#   hump's fairing running on to the main crown about 1 m further aft than the 747-400's (to 34.2-34.4 m, 0.47 m ahead of
#   door 3's middle on 2.7.1, where the 747-400's own 2.7.1 and general-dimensions sheets have it 1.53 m ahead): its last
#   0.15 m of height tapers out to 34.3 m instead of ending in the 747-400's step at 33.2 m.
# - Windows: the scans are too coarse to place them (about 8 px a meter; their upper-deck rows don't count alike), so the
#   upper deck's windows and door are measured on two side-on Wikimedia Commons photos of Lufthansa 747-8Is (D-ABYS,
#   D-ABYQ: the shape's sources), each scaled by a perspective fit to the four visible main doors' windows at the door
#   table's figures (residuals under 0.06 m), agreeing within 0.19 m; the two photos' mean. Korean Air's (HL7642,
#   looked at, not measured) have the same layout: 9 windows, the door, 15, a gap, 2. The main deck's are the 747-400
#   sheet's moved with the plugs, the plugs filled at its 0.508 m pitch; the photos' agree within 0.2 m where they show
#   them (Lufthansa blanks some behind door 2: a cabin fit, left out of a type's shape).
# - Doors: the 747-400's moved with the plugs land within 0.06 m of 2.7.1's five door positions and its cargo doors'.
#   2.7.1's figure (a left-side view) draws the three lower cargo doors dashed, on the far side: the bulk door too is
#   on the right (the 747-400 shape has it on the left, by the other widebodies' rule).
#
# Usage: derive.py   (from the repo root; writes shapes/B748-passenger.json, then smooth.py on it isn't needed: every
# line here is a measured shape's)
import json, re

src = json.load(open('shapes/B744-passenger.json'))
f8 = json.load(open('shapes/B748.json'))
PLUGS = [(16.0, 4.10), (37.5, 1.49)]
L8 = 74.22
PITCH = 0.508                                   # the 747's 20 in frame and window pitch
plugged = lambda x: x + sum(n for at, n in PLUGS if x > at)
r3 = lambda v: round(v, 3)

shape = json.loads(json.dumps(src))
fu = shape['fuselage']
for line in ('crown', 'belly', 'halfWidth'):
    fu[line] = [[r3(plugged(x)), v] for x, v in fu[line]]
fu['length'] = L8
main = fu['hump']['crown'][-1][1]               # the main crown's level under the hump
hump = [[r3(plugged(x)), z] for x, z in fu['hump']['crown'] if plugged(x) <= 32.85]
hump += [[33.2, r3(main + 0.125)], [33.6, r3(main + 0.08)], [34.0, r3(main + 0.035)], [34.3, main]]
fu['hump']['crown'] = hump
tail = sum(n for _, n in PLUGS)
for k in shape['fin']:
    shape['fin'][k] = [[r3(x + tail), z] for x, z in shape['fin'][k]]
for k in ('leading', 'trailing'):
    shape['stabilizer'][k] = [[y, r3(x + tail)] for y, x in shape['stabilizer'][k]]

# The 747-8's wing (raked tips: no wingtip device) and GEnx-2B nacelles, as the 747-8F's.
shape['wing'] = json.loads(json.dumps(f8['wing']))
shape['engines'] = json.loads(json.dumps(f8['engines']))
shape.pop('wingtip', None)

# Doors: the 747-400's with the plugs; the upper deck's door where the photos place it.
cab = shape['cabin']
for d in cab['doors']:
    d['x'] = [r3(plugged(d['x'][0])), r3(plugged(d['x'][1]))]
up_door = next(d for d in cab['doors'] if d['z'][0] > 1)
w = up_door['x'][1] - up_door['x'][0]
up_door['x'] = [r3(15.69 - w / 2), r3(15.69 + w / 2)]
names = ['door 1', 'door 2', 'door 3', 'door 4', 'door 5']
mains = sorted((d for d in cab['doors'] if d['kind'] == 'door' and d['z'][0] < 0), key=lambda d: d['x'][0])
door_mid = {n: r3((d['x'][0] + d['x'][1]) / 2) for n, d in zip(names, mains)}
cargo = sorted((d for d in cab['doors'] if d['kind'] == 'cargo'), key=lambda d: d['x'][0])
for d in cargo:
    d['side'] = 'right'                         # 2.7.1 draws all three lower cargo doors dashed: the far (right) side
cargo_mid = {n: r3((d['x'][0] + d['x'][1]) / 2) for n, d in zip(['forward cargo door', 'aft cargo door', 'bulk cargo door'], cargo)}

# Main-deck windows: the 747-400 sheet's with the plugs, each plug's gap filled at the pitch.
xs = [plugged(x) for x in cab['windows']['x']]
spans = [(at + sum(n for a, n in PLUGS if a < at), n) for at, n in PLUGS]   # each plug's start in the new frame, length
filled = []
for a, b in zip(xs, xs[1:]):
    filled.append(a)
    if any(a < s0 + n and b > s0 for s0, n in spans) and b - a > 1.5 * PITCH:
        k = round((b - a) / PITCH)
        filled += [a + (b - a) * i / k for i in range(1, k)]
filled.append(xs[-1])
cab['windows']['x'] = [r3(x) for x in filled]
cab['windows']['note'] = ("The 747-400 sheet's windows (D6-58326-1 2.2.1, drawn there), moved with the 747-8's two plugs and the plugs "
                          "filled at the 0.508 m pitch; two side-on photos of Lufthansa 747-8Is (the sources) agree within 0.2 m where they show them.")
# Upper deck: the two photos' mean (meters from the nose).
cab['upperWindows']['x'] = [10.561, 11.085, 11.595, 12.096, 12.606, 13.114, 13.621, 14.135, 14.642, 16.653, 17.176, 17.672, 18.188,
                            18.696, 19.217, 19.73, 20.23, 20.742, 21.241, 21.746, 22.268, 22.772, 23.275, 23.777, 25.832, 26.337]
cab['upperWindows']['note'] = ("Measured on two side-on Wikimedia Commons photos of Lufthansa 747-8Is (D-ABYS, D-ABYQ: the sources), each scaled by a "
                               "perspective fit to the main doors' windows at the door table's figures; they agree within 0.19 m and this is their mean. "
                               "Heights and width are the 747-400 sheet's.")

# Checks: the 747-8's printed figures (2.2.2 General Dimensions: Model 747-8; 2.7.1 Door Locations).
fin_x = max(x for x, z in shape['fin']['trailing'])
st_x = max(x for y, x in shape['stabilizer']['trailing'])
meas = {'fuselage length': L8, 'fuselage width': r3(2 * max(y for x, y in fu['halfWidth'])),
        'wingspan': r3(2 * max(y for y, x in shape['wing']['leading'] + shape['wing']['trailing'])),
        'tailplane span': r3(2 * max(y for y, x in shape['stabilizer']['leading'])),
        'engine out from the centerline': shape['engines'][0]['y'], 'outboard engine out from the centerline': shape['engines'][1]['y'],
        'engine inlet from the nose': shape['engines'][0]['x'][0], 'outboard engine inlet from the nose': shape['engines'][1]['x'][0],
        'wing tip leading edge from the nose': shape['wing']['leading'][-1][1], 'overall length': r3(max(L8, fin_x, st_x)),
        **{f'{n} from the nose': v for n, v in door_mid.items()}, **{f'{n} from the nose': v for n, v in cargo_mid.items()}}
printed = {'fuselage length': 74.22, 'fuselage width': 6.5, 'wingspan': 68.4, 'tailplane span': 21.99,
           'engine out from the centerline': 11.93, 'outboard engine out from the centerline': 21.18,
           'engine inlet from the nose': 27.25, 'outboard engine inlet from the nose': 35.86,
           'wing tip leading edge from the nose': 51.94, 'overall length': 76.25,
           'door 1 from the nose': 9.5, 'door 2 from the nose': 22.9, 'door 3 from the nose': 34.7, 'door 4 from the nose': 46.3,
           'door 5 from the nose': 60.8, 'forward cargo door from the nose': 13.3, 'aft cargo door from the nose': 50.67,
           'bulk cargo door from the nose': 54.28}
shape['checks'] = [{'dimension': k, 'printed': v, 'shape': meas[k], 'off': f'{100 * (meas[k] / v - 1):+.1f}%'} for k, v in printed.items()]
shape.update({'id': 'B748-passenger', 'name': 'Boeing 747-8 Intercontinental', 'types': ['B748'], 'confidence': 'medium'})
shape['sources'] = [
    {'url': 'https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/747-400_Rev_F.pdf',
     'title': 'Boeing, 747-400 Airplane Characteristics for Airport Planning (D6-58326-1 Rev F, December 2024), 2.2.1 General Dimensions: Model 747-400, and 2.7.1 Door Locations',
     'accessed': '2026-11-15',
     'note': ("The fuselage, upper deck, fin, tailplane, doors, cockpit and main-deck windows are the 747-400's measured outlines (shapes/B744-passenger.json, "
              "tools/trace/b744-passenger/) with the 747-8's two plugs (tools/trace/b748-passenger/derive.py). Its 2.7.1 figure puts the "
              "upper deck's fairing end 1.53 m ahead of door 3's middle, as its general-dimensions sheet does.")},
    {'url': 'https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/747-8_Rev_E.pdf',
     'title': 'Boeing, 747-8 Airplane Characteristics for Airport Planning (D6-58326-3 Rev E, January 2026), 2.2.2 General Dimensions: Model 747-8, and 2.7.1 Door Locations',
     'accessed': '2026-11-15',
     'note': ("Low-resolution binarized scans, too coarse to trace: the plugs from the door table (doors 2 and 3 4.1 m, doors 4 and 5 5.6 m further back than the "
              "747-400's; 74.22 m nose to tail cone), the wing and GEnx-2B nacelles as the 747-8F's (shapes/B748.json), and the upper deck read off both side views: "
              "4.10 m longer than the 747-400's (its cabin's end 6.8 m behind door 2 on both types), its fairing running out about 1 m further aft (to 34.3 m, "
              "0.47 m ahead of door 3 on 2.7.1). 2.2.2's side view draws door 3 about 3.5 m forward of the table's 34.7 m, which 2.7.1's figure doesn't: the table's kept. "
              "Neither scan's windows can be placed or counted to a window (about 8 px a meter): those are from the photos. Confidence medium for the scans and photos.")},
    {'url': 'https://commons.wikimedia.org/wiki/File:D-ABYS_AIRCRAFT_Boeing_747-830_-1e.jpg',
     'title': 'Sg1959, D-ABYS AIRCRAFT Boeing 747-830 -1e, 2026-06-20 (Wikimedia Commons, CC BY-SA 4.0)',
     'accessed': '2026-11-15',
     'note': ("Upper-deck windows and door, and a check of the main deck's: each one's middle along the cabin (left side, side-on from below), scaled by a "
              "perspective fit to the visible main doors' windows (doors 1, 2, 4 and 5 at the door table's figures). Only measurements are taken; nothing of the photo is copied.")},
    {'url': 'https://commons.wikimedia.org/wiki/File:D-ABYQ_AIRCRAFT_Boeing_747-830_(2c).jpg',
     'title': 'Sg1959, D-ABYQ AIRCRAFT Boeing 747-830 (2c), 2026-08-04 (Wikimedia Commons, CC BY-SA 4.0)',
     'accessed': '2026-11-15',
     'note': ("As D-ABYS: reads 0.09-0.19 m aft of it throughout. Only measurements are taken; nothing of the photo is copied.")},
    {'url': 'https://commons.wikimedia.org/wiki/File:HL7642_(55238706822).jpg',
     'title': 'Liam Thompson, HL7642, 2026-04-08 (Wikimedia Commons, CC BY-SA 4.0)',
     'accessed': '2026-11-15',
     'note': "Korean Air 747-8I, left side: looked at for the upper deck's window layout (9, the door, 15, a gap, 2), the same as Lufthansa's; not measured."}]
text = json.dumps(shape, indent=1)
text = re.sub(r'\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]', r'[\1, \2]', text)
open('shapes/B748-passenger.json', 'w').write(text + '\n')
for c in shape['checks']: print(f"{c['dimension']:40} printed {c['printed']:7} shape {c['shape']:7} {c['off']}")
print('windows', len(filled), cab['windows']['x'])
