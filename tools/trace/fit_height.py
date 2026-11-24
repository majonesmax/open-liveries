# Fit a shape's fuselage to the printed height, where the side view draws the tube taller or shorter than the
# document's own figure while its front view agrees with it (Boeing's 757, 767 and 737 Classic sheets: docs/SHAPES.md).
# The crown and belly, and what sits on the tube (cabin windows, doors, cockpit panes), are scaled about the
# centerline by printed over drawn (the tube's least height across its middle third where crown and belly both run
# level: a wing-body fairing only adds, and a 737's belly already sweeps up toward the tail inside that third);
# the fin moves with the crown under it, keeping its height above the crown. Wings, tailplane and engines stay.
#
# Usage: fit_height.py shapes/<TYPE>.json [...]   (after build.py and smooth.py; rewrites the files in place)
import json, re, subprocess, sys
import numpy as np


def write(path, text, shape):
    """In the file's own layout, as smooth.py writes it."""
    if text.startswith('{\n "'):
        out = re.sub(r'\[\s+(-?[0-9.e-]+),\s+(-?[0-9.e-]+)\s+\]', r'[\1, \2]', json.dumps(shape, indent=1, ensure_ascii=False))
        open(path, 'w').write(out + '\n')
    else:
        open(path, 'w').write(json.dumps(shape, indent=2, ensure_ascii=False) + '\n')
        subprocess.run(['npx', 'prettier', '--write', path], check=True, capture_output=True)


r3 = lambda v: round(float(v), 3)
for path in sys.argv[1:]:
    text = open(path).read(); shape = json.loads(text); fu = shape['fuselage']
    check = next(c for c in shape['checks'] if c['dimension'] == 'fuselage height')
    crown, belly = np.asarray(fu['crown'], float), np.asarray(fu['belly'], float)
    # The tube's height: the least across the middle third (a wing-body fairing only adds to it), where crown and
    # belly both run level (under 1 cm a meter: not where the belly has begun its sweep up to the tail).
    mid = np.linspace(fu['length'] / 3, 2 * fu['length'] / 3, 200)
    ci, bi = np.interp(mid, *crown.T), np.interp(mid, *belly.T)
    level = (np.abs(np.gradient(ci, mid)) < 0.01) & (np.abs(np.gradient(bi, mid)) < 0.01)
    k = check['printed'] / float(np.min((ci - bi)[level] if level.any() else ci - bi))
    lift = lambda x: (k - 1) * float(np.interp(x, crown[:, 0], crown[:, 1]))   # the crown's move at x
    for part in ('leading', 'trailing', 'fillet', 'rudder'):
        if part in shape['fin']: shape['fin'][part] = [[x, r3(z + lift(x))] for x, z in shape['fin'][part]]
    for e in shape['engines']:
        if e.get('mount') == 'tail':   # on the crown under the fin (the MD-11's, the 727's intake): it moves with them
            for line in ('top', 'bottom'): e[line] = [[x, r3(z + lift(x))] for x, z in e[line]]
            for line in e.get('nozzle', {}): e['nozzle'][line] = [[x, r3(z + lift(x))] for x, z in e['nozzle'][line]]
            if 'inlet' in e: e['inlet']['z'] = r3(e['inlet']['z'] + lift(e['x'][0]))
    for line in ('crown', 'belly'): fu[line] = [[x, r3(z * k)] for x, z in fu[line]]
    if 'hump' in fu: fu['hump']['crown'] = [[x, r3(z * k)] for x, z in fu['hump']['crown']]   # a 747's upper deck
    cabin = shape.get('cabin', {})
    if 'windows' in cabin: cabin['windows']['z'] = [r3(z * k) for z in cabin['windows']['z']]
    if 'upperWindows' in cabin: cabin['upperWindows']['z'] = [r3(z * k) for z in cabin['upperWindows']['z']]
    for door in cabin.get('doors', []): door['z'] = [r3(z * k) for z in door['z']]
    if 'cockpit' in shape:
        shape['cockpit']['windows'] = [[[x, r3(z * k)] for x, z in pane] for pane in shape['cockpit']['windows']]
    check['shape'] = r3(check['shape'] * k); check['off'] = f"{100 * (check['shape'] / check['printed'] - 1):+.1f}%"
    write(path, text, shape)
    print(f'{path}: fuselage height x {k:.4f}')
