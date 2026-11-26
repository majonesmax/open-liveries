# The 747-100/-200 passenger aircraft (shapes/B742.json, serving B741 and B742) from the 747-400's measured shape
# (shapes/B744-passenger.json, traced on D6-58326-1's vector sheet) and the 747-100/-200/-300/SP document's pages for
# the 747-100B and -200 (D6-58326, May 1984: 2.2.1 General Dimensions, Models 747-100B, -200, -300; 2.3.1 Ground
# Clearances; 2.7.1 Main Entry Door Locations; 2.7.6 Upper Deck Exit Door). Those pages are scans like the SP's (lines
# about 0.35 m thick over a 5 ft grid), too coarse to trace. The 747-100 and -200 share the 747-400's fuselage (the
# same 68.63 m to the tail cone, section, nose and five main doors a side: 2.7.1's 9.50, 18.80, 30.61, 40.74, 55.14 m
# are the 747-400's within 0.03 m), fin and tailplane. So, as the 747SP is (b74s/derive.py), it's the 747-400's
# outlines with what's the -100/-200's own:
#
# - The upper deck: the original short one, which the 747-400F keeps (shapes/B744.json), laid on the passenger
#   aircraft's main crown. 2.2.1's side view draws it ending at about 22 m (the -300's stretched deck dashed over it).
# - Its door: 2.7.6's 0.61 by 1.22 m upper deck exit door, both sides, at 8.00 m (26 ft 3 in), at the SP's height. The
#   747-400's Type A upper deck door (at 15.3 m) isn't the -100/-200's.
# - Its windows: three a side, 1.52 m apart (three frames), 12.45-15.50 m back, at the 747-400's upper-deck heights.
#   That's what most photos of 1983-86 Pan Am, TWA, People Express and Braniff 747s show: the 747-121s (N750PA 1983,
#   N739PA 1986, a 1985 -121), TWA's 747-131s (1984, 1985), People Express's 747-143 (1986) and Braniff's 747-127
#   (1979, 1981). Placed on TWA's side-on 747-131 (1985) by doors 1 and 2 (12.34, 13.87, 15.39 m) and on People
#   Express's 747-143 (12.83-15.95 m, from ahead of the wing), meaned. Later -200Bs were built or converted with ten
#   a side (Pan Am's 747-212Bs, People Express's and Braniff's 747-227Bs): not drawn.
# - The wing: the 747-400's without its 1.83 m tip extensions and winglets, cut at 2.2.1's printed 59.64 m (195 ft
#   8 in). No winglets. The engines are where the 747-400's are on it (11.97 m and 21.18 m out): 2.2.1's front view
#   draws their inlets 11.9 m and 21.1 m out, though its plan prints 39 ft 9 in (12.1 m) and 69 ft 10 in (21.3 m).
#   Their outlines are the 747-400 sheet's RB211-524H nacelles: the -100/-200's JT9D-7s are drawn on the scan within
#   its line's width of them (inlets at about 23.6 m and 32.0 m against 23.8 m and 32.5 m), which can't tell the two
#   apart (see the source's note).
#
# Usage: derive.py   (from the repo root; writes shapes/B742.json: every line here is a measured shape's, so
# smooth.py and windshield.py leave it as it is)
import json, re

src = json.load(open('shapes/B744-passenger.json'))
frt = json.load(open('shapes/B744.json'))           # the 747-400F: the 747-100's short upper deck
r3 = lambda v: round(v, 3)

shape = json.loads(json.dumps(src))
fu = shape['fuselage']
main = src['fuselage']['hump']['crown'][-1][1]     # the main crown's level under the hump
dz = frt['fuselage']['hump']['crown'][-1][1] - main
hump = json.loads(json.dumps(frt['fuselage']['hump']))
hump['crown'] = [[x, r3(z - dz)] for x, z in hump['crown']]
hump['section'] = [[y, r3(z - dz)] for y, z in hump['section']]
fu['hump'] = hump

# The wing: the 747-400's cut at the printed span; no winglets.
SEMI = 59.64 / 2
w = shape['wing']


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


w['leading'] = cut(w['leading'], 0)
w['trailing'] = cut(w['trailing'], 0)
w['z'] = cut(w['z'], 0)
shape.pop('wingtip', None)

# Doors: the 747-400's main and lower cargo doors; 2.7.6's upper deck exit door instead of the -400's Type A.
cab = shape['cabin']
up = [d for d in cab['doors'] if d['kind'] == 'door' and d['z'][0] > 1]
hatch = {'kind': 'exit', 'x': [r3(8.0 - 0.305), r3(8.0 + 0.305)], 'z': [2.37, 3.59]}
cab['doors'] = [d for d in cab['doors'] if d not in up]
cab['doors'].insert(5, hatch)
uw = cab['upperWindows']
uw['x'] = [12.45, 13.975, 15.5]
uw['note'] = ("Three a side, three frames apart: the 747-100's original upper deck, as 1983-86 photos of Pan Am's 747-121s, TWA's "
              "747-131s, People Express's 747-143 and Braniff's 747-127 show it (TWA's 1985 747-131 side-on: 12.34, 13.87, 15.39 m by "
              "doors 1 and 2; People Express's 747-143: 12.83-15.95 m; meaned). Their heights and width are the 747-400 sheet's. "
              "Some -200Bs had ten a side (Pan Am's 747-212Bs, People Express's and Braniff's 747-227Bs): not drawn.")

# Checks: 2.2.1's, 2.3.1's and 2.7's printed figures for the 747-100B and -200.
fin = shape['fin']
mains = sorted((d for d in cab['doors'] if d['kind'] == 'door'), key=lambda d: d['x'][0])
st = shape['stabilizer']
meas = {
    'fuselage length': fu['length'],
    'fuselage width': r3(2 * max(y for _, y in fu['halfWidth'])),
    'wingspan': r3(2 * max(y for y, _ in w['leading'] + w['trailing'])),
    'tailplane span': r3(2 * max(y for y, _ in st['leading'] + st['trailing'])),
    'tailplane tip from the nose': r3(max(x for _, x in st['trailing'])),
    'overall length': r3(max(fu['length'], max(x for x, _ in fin['trailing']))),
    'fin tip above the crown': r3(max(z for _, z in fin['leading'] + fin['trailing']) - main),
    'engine out from the centerline': shape['engines'][0]['y'],
    'outboard engine out from the centerline': shape['engines'][1]['y'],
    **{f'door {i + 1} from the nose': r3(sum(d['x']) / 2) for i, d in enumerate(mains)},
    'upper deck door from the nose': r3(sum(hatch['x']) / 2),
}
printed = {
    'fuselage length': 68.63, 'fuselage width': 6.5, 'wingspan': 59.64, 'tailplane span': 22.17,
    'tailplane tip from the nose': 69.85, 'overall length': 70.66, 'fin tip above the crown': 10.15,
    'engine out from the centerline': 12.12, 'outboard engine out from the centerline': 21.29,
    'door 1 from the nose': 9.5, 'door 2 from the nose': 18.8, 'door 3 from the nose': 30.61, 'door 4 from the nose': 40.74,
    'door 5 from the nose': 55.14, 'upper deck door from the nose': 8.0,
}
shape['checks'] = [{'dimension': k, 'printed': v, 'shape': meas[k], 'off': f'{100 * (meas[k] / v - 1):+.1f}%'} for k, v in printed.items()]
shape.update({'id': 'B742', 'name': 'Boeing 747-200', 'types': ['B742', 'B741'], 'confidence': 'medium'})
DOC = 'https://www.boeing.com/content/dam/boeing/v2/airports/acaps/747_123sp.pdf'
shape['sources'] = [
    {'url': 'https://www.boeing.com/content/dam/boeing/boeingdotcom/commercial/airports/acaps/747-400_Rev_F.pdf',
     'title': 'Boeing, 747-400 Airplane Characteristics for Airport Planning (D6-58326-1 Rev F, December 2024), 2.2.1 General Dimensions: Model 747-400',
     'accessed': '2026-11-25',
     'note': ("The nose, cockpit, fuselage, main-deck windows, doors, wing, nacelles, fin and tailplane are the 747-400's measured outlines "
              "(shapes/B744-passenger.json; the upper deck is the 747-400F's short one, shapes/B744.json), changed by "
              "tools/trace/b742/derive.py as D6-58326's 747-100B/-200 pages say.")},
    {'url': DOC,
     'title': 'Boeing, 747 Airplane Characteristics for Airport Planning, Models 747-100, -200, -300, SP (D6-58326, May 1984, the 2023 reissue on boeing.com): 2.2.1 General Dimensions, Models 747-100B, -200, -300; 2.3.1 Ground Clearances; 2.7.1 Main Entry Door Locations; 2.7.6 Upper Deck Exit Door',
     'accessed': '2026-11-25',
     'note': ("A scan: 2.2.1 is drawn in lines about 0.35 m thick on a 5 ft grid, too coarse to trace. Its figures (225 ft 2 in to the "
              "tail cone, 231 ft 10 in overall, printed 70.4 m but 70.66 m in feet, 229 ft 2 in to the tailplane's tips, 195 ft 8 in span, "
              "72 ft 9 in tailplane, 21 ft 4 in width) are the 747-400's but the span, which is cut to it. Its plan prints the engines "
              "39 ft 9 in and 69 ft 10 in out (12.1 m, 21.3 m); its front view draws their inlets 11.9 m and 21.1 m out, where the "
              "747-400's are kept (11.97 m, 21.18 m). 2.3.1 puts the fin's tip 9.64-10.15 m above the aft crown (K less H, "
              "minimum and maximum: two attitudes); the 747-400's fin is 10.08 m, kept. 2.7.1's doors (9.50, 18.80, 30.61, 40.74, "
              "55.14 m) are the 747-400's. The upper deck exit door is 2.7.6's (0.61 by 1.22 m at 8.00 m). The JT9D-7 nacelles "
              "aren't told apart from the 747-400's RB211s at the scan's resolution, so the 747-400's stand in for them. "
              "Confidence medium.")},
    {'url': 'https://commons.wikimedia.org/wiki/File:Boeing_747-131,_Trans_World_Airlines_(TWA)_JP5896855.jpg',
     'title': 'Boeing 747-131, Trans World Airlines (TWA), 1985 (Wikimedia Commons, GFDL 1.2, Jon Proctor)',
     'accessed': '2026-11-25',
     'note': "Right side, nearly side-on: the upper deck's three windows, placed by doors 1 and 2. Only measurements are taken; nothing of the photo is copied."},
    {'url': 'https://commons.wikimedia.org/wiki/File:Boeing_747-143,_PEOPLExpress_AN1040695.jpg',
     'title': 'Boeing 747-143, PEOPLExpress, 1986 (Wikimedia Commons, GFDL 1.2, Tim Rees)',
     'accessed': '2026-11-25',
     'note': "Left side, from ahead of the wing: the upper deck's three windows, placed by doors 1 and 2. Only measurements are taken."},
    {'url': 'https://commons.wikimedia.org/wiki/File:Pan_American_World_Airways_-_Pan_Am_Boeing_747-121_N739PA_%22Clipper_Maid_of_the_Seas%22_(25017912834).jpg',
     'title': 'Boeing 747-121 N739PA, Pan Am, July 1986 (Wikimedia Commons, CC BY 2.0, Kambui)',
     'accessed': '2026-11-25',
     'note': "Right side: three upper-deck windows and the upper deck exit door behind the flight deck. Looked at, not measured."},
]
text = json.dumps(shape, indent=1)
text = re.sub(r'\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]', r'[\1, \2]', text)
open('shapes/B742.json', 'w').write(text + '\n')
for c in shape['checks']: print(f"{c['dimension']:40} printed {c['printed']:7} shape {c['shape']:7} {c['off']}")
