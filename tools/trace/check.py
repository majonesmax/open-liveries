# Draw a shape file's outlines back onto the drawing it came from, by the recipe's references: a check that the
# file alone reproduces the drawing. Writes r_side.png, r_nose.png, r_tail.png, r_plan.png and r_front.png.
# Usage: check.py recipe.json shape.json workdir  (workdir: the rasters side/plan/front.png and the snapped files)
import json, sys, math
import numpy as np
from PIL import Image, ImageDraw
rc = json.load(open(sys.argv[1])); s = json.load(open(sys.argv[2])); out = here = sys.argv[3]
R = rc['refs']; ppm = (R['side']['tail'] - R['side']['nose']) / rc['length']
side = json.load(open(f"{here}/{rc['files']['side']}"))
cr = np.array(sorted(side['fuselage.crown'])); be = np.array(sorted(side['fuselage.belly']))
xs = np.linspace(R['side']['nose'] + rc['length'] * ppm / 3, R['side']['nose'] + 2 * rc['length'] * ppm / 3, 200)
centre = float(np.median((np.interp(xs, *cr.T) + np.interp(xs, *be.T)) / 2))
Sx = lambda x: R['side']['nose'] + x * ppm; Sz = lambda z: centre - z * ppm
RED, BLUE, GREEN, MAG = (230, 0, 0), (0, 110, 255), (0, 170, 0), (200, 0, 200)

def draw(img, pts, f, col, w=5, close=False):
    q = [f(*p) for p in pts]
    if close: q = q + q[:1]
    ImageDraw.Draw(img).line(q, fill=col, width=w)

# Side
im = Image.open(f"{here}/side.png").convert('RGB')
S = lambda x, z: (Sx(x), Sz(z))
fu = s['fuselage']
for k, c in (('crown', RED), ('belly', RED)): draw(im, fu[k], S, c)
if 'hump' in fu: draw(im, fu['hump']['crown'], S, RED)
for k in ('leading', 'trailing', 'fillet', 'rudder'):
    if k in s['fin']: draw(im, s['fin'][k], S, BLUE)
for e in s['engines']: draw(im, e['top'], S, GREEN); draw(im, e['bottom'], S, GREEN)
for k in ('leading', 'trailing'):
    if 'wingtip' in s: draw(im, s['wingtip'][k], S, MAG)
for p in s['cockpit']['windows']: draw(im, p, S, MAG, 4, True)
wz = s['cabin']['windows']['z']; ww = s['cabin']['windows']['width']
for x in s['cabin']['windows']['x']: draw(im, [(x - ww / 2, wz[0]), (x + ww / 2, wz[0]), (x + ww / 2, wz[1]), (x - ww / 2, wz[1])], S, MAG, 3, True)
if 'upperWindows' in s['cabin']:
    uz = s['cabin']['upperWindows']['z']; uw = s['cabin']['upperWindows']['width']
    for x in s['cabin']['upperWindows']['x']: draw(im, [(x - uw / 2, uz[0]), (x + uw / 2, uz[0]), (x + uw / 2, uz[1]), (x - uw / 2, uz[1])], S, MAG, 3, True)
for d in s['cabin']['doors']: draw(im, [(d['x'][0], d['z'][0]), (d['x'][1], d['z'][0]), (d['x'][1], d['z'][1]), (d['x'][0], d['z'][1])], S, GREEN, 4, True)
im.resize((im.width // 3, im.height // 3), Image.LANCZOS).save(f'{out}/r_side.png')
W, H = im.size; n0 = R['side']['nose']; Lp = rc['length'] * ppm
im.crop((max(0, int(n0 - 0.02 * Lp)), int(H * 0.35), int(n0 + 0.2 * Lp), H)).save(f'{out}/r_nose.png')
tail = im.crop((int(n0 + 0.7 * Lp), 0, W, H)); tail.resize((tail.width // 2, tail.height // 2), Image.LANCZOS).save(f'{out}/r_tail.png')
# Plan
im = Image.open(f"{here}/plan.png").convert('RGB')
P = lambda x, y: (R['plan']['nose'] + x * ppm, R['plan']['centerline'] - y * ppm)
PY = lambda y, x: P(x, y)
draw(im, fu['halfWidth'], P, RED)
for part, c in (('wing', BLUE), ('stabilizer', GREEN)):
    draw(im, s[part]['leading'], PY, c); draw(im, s[part]['trailing'], PY, c)
im.resize((im.width // 4, im.height // 4), Image.LANCZOS).save(f'{out}/r_plan.png')
# Front
im = Image.open(f"{here}/front.png").convert('RGB')
crown_z = float(np.interp(rc['length'] / 2, *np.array(fu['crown']).T))
F = lambda y, z: (R['front']['centerline'] + y * ppm, R['front']['crownTop'] + (crown_z - z) * ppm)
draw(im, s['wing']['z'], F, BLUE); draw(im, s['stabilizer']['z'], F, GREEN); draw(im, s['wingtip']['front'], F, MAG) if 'wingtip' in s else None
w2 = max(y for x, y in fu['halfWidth']); zt = max(z for x, z in fu['crown']); zb = min(z for x, z in fu['belly']); zw = fu['widest']
ell = [(w2 * math.sin(t), zw + ((zt - zw) if math.cos(t) > 0 else (zw - zb)) * math.cos(t)) for t in np.linspace(0, math.pi, 60)]
draw(im, ell, F, RED)
for e in s['engines']:
    if 'inlet' not in e: continue
    ie = e['inlet']; ring = [(e['y'] + ie['width'] / 2 * math.cos(t), ie['z'] + ie['height'] / 2 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 80)]
    draw(im, ring, F, GREEN)
fr = im.crop((int(R['front']['centerline'] - 0.12 * im.width), 0, im.width, im.height)); fr.resize((fr.width // 3, fr.height // 3), Image.LANCZOS).save(f'{out}/r_front.png')
