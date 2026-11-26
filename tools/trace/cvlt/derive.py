# The Convair 580 (CVLT) from the Convair 340 airframe traced off the C-131B's technical order (recipe.json, built by
# build.py into shapes/CVLT.json) and the 580's own parts measured on a side-on photo (photo.json). Step 2 of 2:
#
#   build.py cvlt/recipe.json WORKDIR   (the 340: 79 ft 2 in, three-bladed R-2800 placeholders)
#   derive.py cvlt/photo.json shapes/CVLT.json
#   smooth.py shapes/CVLT.json; windshield.py shapes/CVLT.json
#
# What it does, in meters (docs/SHAPES.md's axes):
# - The 580 is 0.71 m longer (81 ft 6 in against 79 ft 2 in): its weather-radar nose. The photo puts the extra length
#   ahead of the nose gear (nose tip to nose wheel 3.16 m against the drawing's 7 ft 11 in, the main wheels and tail
#   cone where the 340's are), so the 340's lines move aft by it and the photo's nose takes their place. The photo's
#   crown and belly are taken up to `nose_crown_blend[0]` / `nose_belly_blend[0]` and eased into the drawing's over
#   the rest of the range; the plan's width ahead of `nose_width_blend[0]` is the photo's half depth (a round radome),
#   eased into the plan's.
# - The fin (fillet, leading and trailing edges, rudder hinge) is the photo's: the 580's enlarged fin. Its leading
#   edge's foot is its straight run carried down to the crown, as build.py does.
# - The nacelle and propeller are the photo's (Allison 501-D13, four blades): side outline, spinner, the disc's plane
#   and hub; across, the drawing's 12 ft 6 in; the plan's width is estimated (photo.json's halfWidth, in meters).
# - The tailplane keeps the 340's planform, set at the photo's height at its root.
# - The photo looks down on the aircraft by a few degrees (photo.json's cameraAbove): what stands out toward the
#   camera (the nacelle, the near side's windows, doors and glass) is put back up by its distance from the
#   centerline times the angle's sine. Outlines (the silhouette, the centerline plane's fin and nose) aren't moved.
# - Windows, doors and flight-deck glass are the photo's.
# Checks are rewritten against the 580's published figures.
import json, math, sys
from pathlib import Path
import numpy as np

photo = json.load(open(sys.argv[1])); path = Path(sys.argv[2]); s = json.load(open(path))
N, C, PPM, L = photo['nose'], photo['centerline'], photo['ppm'], photo['length']
D = round(L - s['fuselage']['length'], 3)                       # the radar nose's extra length
X = lambda px: (px - N) / PPM
Z = lambda py: (C - py) / PPM
M = lambda pts: [(X(x), Z(y)) for x, y in pts]
r3 = lambda pts: [[round(float(a), 3), round(float(b), 3)] for a, b in pts]


def thin(pts, tol=0.01):
    pts = np.asarray(pts, float)
    if len(pts) < 3: return pts.tolist()
    a, b = pts[0], pts[-1]; ab = b - a; n = math.hypot(*ab) or 1.0
    d = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / n
    i = int(np.argmax(d))
    if d[i] <= tol: return [a.tolist(), b.tolist()]
    return thin(pts[: i + 1], tol)[:-1] + thin(pts[i:], tol)


# 1. Everything along x moves aft by the nose's extra length.
sx = lambda pts: [[x + D, v] for x, v in pts]                    # [x, z] / [x, y]
sy = lambda pts: [[y, x + D] for y, x in pts]                    # plan edges: [y, x]
fu = s['fuselage']
for k in ('crown', 'belly', 'halfWidth'): fu[k] = sx(fu[k])
for k in ('leading', 'trailing'):
    s['wing'][k] = sy(s['wing'][k]); s['stabilizer'][k] = sy(s['stabilizer'][k])

# 2. The nose: the photo's, eased into the drawing's.
def blend(drawn, measured, a, b, n=400):
    drawn = np.array(sorted(drawn)); measured = np.array(sorted(measured))
    xs = np.unique(np.concatenate([np.linspace(0, b, n), drawn[:, 0][drawn[:, 0] > b], measured[:, 0]]))
    out = []
    for x in xs:
        m = float(np.interp(x, *measured.T))
        if x <= a or x < drawn[0, 0]: v = m
        else:
            d = float(np.interp(x, *drawn.T)); w = max(0.0, min(1.0, (b - x) / (b - a)))
            v = d + w * (m - d)
        out.append((float(x), v))
    return out
crown_m, belly_m = M(photo['nose_crown']), M(photo['nose_belly'])
crown_m[0] = (0.0, crown_m[0][1]); belly_m[0] = (0.0, crown_m[0][1])   # one tip
fu['crown'] = r3(thin(blend(fu['crown'], crown_m, *photo['nose_crown_blend'])))
fu['belly'] = r3(thin(blend(fu['belly'], belly_m, *photo['nose_belly_blend'])))
fu['length'] = L
cr, be = np.array(fu['crown']), np.array(fu['belly'])
depth = [(x, (float(np.interp(x, *cr.T)) - float(np.interp(x, *be.T))) / 2) for x in np.linspace(0, photo['nose_width_blend'][1], 60)]
fu['halfWidth'] = r3(thin(blend(fu['halfWidth'], depth, *photo['nose_width_blend']), 0.005))

# 3. The fin.
crown_at = lambda x: float(np.interp(x, *np.array(fu['crown']).T))
f = photo['fin']; lead = M(f['leading']); straight = np.array(lead[:6])
A = np.polyfit(straight[:, 1], straight[:, 0], 1)                # x as a function of z, along the straight run
x_root = float(A[1])
for _ in range(30): x_root = float(np.polyval(A, crown_at(x_root)))
root = (x_root, crown_at(x_root))
s['fin'] = {'leading': r3(thin([root] + [p for p in lead if p[1] > root[1]])), 'trailing': r3(thin(M(f['trailing']))),
            'fillet': r3(thin(M(f['fillet']))), 'rudder': r3(thin(M(f['rudder'])))}

# 4. The tailplane at the photo's height.
st = s['stabilizer']; dz = Z(photo['stabilizerRoot'][1]) - st['z'][0][1]
st['z'] = r3([(y, z + dz) for y, z in st['z']])

# The camera looks down a little (photo.json's cameraAbove): what stands out toward it is drawn low by its distance
# out from the centerline times the angle's sine. The nacelle's and propeller's heights, and the near side's windows,
# doors and glass, are put back.
SIN = math.sin(math.radians(photo.get('cameraAbove', 0)))
def surface(pts):
    out = []
    for x, z in pts:
        c, b = crown_at(x), float(np.interp(x, *np.array(fu['belly']).T))
        zc, r = (c + b) / 2, (c - b) / 2; hw = float(np.interp(x, *np.array(fu['halfWidth']).T))
        out.append((x, z + hw * math.sqrt(max(0.0, 1 - ((z - zc) / r) ** 2)) * SIN))
    return out

# 5. The nacelle and propeller.
e = photo['engine']; p = e['propeller']; lift = e['y'] * SIN
top = sorted((x, z + lift) for x, z in M(e['top'])); bottom = sorted((x, z + lift) for x, z in M(e['bottom']))
s['engines'] = [{
    'x': [round(min(top[0][0], bottom[0][0]), 3), round(max(top[-1][0], bottom[-1][0]), 3)],
    'y': e['y'],
    'top': r3(thin(top)), 'bottom': r3(thin(bottom)),
    'propeller': {'x': round(X(p['x']), 3), 'z': round(Z(p['hub']) + lift, 3), 'diameter': p['diameter'], 'blades': p['blades'],
                  'spinner': {'x': [round(X(p['spinner'][0]), 3), round(X(p['spinner'][1]), 3)],
                              'diameter': round((p['spinnerHeight'][1] - p['spinnerHeight'][0]) / PPM, 3)}},
    'halfWidth': r3([(X(x), w) for x, w in e['halfWidth']]),
}]

# 6. Windows, doors, the flight deck's glass.
w = photo['windows']
mid_x = float(np.median([X(x) for x in w['x']]))
band = [surface([(mid_x, Z(v))])[0][1] for v in (w['band'][1], w['band'][0])]
def box(d):
    (x0, z0), (x1, z1) = surface([(X(d['box'][0]), Z(d['box'][3])), (X(d['box'][2]), Z(d['box'][1]))])
    return [round(x0, 3), round(x1, 3)], [round(z0, 3), round(z1, 3)]
s['cabin'] = {
    'windows': {'z': [round(band[0], 3), round(band[1], 3)], 'width': round(w['width'] / PPM, 3),
                'x': [round(X(x), 3) for x in w['x']],
                'note': "Each window's middle as the photo of ZK-CIE's left side shows it (photo.json): eleven between the forward door and the aft door, one behind it; three are window exits."},
    'doors': [{'kind': d['kind'], 'x': box(d)[0], 'z': box(d)[1], **({'side': d['side']} if 'side' in d else {})}
              for d in photo['doors']],
}
s['cockpit'] = {'windows': [r3(surface(M(pane))) for pane in photo['cockpitPanes']]}

# 7. Checks against the 580's published figures (and the drawing's, for what the 580 keeps).
span = 2 * max(y for y, x in s['wing']['leading'] + s['wing']['trailing'])
crown_z = float(np.median([z for x, z in fu['crown'] if L / 3 <= x <= 2 * L / 3]))
belly_z = float(np.median([z for x, z in fu['belly'] if L / 3 <= x <= 2 * L / 3]))
hw = [y for x, y in fu['halfWidth'] if L / 3 <= x <= 2 * L / 3]
meas = {
    'overall length': L,
    'wingspan': round(span, 3),
    'tailplane span': round(2 * max(y for y, x in st['leading']), 3),
    'fuselage width': round(2 * float(np.median(hw)), 3),
    'fuselage height': round(crown_z - belly_z, 3),
    'engine out from the centerline': e['y'],
    'propeller diameter': p['diameter'],
    'overall height': round(max(z for x, z in s['fin']['leading'] + s['fin']['trailing']) + photo['groundBelowCenterline'], 3),
}
printed = {'overall length': 24.84, 'wingspan': 32.106, 'tailplane span': 11.151, 'fuselage width': 2.87,
           'fuselage height': 2.87, 'engine out from the centerline': 3.81, 'propeller diameter': 4.115, 'overall height': 8.89}
s['checks'] = [{'dimension': k, 'printed': v, 'shape': meas[k], 'off': f'{100 * (meas[k] / v - 1):+.1f}%'} for k, v in printed.items()]
s.update({k: v for k, v in json.load(open(Path(sys.argv[1]).parent / 'meta.json')).items()})

order = ['$schema', 'id', 'name', 'types', 'confidence', 'sources', 'fuselage', 'fin', 'wing', 'stabilizer', 'engines', 'cabin', 'cockpit', 'checks']
s = {k: s[k] for k in order if k in s}
import re
text = re.sub(r'\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]', r'[\1, \2]', json.dumps(s, indent=1))
path.write_text(text + '\n')
print(f'nose +{D} m; fin root at {root[0]:.2f} m')
for c in s['checks']: print(f"{c['dimension']:32} printed {c['printed']:7} shape {c['shape']:7} {c['off']}")
