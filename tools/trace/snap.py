# Snap an outline to the drawing between anchor points (a "live wire"): between each pair of anchors, the
# cheapest path through the raster, where riding a drawn line's centre is cheap and crossing paper is dear.
# A pair joined with "hidden" (a nearer part in front of the outline there) is bridged with a straight line instead.
#
# Anchors pick WHICH line is the outline (the judgement: the windshield's corner is outline, the winglet's edge
# isn't); the drawing gives WHERE it runs, to the pixel.
#
# Usage: snap.py drawing.png anchors.json out.json
#   anchors.json: {"crown": [[x, y], [x, y], "hidden", [x, y], ...], "belly": [...]}  in the PNG's pixels
#   {"free": [x, y]} is a point kept where it's placed, not moved onto a line: a hidden line's end that no line shows
#   (the 717's tail cone under its tailplane, seen from above).
import heapq, json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ink = np.array(Image.open(sys.argv[1]).convert('L')) < 128
H, W = ink.shape
# Inside a line, distance to its edge peaks at its centre: cost falls toward the centre.
depth = ndimage.distance_transform_edt(ink)
cost = np.where(ink, 1.0 + 4.0 / (1.0 + depth), 60.0)
N8 = [(-1, -1, 1.414), (-1, 0, 1), (-1, 1, 1.414), (0, -1, 1), (0, 1, 1), (1, -1, 1.414), (1, 0, 1), (1, 1, 1.414)]


def nearest_ink(x, y, r=25):
    """The anchor moved onto the nearest line centre within r px."""
    y0, y1, x0, x1 = max(0, y - r), min(H, y + r + 1), max(0, x - r), min(W, x + r + 1)
    win = depth[y0:y1, x0:x1]
    if win.max() == 0: raise SystemExit(f'anchor {x},{y}: no line within {r} px')
    yy, xx = np.mgrid[y0:y1, x0:x1]
    # on a line's centre (depth capped, so a blob where lines merge doesn't pull it), and nearest
    score = np.minimum(win, 3) - 0.2 * np.hypot(xx - x, yy - y)
    i = np.unravel_index(np.argmax(np.where(win > 0, score, -1e9)), win.shape)
    return int(xx[i]), int(yy[i])


def route(a, b, pad=120):
    """Cheapest 8-connected path from a to b, searched in their box grown by pad."""
    x0, x1 = max(0, min(a[0], b[0]) - pad), min(W, max(a[0], b[0]) + pad + 1)
    y0, y1 = max(0, min(a[1], b[1]) - pad), min(H, max(a[1], b[1]) + pad + 1)
    c = cost[y0:y1, x0:x1]
    h, w = c.shape
    dist = np.full((h, w), np.inf); prev = np.full((h, w), -1, dtype=np.int64)
    sy, sx, ty, tx = a[1] - y0, a[0] - x0, b[1] - y0, b[0] - x0
    dist[sy, sx] = 0; q = [(0.0, sy, sx)]
    while q:
        d, y, x = heapq.heappop(q)
        if (y, x) == (ty, tx): break
        if d > dist[y, x]: continue
        for dy, dx, s in N8:
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w:
                nd = d + s * c[ny, nx]
                if nd < dist[ny, nx]:
                    dist[ny, nx] = nd; prev[ny, nx] = y * w + x; heapq.heappush(q, (nd, ny, nx))
    path, k = [], ty * w + tx
    while k >= 0:
        y, x = divmod(int(k), w); path.append((x + x0, y + y0))
        if (y, x) == (sy, sx): break
        k = prev[y, x]
    path.reverse()
    paper = sum(1 for x, y in path if not ink[y, x])
    return path, paper


anchors = json.load(open(sys.argv[2]))
out = {}
for name, seq in anchors.items():
    if name.startswith('_'): continue
    pts, hidden, report = [], False, []
    last = None
    for item in seq:
        if item == 'hidden': hidden = True; continue
        p = tuple(item['free']) if isinstance(item, dict) else nearest_ink(*item)
        if last is not None:
            if hidden:
                seg = [last, p]; report.append(f'hidden {last}→{p}')
            else:
                seg, paper = route(last, p)
                if paper > 6: report.append(f'{last}→{p}: {paper} px off the lines (check the anchors)')
            pts += seg if not pts else seg[1:]
        else:
            pts.append(p)
        last, hidden = p, False
    out[name] = [list(map(int, q)) for q in pts]
    print(name, len(pts), 'px;', '; '.join(report) or 'all on the lines')
json.dump(out, open(sys.argv[3], 'w'))
