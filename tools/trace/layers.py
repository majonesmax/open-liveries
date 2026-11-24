# Rasterise a dimension drawing's aircraft alone, without its dimension lines and text.
#   Boeing (D6-58325-x): the aircraft is the page's filled paths; dimension lines are strokes.   --mode fills
#   Boeing's windows and doors are thin blue strokes on their own:                              --mode strokes
#   Airbus (AC):         everything is thin black strokes; the aircraft is also filled pale yellow.
#                        Keep the strokes inside the yellow area (a little grown).            --mode strokes-in-fill
#   A sheet that is a scanned or exported picture (Boeing's 737 MAX document): the page rendered as it is,
#   dark pixels kept. Its dimension lines and text stay in; the placed points pick the outline.  --mode image
#   A shaded picture (Airbus's A350 sheets: grey shading, outlines from black to pale grey): pixels darker than
#   the local background by --contrast, so the lines stay and the shading goes.                --mode lines
# Usage: layers.py doc.pdf page scale out.png --mode fills|strokes-in-fill|strokes|image [--clip x0,y0,x1,y1 (points)]
# Prints the page's metric dimension texts (Airbus pages have real text) with their positions.
import argparse, json, re
import numpy as np
import pymupdf
from PIL import Image, ImageDraw
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument('pdf'); ap.add_argument('page', type=int); ap.add_argument('scale', type=float); ap.add_argument('out')
ap.add_argument('--mode', choices=['fills', 'strokes-in-fill', 'strokes', 'image', 'lines'], required=True)
ap.add_argument('--clip', help='x0,y0,x1,y1 in points: the view to keep')
ap.add_argument('--fill', default='1.0,1.0,0.8', help='the aircraft fill colour for strokes-in-fill')
ap.add_argument('--xscale', type=float, default=1.0,
                help="stretch the view across by this much: for a sheet whose view isn't drawn to one scale both ways (Embraer's E175 figure: its views are squeezed across, each by its own amount)")
ap.add_argument('--threshold', type=int, default=128,
                help='--mode image: pixels darker than this are ink (a shaded picture, as Airbus\'s A350 sheets, draws some outlines in pale grey)')
ap.add_argument('--rotate', type=float, default=0.0,
                help="turn the view by this many degrees, counter-clockwise as seen, about the raster's centre: for a sheet that draws the aircraft at its ground attitude (Airbus's A330 sheets, about half a degree nose down)")
ap.add_argument('--contrast', type=int, default=40, help='--mode lines: how much darker than the background a line is')
ap.add_argument('--unrotate', action='store_true',
                help="render the page as stored, without its /Rotate, so --clip is in the stored page's points: Boeing's MD-11 sheet is stored upside down and turned for display (--unrotate --rotate 180)")
ap.add_argument('--color', default='0,0,1', help='the stroke colour for --mode strokes (Boeing draws windows and doors in blue)')
args = ap.parse_args()
S = args.scale
p = pymupdf.open(args.pdf)[args.page]
if args.unrotate: p.set_rotation(0)
clip = pymupdf.Rect(*map(float, args.clip.split(','))) if args.clip else p.rect
FX = args.xscale
W, H = int(clip.width * S * FX), int(clip.height * S)
X = lambda pt: ((pt.x - clip.x0) * S * FX, (pt.y - clip.y0) * S)


def bez(a, b, c, d, n=16):
    return [X(pymupdf.Point((1-t)**3*a.x + 3*(1-t)**2*t*b.x + 3*(1-t)*t*t*c.x + t**3*d.x,
                            (1-t)**3*a.y + 3*(1-t)**2*t*b.y + 3*(1-t)*t*t*c.y + t**3*d.y)) for t in np.linspace(0, 1, n)]


def outline(path):
    """The path's points as polylines (one per subpath)."""
    lines, cur, last = [], [], None
    for it in path['items']:
        k = it[0]
        if k == 'l': seg = [X(it[1]), X(it[2])]
        elif k == 'c': seg = bez(*it[1:5])
        elif k == 're': r = it[1]; seg = [X(r.tl), X(r.tr), X(r.br), X(r.bl), X(r.tl)]
        elif k == 'qu': q = it[1]; seg = [X(q.ul), X(q.ur), X(q.lr), X(q.ll), X(q.ul)]
        else: continue
        if cur and last is not None and abs(seg[0][0] - last[0]) < 0.01 and abs(seg[0][1] - last[1]) < 0.01:
            cur += seg[1:]
        else:
            if cur: lines.append(cur)
            cur = list(seg)
        last = cur[-1]
    if cur: lines.append(cur)
    return lines


# A horizontal or vertical line's rect is empty, and an empty rect intersects nothing: grow it a little.
drawings = [d for d in p.get_drawings() if (pymupdf.Rect(d['rect']) + (-0.01, -0.01, 0.01, 0.01)).intersects(clip)]
im = Image.new('L', (W, H), 255); g = ImageDraw.Draw(im)
if args.mode == 'lines':
    pix = p.get_pixmap(matrix=pymupdf.Matrix(S * FX, S), clip=clip, alpha=False, colorspace=pymupdf.csGRAY)
    a = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width).astype(float)
    bg = ndimage.maximum_filter(ndimage.median_filter(a, size=15), size=3)   # the shading, without thin lines
    im = Image.fromarray(np.where((bg - a > args.contrast) | (a < 90), 0, 255).astype(np.uint8))
elif args.mode == 'image':
    pix = p.get_pixmap(matrix=pymupdf.Matrix(S * FX, S), clip=clip, alpha=False, colorspace=pymupdf.csGRAY)
    a = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width)
    im = Image.fromarray(np.where(a < args.threshold, 0, 255).astype(np.uint8))
elif args.mode == 'strokes':
    want = tuple(float(v) for v in args.color.split(','))
    for d in drawings:
        c = d.get('color')
        if d['type'] in ('s', 'fs') and c is not None and all(abs(a - b) < 0.02 for a, b in zip(c, want)):
            w = max(2, round((d.get('width') or 0.1) * S))
            for poly in outline(d): g.line(poly, fill=0, width=w, joint='curve')
elif args.mode == 'fills':
    for d in drawings:
        if d['type'] != 'f': continue
        if d.get('fill') == (1.0, 1.0, 1.0): continue   # a white panel behind the drawing (the 767-300's sheet)
        for poly in outline(d):
            if len(poly) > 2: g.polygon(poly, fill=0)
else:
    want = tuple(float(v) for v in args.fill.split(','))
    near = lambda c: c is not None and all(abs(a - b) < 0.02 for a, b in zip(c, want))
    mask = Image.new('L', (W, H), 0); gm = ImageDraw.Draw(mask)
    for d in drawings:
        if d['type'] in ('f', 'fs') and near(d.get('fill')):
            for poly in outline(d):
                if len(poly) > 2: gm.polygon(poly, fill=255)
    m = ndimage.binary_dilation(np.array(mask) > 0, iterations=int(1.5 * S))   # the outline sits on the fill's edge
    for d in drawings:
        if d['type'] in ('s', 'fs') and d.get('color') == (0.0, 0.0, 0.0):
            w = max(1, round((d.get('width') or 0.45) * S))
            for poly in outline(d): g.line(poly, fill=0, width=w, joint='curve')
    a = np.array(im); a[~m] = 255; im = Image.fromarray(a)
if args.rotate:
    im = im.convert('L').rotate(args.rotate, resample=Image.BICUBIC, fillcolor=255)
    im = Image.fromarray(np.where(np.array(im) < 128, 0, 255).astype(np.uint8))
im.save(args.out)
dims = []
for blk in p.get_text('dict')['blocks']:
    for ln in blk.get('lines', []):
        t = ''.join(s['text'] for s in ln['spans'])
        mm = re.fullmatch(r'\s*(\d+\.\d+)\s*m\s*', t)
        if mm and pymupdf.Rect(ln['bbox']).intersects(clip):
            dims.append({'m': float(mm.group(1)), 'at': [round(v, 1) for v in ln['bbox']]})
print(json.dumps({'size': [W, H], 'dims': dims}))
