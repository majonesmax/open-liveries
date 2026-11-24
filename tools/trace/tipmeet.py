# tipmeet.py shapes/<TYPE>.json, after smooth.py: a wingtip device starts on the wing's tip (docs/SHAPES.md): its side-view edges from the
# wing tip's leading and trailing edges at the wing's tip height, then the drawing above their lowest quarter; its
# front line from the wing's tip. (What commit 1a5ff8d applied to the shapes then measured.)
import json, sys
f = sys.argv[1]; d = json.load(open(f))
w, t = d['wing'], d['wingtip']
yt, xl = w['leading'][-1]; xt = w['trailing'][-1][1]; zt = w['z'][-1][1]
for k, x0 in (('leading', xl), ('trailing', xt)):
    pts = t[k]; top = max(z for x, z in pts); cut = zt + 0.25 * (top - zt)
    t[k] = [[round(x0, 3), round(zt, 3)]] + [p for p in pts if p[1] >= cut]
t['front'] = [[round(yt, 3), round(zt, 3)]] + [p for p in t['front'] if p[0] > yt + 1e-6]
import re
open(f, 'w').write(re.sub(r'\[\s+(-?[0-9.e-]+),\s+(-?[0-9.e-]+)\s+\]', r'[\1, \2]', json.dumps(d, indent=1, ensure_ascii=False)) + '\n')
print(f, 'wingtip from', yt, xl, xt, zt)
