# A crop of a raster with a labelled pixel grid, for placing anchors: grid.py in.png x0 y0 x1 y1 step out.png [shrink]
import sys
from PIL import Image, ImageDraw, ImageFont
src, x0, y0, x1, y1, step, out = sys.argv[1], *map(int, sys.argv[2:7]), sys.argv[7]
k = int(sys.argv[8]) if len(sys.argv) > 8 else 1
im = Image.open(src).convert('RGB').crop((x0, y0, x1, y1))
if k > 1: im = im.resize((im.width // k, im.height // k), Image.LANCZOS)
g = ImageDraw.Draw(im)
f = ImageFont.load_default(size=13)
for x in range((x0 // step + 1) * step, x1, step):
    X = (x - x0) / k; g.line([(X, 0), (X, im.height)], fill=(255, 150, 150)); g.text((X + 2, 2), str(x), fill=(200, 0, 0), font=f)
for y in range((y0 // step + 1) * step, y1, step):
    Y = (y - y0) / k; g.line([(0, Y), (im.width, Y)], fill=(150, 150, 255)); g.text((2, Y + 2), str(y), fill=(0, 0, 200), font=f)
im.save(out)
