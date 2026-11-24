# Moves a sibling type's placed points (*.anchors.json) by fuselage plugs, as a start for snapping them onto a
# stretched or shortened type's own sheet (snap.py). Run on the side and plan views; the front view's points are
# copied as they are (a plug doesn't change it).
#
# A plug is where it goes, in meters back from the nose on the sibling, and its length (negative: a stretch taken
# out). The fuselage's lines move point by point: behind a plug, back by its length; inside a removed stretch,
# dropped. Every other part (wing, engine, fin, tailplane, wingtip) moves whole, by the plugs ahead of its root (its
# first point): a wingtip reaching back past the aft plug still rides on the wing.
#
# Usage: plug.py sibling.anchors.json out.anchors.json --ppm PX_PER_M --nose X_PX --plug AT:LEN [--plug AT:LEN]
#        [--scale S --origin X,Y] [--shift DX,DY] [--about TEXT]
#   --ppm, --nose: the sibling's raster scale and nose x (its recipe's refs). --scale: the new sheet's drawing
#   scale over the sibling's (Boeing's 737-7 sheet is drawn 1% smaller than the 737-8's), or SX,SY for one that
#   differs along and across (the A220-300's side raster is evened out lengthwise, the A220-100's isn't; the A330-800's sheet is drawn short, then stretched by layers.py --xscale), about --origin (px, the
#   nose on the side view, the nose's centerline on the plan); --shift then moves every point (px), for a sheet
#   that places the view elsewhere. --about replaces the file's _about.
import argparse, json, re

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out')
ap.add_argument('--ppm', type=float, required=True)
ap.add_argument('--nose', type=float, required=True)
ap.add_argument('--plug', action='append', default=[], help='AT:LEN in meters')
ap.add_argument('--shift', default='0,0')
ap.add_argument('--scale', default='1')
ap.add_argument('--origin', default='0,0')
ap.add_argument('--about')
a = ap.parse_args()
plugs = [(a.nose + float(s.split(':')[0]) * a.ppm, float(s.split(':')[1]) * a.ppm) for s in a.plug]
sx, sy = map(float, a.shift.split(','))
ox, oy = map(float, a.origin.split(','))
kx, ky = (lambda v: (v[0], v[-1]))([float(v) for v in a.scale.split(',')])


def moved(x):
    """x behind the plugs, moved; None inside a removed stretch."""
    d = 0.0
    for at, n in plugs:
        if n < 0 and at <= x < at - n: return None
        if x >= (at if n >= 0 else at - n): d += n
    return d


src = json.load(open(a.src))
out = {}
for key, pts in src.items():
    if key == '_about':
        out[key] = a.about or pts
        continue
    if not isinstance(pts, list):
        out[key] = pts
        continue
    fuselage = key.startswith('fuselage.')
    xy = lambda p: p['free'] if isinstance(p, dict) else p        # snap.py's {"free": [x, y]}, moved as any point
    root = xy(next(p for p in pts if p != 'hidden'))
    whole = None if fuselage else (moved(root[0]) or 0.0)
    line = []
    for p in pts:
        if p == 'hidden':
            if line and line[-1] != 'hidden': line.append(p)
            continue
        q = xy(p)
        d = moved(q[0]) if fuselage else whole
        if d is None: continue
        q = [round(ox + (q[0] + d - ox) * kx + sx), round(oy + (q[1] - oy) * ky + sy)]
        line.append({'free': q} if isinstance(p, dict) else q)
    while line and line[-1] == 'hidden': line.pop()
    out[key] = line
# one point per line in the file, as the hand-placed ones are
text = json.dumps(out, indent=2)
text = re.sub(r'\[\s+(-?\d+),\s+(-?\d+)\s+\]', r'[\1, \2]', text)
open(a.out, 'w').write(text + '\n')
