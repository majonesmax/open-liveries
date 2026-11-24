# windshield.py shapes/<TYPE>.json [...], after smooth.py (and tipmeet.py): the windshield meets its twin on the nose's
# centerline, which from the side is the outline's top (docs/SHAPES.md, Cockpit). Drawings place the panes only
# roughly up there (Boeing's 737 Classic sheets up to 0.23 m low), so in the fuselage texture the left and right
# windshields stopped short of each other across the crown. Where they do (the glass's highest point is more than
# 0.02 of the texture's height from the crown: tools/validate.py's check), the windshield, the pane reaching nearest
# the outline's top, has its post put on the outline: the edge rising steeply from its foremost point along its upper
# side (to where its top edge levels off), put on the outline, with the outline's own points between, so the
# post follows its curve: each of its points within REACH under the outline is lifted onto it (a pane drawn low: the
# 737 Classics' up to 0.23 m). A point further under (where the drawn edge runs down the nose's side, not its
# centerline: the ATRs') stays, as do the pane's other points; there the post's foot wants the front view. Over an
# upper deck (a 747's) the outline's top is the deck's crown.
import json, math, re, subprocess, sys
import numpy as np

REACH = 0.25   # m: the furthest a drawing's post has been found under the outline (the 737-300's, 0.23 m)
MEET = 0.02    # the texture's share: tools/validate.py's tolerance


def outline(shape):
    fu = shape['fuselage']; crown = np.array(sorted(fu['crown']), float); belly = np.array(sorted(fu['belly']), float)
    deck = np.array(sorted(fu['hump']['crown']), float) if 'hump' in fu else None
    xs = sorted({x for x, _ in fu['crown']} | ({x for x, _ in fu['hump']['crown']} if deck is not None else set()))
    def top(x):
        z = float(np.interp(x, *crown.T))
        if deck is not None and deck[0, 0] <= x <= deck[-1, 0]: z = max(z, float(np.interp(x, *deck.T)))
        return z
    return top, (lambda x: float(np.interp(x, *belly.T))), xs


def gap(shape):
    """tools/validate.py's windshield_gap: how far short of the crown the glass stops, in the texture's share."""
    top, bottom, _ = outline(shape); best = -1.0
    for pane in shape['cockpit']['windows']:
        for x, z in pane:
            t, b = top(x), bottom(x); r = (t - b) / 2 or 1
            best = max(best, math.asin(max(-1.0, min(1.0, (z - (t + b) / 2) / r))) * 2 / math.pi)
    return 1 - best


def meet(shape):
    """The windshield's post put on the outline's top where the glass stops short of it; returns the most a point
    moved (m), 0 where nothing moved."""
    panes = shape['cockpit']['windows']
    if not panes or gap(shape) <= MEET: return 0.0
    top, _, xs = outline(shape)
    under = lambda p: top(p[0]) - p[1]
    k = min(range(len(panes)), key=lambda i: min(under(p) for p in panes[i]))
    pane = panes[k]; n = len(pane)
    f = min(range(n), key=lambda i: (pane[i][0], -pane[i][1]))                 # the foremost point
    # The post rises from there along the pane's upper side (the neighbour that's higher), as long as it climbs
    # steeply: where it levels off (under 0.3 m a meter) the pane's top edge begins, off the centerline.
    step = 1 if pane[(f + 1) % n][1] >= pane[(f - 1) % n][1] else -1
    path = [f]
    while len(path) < n:
        i, j = path[-1], (path[-1] + step) % n
        dx, dz = pane[j][0] - pane[i][0], pane[j][1] - pane[i][1]
        if dz <= 0 or dx < 0 or dz < 0.3 * dx: break
        path.append(j)
    t = path[-1]
    # Each point of the post within REACH under the outline lifted onto it (a pane drawn low). A point further under
    # stays where it's measured: there the drawn edge runs down the nose's side rather than its centerline (the ATRs'),
    # and where the post's foot is wants the front view, as for the C-17 (docs/SHAPES.md, Cockpit).
    onto = lambda p: [round(p[0], 3), round(top(p[0]), 3)]
    moved_to = {i: onto(pane[i]) for i in path if 0 < under(pane[i]) <= REACH}
    if not moved_to: return 0.0
    moved = max(math.dist(pane[i], q) for i, q in moved_to.items())
    out = []
    for j in range(n):                                                         # round the pane in its own order
        i = (f + step * j) % n
        out.append(moved_to.get(i, pane[i]))
        # Between two points of the post on the outline, the outline's own points.
        nxt = (f + step * (j + 1)) % n
        if i in moved_to and nxt in moved_to and i != t:
            a, b = moved_to[i][0], moved_to[nxt][0]
            out += [[round(x, 3), round(top(x), 3)] for x in (xs if a < b else xs[::-1]) if min(a, b) < x < max(a, b)]
    panes[k] = out
    return moved


if __name__ == '__main__':
    for path in sys.argv[1:]:
        text = open(path).read(); shape = json.loads(text)
        moved = meet(shape)
        if moved and text.startswith('{\n "'):   # build.py's layout, as smooth.py keeps it
            open(path, 'w').write(re.sub(r'\[\s+(-?[0-9.e-]+),\s+(-?[0-9.e-]+)\s+\]', r'[\1, \2]',
                                         json.dumps(shape, indent=1, ensure_ascii=False)) + '\n')
        elif moved:
            open(path, 'w').write(json.dumps(shape, indent=2, ensure_ascii=False) + '\n')
            subprocess.run(['npx', 'prettier', '--write', path], check=True, capture_output=True)
        print(f"{path}: windshield post {'moved up to %.3f m' % moved if moved else 'already on the outline'}")
