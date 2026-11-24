"""Measure a scheme's paint edges off a photo, on the type's measured shape (shapes/<type>.json, docs/SHAPES.md),
instead of placing points by eye: line the photo up with the shape, then follow each colour boundary between a few
points placed on it. What comes out is an area's points in its part's space, dense enough to draw as a curve
(`"smooth": true`, docs/COORDINATES.md), and a picture of the scheme's areas over the photo to check them.

  align   PHOTO SHAPE OUT.json nose=X,Y tail=X,Y fin-tip=X,Y [fin-root=X,Y crown@M=X,Y belly@M=X,Y window@M=X,Y]
          [door-fwd=X,Y door-aft=X,Y] [camera=below|above]
          Fits the photo to the shape from three or more landmarks, in the photo's pixels (the left side, nose to the
          left; flip a right-side photo first). Writes the fit and OUT.png: the shape's outline over the photo.
          Landmarks: nose (the nose tip), tail (the tail cone's end, halfway up), fin-tip (the fin's top trailing
          corner), fin-root (where the fin's leading edge meets the crown), crown@M and belly@M (the top and bottom
          of the fuselage M meters back from the nose, wherever they're in view: give one of each, so the fit has
          the fuselage's height); window@M, the middle of a cabin window about M meters back (two of them, fore and
          aft: the window line pins the camera's angle; any shape with a window height, cabin.windows.z, takes them:
          on shapes/B738.json the windows' spacing is estimated but their height is measured). camera: whether the photo
          looks up at the aircraft (from the ground, the default) or down on it (from a terminal or garage roof):
          the outlines show how far off level the camera is, not which way, and the wrong way shifts every paint
          edge up or down the fuselage. Look at the photo: is the top of the wing or the fuselage in view?
          door-fwd, door-aft: the middle of the forward and aft passenger doors on this side. Give them whenever
          they're in view: they're on the fuselage's side at heights the shape knows, so they fix the camera's
          angle (which way and how far) far better than outlines, which hardly change near level.
  trace   PHOTO FIT.json PART X,Y X,Y! X,Y ...
          Follows the strongest colour boundary between the points (photo pixels; `!` marks a real corner) and
          prints the line as [x, y] points in PART's space (fuselage or fin), thinned to 3 cm, corners as [x, y, 1].
          A point at the part's edge (the crown, the belly, the nose) snaps there.
  probe   FIT.json X,Y [X,Y ...] [--part fuselage|fin]
          Where photo pixels are on the aircraft: each as its part (the fin above the fuselage's outline, else the
          fuselage) and its (x, y) in that part's space, with meters back from the nose and up from the centerline.
          For reading off a title's ends, a logo's middle or a band's edge without tracing it.
  overlay PHOTO FIT.json SCHEME.json OUT.png [--side right]
          Draws the scheme's fuselage and fin areas, as the renderer would place them, over the photo: the left
          side's areas, or with --side right the right side's, on a right-side photo flipped nose-left (as align).
          A scheme with paint for the fit's type (`types`) is drawn with it, as the renderer does (and in score).
  fields  PHOTO FIT.json SCHEME.json --colors a,b,c [--part fin] [--min 0.5] [--hide X0,Y0,X1,Y1] [--png OUT.png]
          The part's major colour fields straight off the photo, for art liveries only (on stripes and cheatlines
          it copies the photo's noise and loses thin lines: use trace there): every sample takes the
          nearest of the named palette colours, fields under --min meters merge into their surroundings, and
          each field is printed as a smooth area (largest first), with the commonest colour as the base. Point at
          a spot of each colour in this photo (--sample NAME=X,Y, repeatable) so its light can't confuse them. What the
          photo doesn't show (behind --hide boxes, or the crown from below) is filled from its neighbours. Each row
          round the part is measured against its own white, since light falls off round the fuselage.
  score   PHOTO FIT.json SCHEME.json --colors a,b,c [--part fin] [--hide ...] [--png OUT.png]
          How much of the part the photo shows agrees with the scheme's colours there: a number to compare a
          scheme's versions by, and a map of where they differ (green agrees, red doesn't, grey unseen). Samples
          that match none of the colours well (windows, titles, shadow) don't count. Judge on a photo the version
          wasn't traced from, and look at the render too: a version that copies the photo's noise can score well.

The fit is a perspective one (four or more landmarks), so a camera a little below or ahead is taken out, but the
aircraft is treated as flat: pick the most side-on photo and check the overlay; edges near the belly and crown,
which curve away from the camera, are the least certain. Needs the `photos` dependency group
(numpy, pillow). Usage: .venv/bin/python -I tools/photo_trace.py align|trace|probe|overlay|fields|score ..."""

import argparse
import heapq
import json
import math
import sys
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import itertools

from common import area_polygon, fuselage_polygon, load_json, load_livery, paint_for, thin, type_key
from shapes import Livery

XY = tuple[float, float]
Line = list[list[float]]
WORK = 2000  # the working image's width in pixels: the boundary search runs on the photo scaled to this


# The measured shape, in meters: x back from the nose, z up from the fuselage centerline.


def at(line: Line, a: float) -> float:
    """b at a along a line of [a, b] (sorted here), held level beyond its ends."""
    pts = sorted(line, key=lambda p: p[0])
    if a <= pts[0][0]:
        return pts[0][1]
    for p, q in itertools.pairwise(pts):
        if a <= q[0]:
            return q[1] if q[0] == p[0] else p[1] + (q[1] - p[1]) * (a - p[0]) / (q[0] - p[0])
    return pts[-1][1]


class Shape:
    def __init__(self, data: dict[str, Any]) -> None:
        f = data["fuselage"]
        self.length: float = f["length"]
        self.crown: Line = f["crown"]
        self.belly: Line = f["belly"]
        w = data.get("cabin", {}).get("windows", {})
        self.window_z: float | None = (w["z"][0] + w["z"][1]) / 2 if "z" in w else None
        # Passenger doors' centres: measured from the drawings, on the fuselage's side, so they pin the camera.
        doors = [d for d in data.get("cabin", {}).get("doors", []) if d["kind"] == "door"]
        doors.sort(key=lambda d: d["x"][0])
        self.doors: dict[str, XY] = {}
        if doors:
            for name, d in (("door-fwd", doors[0]), ("door-aft", doors[-1])):
                self.doors[name] = ((d["x"][0] + d["x"][1]) / 2, (d["z"][0] + d["z"][1]) / 2)
        fin = data["fin"]
        self.fin_leading: Line = [[z, x] for x, z in fin["leading"]]  # x at each height
        self.fin_trailing: Line = [[z, x] for x, z in fin["trailing"]]
        self.fin_root: float = fin["leading"][0][1]
        self.fin_tip: float = max(z for _, z in fin["leading"] + fin["trailing"])
        self.landmarks: dict[str, XY] = {
            "nose": (0.0, (at(self.crown, 0) + at(self.belly, 0)) / 2),
            "tail": (self.length, (at(self.crown, self.length) + at(self.belly, self.length)) / 2),
            "fin-tip": (fin["trailing"][-1][0], fin["trailing"][-1][1]),
            "fin-root": (fin["leading"][0][0], fin["leading"][0][1]),
        }

    def fuselage_to_m(self, x: float, y: float) -> XY:
        m = min(max(x, 0.0), 1.0) * self.length
        c, b = at(self.crown, m), at(self.belly, m)
        return m, (c + b) / 2 + (c - b) / 2 * math.sin(min(max(y, -1.0), 1.0) * math.pi / 2)

    def m_to_fuselage(self, m: float, z: float) -> XY:
        c, b = at(self.crown, m), at(self.belly, m)
        r = (c - b) / 2 or 1.0
        return m / self.length, math.asin(min(max((z - (c + b) / 2) / r, -1.0), 1.0)) * 2 / math.pi

    def fin_to_m(self, x: float, y: float) -> XY:
        z = self.fin_root + y * (self.fin_tip - self.fin_root)
        lead, trail = at(self.fin_leading, z), at(self.fin_trailing, z)
        return lead + x * (trail - lead), z

    def m_to_fin(self, m: float, z: float) -> XY:
        lead, trail = at(self.fin_leading, z), at(self.fin_trailing, z)
        return (m - lead) / ((trail - lead) or 1.0), (z - self.fin_root) / (self.fin_tip - self.fin_root)


# The fit. A photo from the ground looks up at the aircraft: seen from φ below its side, a vertical surface (the fin)
# is foreshortened by cos φ, and the round fuselage shows more of its underside: a point θ up round it from the
# side's middle (fuselage y = θ / 90°) is drawn at zc·cos φ + r·sin(θ + φ), its silhouette at zc·cos φ ± r. In
# that frame (x along, v up) the photo is an affine map. φ is found by trying angles; the map by least squares.


def heights(shape: Shape, m: float) -> tuple[float, float]:
    """The cross-section's center and radius at m meters back."""
    c, b = at(shape.crown, m), at(shape.belly, m)
    return (c + b) / 2, (c - b) / 2


def view_v(shape: Shape, phi: float, kind: str, m: float, z: float) -> float:
    """Height in the photo's frame (before the affine map) of a landmark or point."""
    zc, r = heights(shape, m)
    if kind == "crown":
        return zc * math.cos(phi) + r
    if kind == "belly":
        return zc * math.cos(phi) - r
    if kind == "surface":
        # On the near side's surface at the window line: θ up round the fuselage from its middle.
        theta = math.asin(min(max((z - zc) / r, -1.0), 1.0))
        return zc * math.cos(phi) + r * math.sin(theta + phi)
    return z * math.cos(phi)  # on the centerline plane: nose, tail, the fin


def affine(rows: list[tuple[float, float]], px: list[XY]) -> tuple[list[float], float]:
    """Least-squares affine map from (x, v) to pixels, and its rms error."""
    a = np.array([[x, v, 1.0] for x, v in rows])
    r1, res1 = np.linalg.lstsq(a, np.array([p[0] for p in px]), rcond=None)[:2]
    r2, res2 = np.linalg.lstsq(a, np.array([p[1] for p in px]), rcond=None)[:2]
    err = math.sqrt((float(np.sum(res1)) + float(np.sum(res2))) / max(len(px), 1))
    return [*(float(v) for v in r1), *(float(v) for v in r2)], err


def fit(shape: Shape, marks: list[tuple[str, XY, XY]], camera: str) -> dict[str, Any]:
    """{phi: radians, affine: [6]} for landmarks (kind, (m, z), pixel). Outlines and the fin say how far the camera
    is off the side's level but not which way (cos φ is the same either side): `camera` says, above or below."""
    best: tuple[float, float, list[float]] | None = None
    for deg in range(0, 81) if camera == "below" else range(0, -81, -1):
        phi = math.radians(deg)
        rows = [(m, view_v(shape, phi, kind, m, z)) for kind, (m, z), _ in marks]
        t, err = affine(rows, [p for _, _, p in marks])
        if best is None or err < best[0]:
            best = (err, phi, t)
    assert best
    return {"phi": best[1], "affine": best[2]}


def to_px(f: dict[str, Any], x: float, v: float) -> XY:
    t = f["affine"]
    return t[0] * x + t[1] * v + t[2], t[3] * x + t[4] * v + t[5]


def to_xv(f: dict[str, Any], p: XY) -> XY:
    a, b, c, d, e, g = f["affine"]
    det = a * e - b * d
    x, y = p[0] - c, p[1] - g
    return (e * x - b * y) / det, (a * y - d * x) / det


def project(shape: Shape, f: dict[str, Any], part: str, x: float, y: float) -> XY:
    """A point in a part's space to the photo's pixels."""
    phi = f["phi"]
    if part == "fuselage":
        m = min(max(x, 0.0), 1.0) * shape.length
        zc, r = heights(shape, m)
        return to_px(f, m, zc * math.cos(phi) + r * math.sin(min(max(y, -1.0), 1.0) * math.pi / 2 + phi))
    m, z = shape.fin_to_m(x, y)
    return to_px(f, m, z * math.cos(phi))


def unproject(shape: Shape, f: dict[str, Any], part: str, p: XY) -> XY:
    """The photo's pixels to a point in a part's space."""
    phi = f["phi"]
    m, v = to_xv(f, p)
    if part == "fuselage":
        zc, r = heights(shape, m)
        s = min(max((v - zc * math.cos(phi)) / (r or 1.0), -1.0), 1.0)
        # Past the silhouette asin(s) - φ runs beyond ±90°: clamp to the crown's or the belly's centerline.
        return m / shape.length, min(max((math.asin(s) - phi) * 2 / math.pi, -1.0), 1.0)
    return shape.m_to_fin(m, v / math.cos(phi))


def outlines(shape: Shape, f: dict[str, Any]) -> list[list[XY]]:
    """The fuselage's silhouette and the fin's outline, in the photo's pixels."""
    phi = f["phi"]
    top, bottom = [], []
    for i in range(201):
        m = shape.length * i / 200
        zc, r = heights(shape, m)
        top.append(to_px(f, m, zc * math.cos(phi) + r))
        bottom.append(to_px(f, m, zc * math.cos(phi) - r))
    fin = [project(shape, f, "fin", 0, i / 50) for i in range(51)]
    fin += [project(shape, f, "fin", 1, i / 50) for i in range(50, -1, -1)]
    return [top + bottom[::-1], fin]


def align(args: list[str]) -> None:
    photo, shape_path, out = Path(args[0]), Path(args[1]), Path(args[2])
    shape = Shape(load_json(shape_path))
    marks = dict(a.split("=", 1) for a in args[3:])
    camera = marks.pop("camera", "below")
    if camera not in ("above", "below"):
        raise SystemExit("camera=above or camera=below")

    def landmark(name: str) -> XY:
        """A named landmark; crown@M / belly@M, the top or bottom of the fuselage M meters from the nose; window@M,
        the middle of a cabin window there."""
        if "@" in name:
            edge, meters = name.split("@")
            if edge == "window":
                if shape.window_z is None:
                    raise SystemExit(f"{shape_path} has no cabin window height (cabin.windows.z): no window@ here")
                return float(meters), shape.window_z
            return float(meters), at(shape.crown if edge == "crown" else shape.belly, float(meters))
        if name in shape.doors:
            return shape.doors[name]
        return shape.landmarks[name]

    marks3: list[tuple[str, XY, XY]] = []
    for k, v in marks.items():
        kind = k.split("@")[0] if "@" in k else "surface" if k.startswith("door") else "plane"
        kind = "surface" if kind == "window" else kind
        px = (float(v.split(",")[0]), float(v.split(",")[1]))
        marks3.append((kind, landmark(k), px))
    if len(marks3) < 4:
        raise SystemExit("align needs four or more landmarks (with a crown@ and a belly@ among them)")
    f = fit(shape, marks3, camera)
    for kind, (m, z), p in marks3:
        q = to_px(f, m, view_v(shape, f["phi"], kind, m, z))
        print(
            f"{kind} {m:.1f} m: placed {p[0]:.0f},{p[1]:.0f}"
            f"  fitted {q[0]:.0f},{q[1]:.0f}  off {math.dist(p, q):.0f} px"
        )
    deg = math.degrees(f["phi"])
    print(f"camera {abs(deg):.0f}° {'below' if deg >= 0 else 'above'} the aircraft's side")
    out.write_text(json.dumps({"photo": str(photo), "shape": str(shape_path), **f, "landmarks": marks}) + "\n")
    im = Image.open(photo).convert("RGB")
    g = ImageDraw.Draw(im)
    w = max(2, im.width // 600)
    for line in outlines(shape, f):
        g.line(line, fill=(255, 40, 40), width=w)
    im.save(out.with_suffix(".png"))
    print(f"fit → {out}; outline over the photo → {out.with_suffix('.png')}")


# Tracing: the cheapest path between two points through the photo, cheap along strong colour edges.


def edge_cost(im: Image.Image) -> npt.NDArray[np.float64]:
    """Per pixel: cheap on a strong colour boundary, dear on flat colour."""
    a = np.asarray(im.convert("RGB"), dtype=np.float64)
    gx = np.zeros(a.shape[:2])
    gy = np.zeros(a.shape[:2])
    for ch in range(3):
        c = a[:, :, ch]
        gx[:, 1:-1] = np.maximum(gx[:, 1:-1], np.abs(c[:, 2:] - c[:, :-2]))
        gy[1:-1, :] = np.maximum(gy[1:-1, :], np.abs(c[2:, :] - c[:-2, :]))
    g = np.hypot(gx, gy)
    g = g / (np.percentile(g, 99.5) or 1.0)
    return np.asarray(0.02 + (1.0 - np.clip(g, 0.0, 1.0)) ** 2, dtype=np.float64)


def route(cost: npt.NDArray[np.float64], a: tuple[int, int], b: tuple[int, int], pad: int = 40) -> list[XY]:
    """Cheapest 8-connected path from a to b (x, y), searched in their box grown by pad."""
    h, w = cost.shape
    x0, x1 = max(0, min(a[0], b[0]) - pad), min(w, max(a[0], b[0]) + pad + 1)
    y0, y1 = max(0, min(a[1], b[1]) - pad), min(h, max(a[1], b[1]) + pad + 1)
    c = cost[y0:y1, x0:x1]
    hh, ww = c.shape
    dist = np.full((hh, ww), np.inf)
    prev = np.full((hh, ww), -1, dtype=np.int64)
    sx, sy, tx, ty = a[0] - x0, a[1] - y0, b[0] - x0, b[1] - y0
    dist[sy, sx] = 0.0
    queue: list[tuple[float, int, int]] = [(0.0, sy, sx)]
    steps = [(-1, -1, 1.414), (-1, 0, 1.0), (-1, 1, 1.414), (0, -1, 1.0), (0, 1, 1.0), (1, -1, 1.414), (1, 0, 1.0)]
    steps.append((1, 1, 1.414))
    while queue:
        d, y, x = heapq.heappop(queue)
        if (y, x) == (ty, tx):
            break
        if d > dist[y, x]:
            continue
        for dy, dx, s in steps:
            ny, nx = y + dy, x + dx
            if 0 <= ny < hh and 0 <= nx < ww:
                nd = d + s * float(c[ny, nx])
                if nd < dist[ny, nx]:
                    dist[ny, nx] = nd
                    prev[ny, nx] = y * ww + x
                    heapq.heappush(queue, (nd, ny, nx))
    path: list[XY] = []
    k = ty * ww + tx
    while k >= 0:
        y, x = divmod(int(k), ww)
        path.append((float(x + x0), float(y + y0)))
        if (y, x) == (sy, sx):
            break
        k = int(prev[y, x])
    return path[::-1]


def trace(args: list[str]) -> None:
    photo, part = Path(args[0]), args[2]
    fitted = json.loads(Path(args[1]).read_text())
    shape = Shape(load_json(Path(fitted["shape"])))
    im = Image.open(photo)
    k = WORK / im.width
    small = im.resize((WORK, round(im.height * k)))
    cost = edge_cost(small)
    anchors: list[tuple[XY, bool]] = []
    for a in args[3:]:
        corner = a.endswith("!")
        x, y = (float(v) for v in a.rstrip("!").split(","))
        anchors.append(((x, y), corner))
    path_px: list[XY] = []
    corners: list[int] = []
    for i, ((p, corner), (q, _)) in enumerate(itertools.pairwise(anchors)):
        seg = route(cost, (round(p[0] * k), round(p[1] * k)), (round(q[0] * k), round(q[1] * k)))
        seg = [(x / k, y / k) for x, y in seg]
        if corner or i == 0:
            corners.append(len(path_px))
        path_px += seg if not path_px else seg[1:]
    if anchors[-1][1]:
        corners.append(len(path_px) - 1)
    to_meters = shape.fuselage_to_m if part == "fuselage" else shape.fin_to_m
    pts = [unproject(shape, fitted, part, p) for p in path_px]
    # Thin in meters, each stretch between corners on its own so the corners stay.
    bounds = sorted({0, *corners, len(pts) - 1})
    out: list[list[float]] = []
    for s, e in itertools.pairwise(bounds):
        stretch = [to_meters(*p) for p in pts[s : e + 1]]
        kept = thin(stretch, 0.03)
        idx = [s + stretch.index(m) for m in kept]
        for j in idx if not out else idx[1:]:
            x, y = pts[j]
            lo, hi = (-1.0, 1.0) if part == "fuselage" else (0.0, 1.0)
            x, y = min(max(x, 0.0), 1.0), min(max(y, lo), hi)
            if abs(y - hi) < 0.03:
                y = hi
            if abs(y - lo) < 0.03:
                y = lo
            point = [round(x, 4), round(y, 4)]
            out.append([*point, 1] if j in corners and lo < y < hi and 0 < x < 1 else point)
    print(json.dumps(out))


def part_at(shape: Shape, f: dict[str, Any], p: XY) -> tuple[str, XY, bool]:
    """Which part a photo pixel is on, its point in that part's space, and whether it's on the part at all: on the
    fuselage inside its outline, on the fin above it (between the fin's edges, root to tip). A point placed on an
    edge is taken as on it within the fit's few pixels."""
    slack = 0.03
    m, v = to_xv(f, p)
    zc, r = heights(shape, min(max(m, 0.0), shape.length))
    top, bottom = zc * math.cos(f["phi"]) + r * (1 + slack), zc * math.cos(f["phi"]) - r * (1 + slack)
    on_fuselage = -slack <= m / shape.length <= 1 + slack and bottom <= v <= top
    fx, fy = unproject(shape, f, "fin", p)
    fz = v / math.cos(f["phi"])
    lead, trail = at(shape.fin_leading, fz), at(shape.fin_trailing, fz)
    near = 0.1  # meters: the fin narrows to a few centimeters at its tip, too little for a fraction of it
    if not on_fuselage and lead - near <= m <= trail + near and shape.fin_root - near <= fz <= shape.fin_tip + near:
        return "fin", (min(max(fx, 0.0), 1.0), min(max(fy, 0.0), 1.0)), True
    x, y = unproject(shape, f, "fuselage", p)
    return "fuselage", (min(max(x, 0.0), 1.0), y), on_fuselage


def probe(args: list[str]) -> None:
    ap = argparse.ArgumentParser(prog="photo_trace.py probe")
    ap.add_argument("fit", type=Path)
    ap.add_argument("points", nargs="+", help="X,Y: photo pixels")
    ap.add_argument("--part", choices=["fuselage", "fin"], help="read every point on this part")
    a = ap.parse_args(args)
    fitted = json.loads(a.fit.read_text())
    shape = Shape(load_json(Path(fitted["shape"])))
    for item in a.points:
        px, py = (float(v) for v in item.split(","))
        part, (x, y), on = part_at(shape, fitted, (px, py))
        if a.part:
            part, on = a.part, True
            x, y = unproject(shape, fitted, part, (px, py))
        m, z = (shape.fuselage_to_m if part == "fuselage" else shape.fin_to_m)(x, y)
        note = "" if on else "  (off the aircraft: nearest the fuselage's edge)"
        print(f"{item:>11}  {part:8}  [{x:.4f}, {y:.4f}]  {m:5.2f} m back, {z:+.2f} m up{note}")


def scheme_on(path: Path, fitted: dict[str, Any]) -> Livery:
    """A scheme as painted on the fit's shape: its paint for that type (`types`) over its own, as the renderer."""
    livery = load_livery(path)
    return paint_for(livery, type_key(livery, load_json(Path(fitted["shape"]))))


def overlay(args: list[str]) -> None:
    ap = argparse.ArgumentParser(prog="photo_trace.py overlay")
    ap.add_argument("photo", type=Path)
    ap.add_argument("fit", type=Path)
    ap.add_argument("scheme", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--side", choices=["left", "right"], default="left", help="right: a right-side photo, flipped")
    a = ap.parse_args(args)
    fitted = json.loads(a.fit.read_text())
    shape = Shape(load_json(Path(fitted["shape"])))
    livery = scheme_on(a.scheme, fitted)
    im = Image.open(a.photo).convert("RGB")
    g = ImageDraw.Draw(im)
    w = max(2, im.width // 700)
    for line in outlines(shape, fitted):
        g.line(line, fill=(255, 255, 255), width=w)
    for key, lo, hi in (("fuselage", -1.0, 1.0), ("fin", 0.0, 1.0)):
        part = livery.get(key)
        if not isinstance(part, dict):
            continue
        # Seen flipped, the right side is the left's frame, except a fin whose right face shows the left face's
        # picture unreversed (`mirrored: false`): there (x, y) is at (1 − x, y), as the renderer draws it.
        flip = key == "fin" and a.side == "right" and part.get("mirrored") is False
        for area in part.get("areas") or []:
            if area.get("side", "both") not in ("both", a.side):
                continue
            outline = fuselage_polygon(area, lo, hi) if key == "fuselage" else area_polygon(area, lo, hi)
            poly = [(1 - x, y) if flip else (x, y) for x, y in outline]
            dense: list[XY] = []
            for p, q in zip(poly, [*poly[1:], poly[0]], strict=True):
                dense += [(p[0] + (q[0] - p[0]) * s / 8, p[1] + (q[1] - p[1]) * s / 8) for s in range(8)]
            px = [project(shape, fitted, key, x, y) for x, y in dense]
            g.line([*px, px[0]], fill=(255, 40, 200), width=w)
    im.save(a.out)
    print(f"→ {a.out}")


# Fields: the major colour fields of a part, straight off the photo. Each sample of the part's space (as the camera
# saw it) takes the nearest of the scheme's colours (the photo's own shade of each, learnt from the samples);
# anything smaller than --min meters merges into what surrounds it; what the photo doesn't show (the wing in
# front, the crown seen from below) is filled from its neighbours and reported. Each field comes out as a smooth
# area, largest first, so smaller fields inside it paint over it.


def sample(im: Image.Image, pts: list[XY]) -> npt.NDArray[np.float64]:
    """The photo's colour at each pixel position (bilinear), as RGB rows."""
    a = np.asarray(im.convert("RGB"), dtype=np.float64)
    h, w = a.shape[:2]
    xy = np.array(pts)
    x = np.clip(xy[:, 0], 0, w - 1.001)
    y = np.clip(xy[:, 1], 0, h - 1.001)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = (x - x0)[:, None], (y - y0)[:, None]
    top = a[y0, x0] * (1 - fx) + a[y0, x0 + 1] * fx
    bottom = a[y0 + 1, x0] * (1 - fx) + a[y0 + 1, x0 + 1] * fx
    return np.asarray(top * (1 - fy) + bottom * fy, dtype=np.float64)


def box_mean(a: npt.NDArray[np.float64], ry: int, rx: int) -> npt.NDArray[np.float64]:
    """Each cell's mean over a (2ry+1)×(2rx+1) box (edges padded by repeating)."""
    p = np.pad(a, ((ry + 1, ry), (rx + 1, rx)), mode="edge")
    c = p.cumsum(0).cumsum(1)
    out = c[2 * ry + 1 :, 2 * rx + 1 :] - c[: -2 * ry - 1, 2 * rx + 1 :] - c[2 * ry + 1 :, : -2 * rx - 1]
    out = out + c[: -2 * ry - 1, : -2 * rx - 1]
    return np.asarray(out / ((2 * ry + 1) * (2 * rx + 1)), dtype=np.float64)


def outer_loops(mask: npt.NDArray[np.bool_]) -> list[list[tuple[int, int]]]:
    """The outer boundaries of a mask's regions, as loops of grid corners (col, row), holes left out."""
    h, w = mask.shape
    m = np.pad(mask, 1)
    edges: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for r in range(1, h + 1):
        for c in range(1, w + 1):
            if not m[r, c]:
                continue
            x, y = c - 1, r - 1
            # Directed edges round the cell, the cell on their right (rows run down): clockwise on screen.
            if not m[r - 1, c]:
                edges.setdefault((x, y), []).append((x + 1, y))
            if not m[r, c + 1]:
                edges.setdefault((x + 1, y), []).append((x + 1, y + 1))
            if not m[r + 1, c]:
                edges.setdefault((x + 1, y + 1), []).append((x, y + 1))
            if not m[r, c - 1]:
                edges.setdefault((x, y + 1), []).append((x, y))
    loops = []
    while edges:
        start = next(iter(edges))
        loop = [start]
        here = start
        while True:
            nexts = edges.get(here)
            if not nexts:
                break
            there = nexts.pop()
            if not nexts:
                del edges[here]
            if there == start:
                break
            loop.append(there)
            here = there
        area = sum(ax * by - bx * ay for (ax, ay), (bx, by) in itertools.pairwise([*loop, loop[0]])) / 2
        if area > 0 and len(loop) > 3:  # clockwise on screen (rows down) is an outer boundary
            loops.append(loop)
    return loops


def part_grid(shape: Shape, part: str, x0: float = 0.0, x1: float = 1.0) -> tuple[Any, Any, float, float]:
    """The sampling grid over a part (about 5 cm apart): its x and y values (rows top down) and meters per unit."""
    lo, hi = (-1.0, 1.0) if part == "fuselage" else (0.0, 1.0)
    sx = shape.length if part == "fuselage" else 5.0
    sy = (at(shape.crown, shape.length / 2) - at(shape.belly, shape.length / 2)) / 2 if part == "fuselage" else 7.0
    xs = np.linspace(x0, x1, max(50, round((x1 - x0) * sx / 0.05)))
    ys = np.linspace(hi, lo, max(20, round((hi - lo) * sy / 0.05)))
    return xs, ys, sx, sy


def read_part(
    photo: Path, fitted: dict[str, Any], shape: Shape, part: str, hide: list[str], x0: float = 0.0, x1: float = 1.0
) -> tuple[Any, Any, npt.NDArray[np.float64], npt.NDArray[np.bool_]]:
    """The photo read over the part's grid: xs, ys, colours (rows × cols × RGB), and which samples it shows."""
    xs, ys, _, _ = part_grid(shape, part, x0, x1)
    rows, cols = len(ys), len(xs)
    px = [project(shape, fitted, part, float(x), float(y)) for y in ys for x in xs]
    rgb = sample(Image.open(photo), px).reshape(rows, cols, 3)
    seen = np.ones((rows, cols), dtype=bool)
    if part == "fuselage":
        # Up to the silhouette (the crown can't be seen from below), less a margin: right at the edge the fit's
        # few pixels of error let the sky in.
        top = (math.pi / 2 - fitted["phi"]) * 2 / math.pi - 0.12
        bottom = (-math.pi / 2 - fitted["phi"]) * 2 / math.pi + 0.12  # from above, the belly can't be seen
        seen &= ((ys <= top) & (ys >= bottom))[:, None]
    pxa = np.array(px).reshape(rows, cols, 2)
    for box in hide:
        bx0, by0, bx1, by1 = (float(v) for v in box.split(","))
        inside = (pxa[:, :, 0] >= bx0) & (pxa[:, :, 0] <= bx1) & (pxa[:, :, 1] >= by0) & (pxa[:, :, 1] <= by1)
        seen &= ~inside
    return xs, ys, rgb, seen


def classify(
    rgb: npt.NDArray[np.float64],
    seen: npt.NDArray[np.bool_],
    ref: npt.NDArray[np.float64],
    shade: bool,
    fixed: npt.NDArray[np.float64] | None = None,
) -> tuple[npt.NDArray[np.intp], npt.NDArray[np.float64]]:
    labels, centers, _ = classify_sure(rgb, seen, ref, shade, fixed)
    return labels, centers


def classify_sure(
    rgb: npt.NDArray[np.float64],
    seen: npt.NDArray[np.bool_],
    ref: npt.NDArray[np.float64],
    shade: bool,
    fixed: npt.NDArray[np.float64] | None = None,
) -> tuple[npt.NDArray[np.intp], npt.NDArray[np.float64], npt.NDArray[np.bool_]]:
    """As classify, and which samples are clearly one of the colours: not a window, a title's letters, a shadow
    or a reflection, which match none of them well (farther from the nearest colour than a third of the way to
    the next nearest pair's midpoint)."""
    """Each sample's nearest colour, and the photo's shade of each (k-means from the palette). With `shade`, each
    row is first divided by its own white: light falls off round the fuselage (rows), not along it."""
    a = rgb.copy()
    if shade:
        lum = a.mean(axis=2)
        white = np.zeros(len(a))
        for r in range(len(a)):
            v = lum[r][seen[r]]
            white[r] = np.percentile(v, 97) if v.size > 20 else np.nan
        ok = ~np.isnan(white)
        if ok.any():
            idx = np.arange(len(a))
            white = np.interp(idx, idx[ok], white[ok])
            # Smooth over neighbouring rows, so one row without white doesn't throw its scale off.
            k = 7
            white = np.convolve(np.pad(white, k, mode="edge"), np.ones(2 * k + 1) / (2 * k + 1), "valid")
            a = a / np.maximum(white, 1.0)[:, None, None] * 242.0
    if fixed is not None:
        # The photo's own colours, pointed at: no guessing which cluster is which in this light.
        d = np.sqrt(((rgb[:, :, None, :] - fixed[None, None, :, :]) ** 2).sum(-1))
        return np.argmin(d, axis=2), fixed, sure_of(d, fixed)
    pts = a[seen]
    centers = ref.copy()
    for _ in range(10):
        label = np.argmin(((pts[:, None, :] - centers[None, :, :]) ** 2).sum(-1), axis=1)
        for k in range(len(centers)):
            if np.any(label == k):
                centers[k] = pts[label == k].mean(0)
    d = np.sqrt(((a[:, :, None, :] - centers[None, None, :, :]) ** 2).sum(-1))
    return np.argmin(d, axis=2), centers, sure_of(d, centers)


def sure_of(d: npt.NDArray[np.float64], centers: npt.NDArray[np.float64]) -> npt.NDArray[np.bool_]:
    """Samples whose nearest colour is close: within a third of the smallest gap between two colours."""
    gaps = [float(np.linalg.norm(p - q)) for p, q in itertools.combinations(centers, 2)]
    return np.asarray(d.min(axis=2) <= min(gaps, default=255.0) / 3, dtype=np.bool_)


def sampled(photo: Path, names: list[str], samples: list[str]) -> npt.NDArray[np.float64] | None:
    """The photo's colour of each named colour, from `name=X,Y` points (the mean of a 9×9 patch round each)."""
    if not samples:
        return None
    a = np.asarray(Image.open(photo).convert("RGB"), dtype=np.float64)
    got: dict[str, list[npt.NDArray[np.float64]]] = {}
    for item in samples:
        name, xy = item.split("=", 1)
        x, y = (round(float(v)) for v in xy.split(","))
        got.setdefault(name, []).append(a[y - 4 : y + 5, x - 4 : x + 5].reshape(-1, 3).mean(0))
    missing = [n for n in names if n not in got]
    if missing:
        raise SystemExit(f"--sample each colour: missing {', '.join(missing)}")
    return np.array([np.mean(got[n], axis=0) for n in names])


def palette_ref(livery: Livery, names: list[str]) -> npt.NDArray[np.float64]:
    hexes = [livery.get("palette", {})[n]["hex"] for n in names]
    return np.array([[int(h[i : i + 2], 16) for i in (1, 3, 5)] for h in hexes], dtype=np.float64)


def fill_unseen(labels: npt.NDArray[np.intp], seen: npt.NDArray[np.bool_]) -> npt.NDArray[np.intp]:
    """What isn't seen takes the label of its nearest seen neighbour (spreading outward)."""
    known = seen.copy()
    filled = labels.copy()
    while not known.all():
        grow = known.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            src = np.roll(known, (dy, dx), (0, 1))
            lab = np.roll(filled, (dy, dx), (0, 1))
            take = src & ~grow
            filled[take] = lab[take]
            grow |= take
        if (grow == known).all():
            break
        known = grow
    return filled


def fields(args: list[str]) -> None:
    ap = argparse.ArgumentParser(prog="photo_trace.py fields")
    ap.add_argument("photo", type=Path)
    ap.add_argument("fit", type=Path)
    ap.add_argument("scheme", type=Path)
    ap.add_argument("--part", default="fuselage", choices=["fuselage", "fin"])
    ap.add_argument("--colors", required=True, help="the scheme's palette names to use, comma-separated")
    ap.add_argument("--min", type=float, default=0.5, help="smallest field kept, meters")
    ap.add_argument("--hide", action="append", default=[], help="X0,Y0,X1,Y1: photo pixels not to read (a wing)")
    ap.add_argument("--no-shade", action="store_true", help="don't correct for light falling off round the part")
    ap.add_argument("--sample", action="append", default=[], help="NAME=X,Y: a spot of that colour in this photo")
    ap.add_argument("--png", type=Path, help="the fields drawn in the part's space, to look at")
    a = ap.parse_args(args)
    fitted = json.loads(a.fit.read_text())
    shape = Shape(load_json(Path(fitted["shape"])))
    names = a.colors.split(",")
    ref = palette_ref(load_livery(a.scheme), names)
    xs, ys, rgb, seen = read_part(a.photo, fitted, shape, a.part, a.hide)
    _, _, sx, sy = part_grid(shape, a.part)
    rows, cols = len(ys), len(xs)
    lo, hi = (-1.0, 1.0) if a.part == "fuselage" else (0.0, 1.0)
    labels, centers = classify(rgb, seen, ref, not a.no_shade, sampled(a.photo, names, a.sample))
    filled = fill_unseen(labels, seen)
    # Merge away anything smaller than --min: a majority vote over a box that size.
    r = max(1, round(a.min / 0.05 / 2))
    votes = np.stack([box_mean((filled == k).astype(np.float64), r, r) for k in range(len(names))])
    smooth = np.argmax(votes, axis=0)
    base = int(np.argmax([int((smooth == k).sum()) for k in range(len(names))]))
    print(f"seen {100 * seen.mean():.0f}% of the part; the rest filled from its neighbours", file=sys.stderr)
    areas = []
    for k in range(len(names)):
        # The base colour's islands too: a midnight hole in a white field is painted after the white.
        for loop in outer_loops(smooth == k):
            part_pts = [(xs[0] + (xs[-1] - xs[0]) * c / cols, hi - (hi - lo) * rr / rows) for c, rr in loop]
            meters = [(x * sx, y * sy) for x, y in part_pts]
            # A closed loop thins as two halves, split at the point farthest from its first.
            far = max(range(len(meters)), key=lambda i: math.dist(meters[0], meters[i]))
            keep = thin(meters[: far + 1], 0.06)[:-1] + thin([*meters[far:], meters[0]], 0.06)[:-1]
            poly = []
            for m in keep:
                x, y = part_pts[meters.index(m)]
                x = 0.0 if x <= 1e-9 else 1.0 if x >= 1 - 1e-9 else x
                y = hi if y >= hi - 1e-9 else lo if y <= lo + 1e-9 else y
                poly.append([round(x, 4), round(y, 4)])
            size = abs(sum(ax * by - bx * ay for (ax, ay), (bx, by) in itertools.pairwise([*loop, loop[0]])))
            if len(poly) >= 3:
                area = {"name": f"{names[k]} field (photo-traced)", "color": names[k], "smooth": True, "points": poly}
                areas.append((size, area))
    areas.sort(key=lambda t: -t[0])  # largest first: a field inside another paints after it
    if areas and areas[0][1]["color"] == names[base]:
        areas.pop(0)  # the base itself
    print(json.dumps({"base": names[base], "areas": [ar for _, ar in areas]}))
    if a.png:
        img = (centers.clip(0, 255)).astype(np.uint8)[smooth]
        img[~seen] = (img[~seen] * 0.5).astype(np.uint8)
        Image.fromarray(img).resize((cols * 2, rows * 2), Image.Resampling.NEAREST).save(a.png)


def scheme_labels(livery: Livery, part: str, names: list[str], xs: Any, ys: Any) -> npt.NDArray[np.intp]:
    """The scheme's colour at each grid sample (an index into `names`, -1 for a colour not among them)."""
    rows, cols = len(ys), len(xs)
    lo, hi = (-1.0, 1.0) if part == "fuselage" else (0.0, 1.0)
    p: Any = livery.get(part) or {}
    index = {n: i for i, n in enumerate(names)}
    img = Image.new("I", (cols, rows), index.get(p.get("base", ""), -1))
    g = ImageDraw.Draw(img)

    def to_grid(x: float, y: float) -> XY:
        return (x - xs[0]) / (xs[-1] - xs[0]) * (cols - 1), (hi - y) / (hi - lo) * (rows - 1)

    for area in p.get("areas") or []:
        if area.get("side") not in (None, "both", "left"):
            continue
        poly = fuselage_polygon(area, lo, hi) if part == "fuselage" else area_polygon(area, lo, hi)
        if len(poly) >= 3:
            g.polygon([to_grid(x, y) for x, y in poly], fill=index.get(area["color"], -1))
    return np.asarray(img, dtype=np.intp)


def score(args: list[str]) -> None:
    ap = argparse.ArgumentParser(prog="photo_trace.py score")
    ap.add_argument("photo", type=Path)
    ap.add_argument("fit", type=Path)
    ap.add_argument("scheme", type=Path)
    ap.add_argument("--part", default="fuselage", choices=["fuselage", "fin"])
    ap.add_argument("--colors", required=True)
    ap.add_argument("--hide", action="append", default=[])
    ap.add_argument("--no-shade", action="store_true")
    ap.add_argument("--sample", action="append", default=[], help="NAME=X,Y: a spot of that colour in this photo")
    ap.add_argument("--png", type=Path, help="where they disagree, in the part's space")
    a = ap.parse_args(args)
    fitted = json.loads(a.fit.read_text())
    shape = Shape(load_json(Path(fitted["shape"])))
    names = a.colors.split(",")
    livery = scheme_on(a.scheme, fitted)
    xs, ys, rgb, seen = read_part(a.photo, fitted, shape, a.part, a.hide)
    labels, _, sure = classify_sure(
        rgb, seen, palette_ref(livery, names), not a.no_shade, sampled(a.photo, names, a.sample)
    )
    seen = seen & sure  # windows, titles, shadows: neither for nor against
    want = scheme_labels(livery, a.part, names, xs, ys)
    agree = (labels == want) & seen
    print(f"{a.scheme.name}: {100 * agree.sum() / max(seen.sum(), 1):.1f}% of the {a.part} seen in the photo agrees")
    for k, n in enumerate(names):
        photo_k = (labels == k) & seen
        if photo_k.any():
            print(
                f"  {n}: {100 * photo_k.mean() / max(seen.mean(), 1e-9):.0f}% of the photo, "
                f"{100 * ((want == k) & photo_k).sum() / photo_k.sum():.0f}% of that matched"
            )
    if a.png:
        img = np.zeros((*labels.shape, 3), dtype=np.uint8) + 40
        img[agree] = (90, 170, 110)
        img[seen & ~agree] = (220, 70, 60)
        Image.fromarray(img).resize((len(xs) * 2, len(ys) * 2), Image.Resampling.NEAREST).save(a.png)


def main() -> int:
    commands = {"align": align, "trace": trace, "probe": probe, "overlay": overlay, "fields": fields, "score": score}
    if len(sys.argv) < 2 or sys.argv[1] not in commands:
        print(__doc__)
        return 2
    commands[sys.argv[1]](sys.argv[2:])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
