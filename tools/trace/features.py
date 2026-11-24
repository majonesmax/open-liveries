# Windows and doors in a side view: the small drawn shapes inside the fuselage, found as connected pieces of ink.
# Cabin windows are drawn as pairs of brackets, doors and cockpit panes as closed outlines.
# Usage: features.py side.png side.snap.json out.json
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage
ink = np.array(Image.open(sys.argv[1]).convert('L')) < 128
t = json.load(open(sys.argv[2]))
crown = np.array(t['fuselage.crown'], float); belly = np.array(t['fuselage.belly'], float)
cz = lambda x: np.interp(x, *crown[np.argsort(crown[:, 0])].T)
bz = lambda x: np.interp(x, *belly[np.argsort(belly[:, 0])].T)
lab, n = ndimage.label(ink, structure=np.ones((3, 3)))
boxes = ndimage.find_objects(lab)
pieces = []
for i, s in enumerate(boxes):
    y0, y1, x0, x1 = s[0].start, s[0].stop, s[1].start, s[1].stop
    xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
    if x1 - x0 > 400 or y1 - y0 > 400: continue                    # the outline itself, wing, engine
    if not (cz(xm) + 15 < y0 and y1 < bz(xm) - 15): continue          # inside the fuselage, clear of its lines
    pieces.append([int(x0), int(y0), int(x1), int(y1)])
pieces.sort()
# Faces: white regions enclosed by ink, inside the fuselage (cockpit panes, doors; window brackets aren't closed).
white = ~ink
wl, wn = ndimage.label(white)
faces = []
for i, s in enumerate(ndimage.find_objects(wl)):
    y0, y1, x0, x1 = s[0].start, s[0].stop, s[1].start, s[1].stop
    if x1 - x0 > 600 or y1 - y0 > 600 or (x1 - x0) * (y1 - y0) < 200: continue
    xm = (x0 + x1) / 2
    if not (cz(xm) - 5 <= y0 and y1 <= bz(xm) + 5): continue
    m = wl[s] == i + 1
    ys, xs = np.nonzero(m)
    faces.append({'box': [int(x0), int(y0), int(x1), int(y1)], 'area': int(m.sum())})
json.dump({'pieces': pieces, 'faces': faces}, open(sys.argv[3], 'w'))
print(len(pieces), 'pieces;', len(faces), 'faces')
for f in faces: print('face', f)
ws = [p for p in pieces if 20 < p[2] - p[0] < 60 and 30 < p[3] - p[1] < 80]
print('bracket-sized pieces', len(ws), 'rows', sorted(set((p[1] // 10 * 10, p[3] // 10 * 10) for p in ws)))
