"""Areas that look like a sampled curve: candidates for `"smooth": true` (docs/COORDINATES.md, "Curved outlines"),
to check against their photos.

An area is listed when it isn't smooth yet and every point smoothing would round off turns gently (no sharper than
`--angle`; 180° is straight on), measured in meters on a typical narrowbody, and one of these holds (the `why`
column):
  moves  at least `--points` points inside the part (off its edges), and smoothing would move it `--min` or more;
  dense  a closed outline with at least `--dense` points inside the part that turns one way for long runs (not a
         zigzag): a sampled circle or arc (a disc, a "C") that smoothing hardly moves, because its points are
         already close, but draws truly round;
  line   a band's edge (`below`/`above`) with a point inside the part where it bends, by `--line-min` or more:
         a fin's swept band edge drawn as a few points.
Each shows how far smoothing would move its outline. A real corner among gentle points gets `[x, y, 1]`.
Usage: .venv/bin/python -I tools/smoothing_review.py [--points 3] [--angle 140] [--min 0.05] [--dense 12]
       [--line-min 0.01] [--tsv OUT.tsv]"""

import argparse
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import area_polygon, is_corner, livery_paths, load_livery
from shapes import Area, Point

# Meters per unit of each part's x and y on a typical narrowbody, so a stray reads as a distance on the aircraft.
# (part key, y range, x meters, y meters per unit)
PARTS: list[tuple[str, tuple[float, float], float, float]] = [
    ("fuselage", (-1, 1), 38.0, 2.0),
    ("fin", (0, 1), 5.0, 6.0),
    ("engines", (-1, 1), 4.0, 1.1),
    ("winglets", (0, 1), 1.0, 2.4),
]

XY = tuple[float, float]


def segment_distance(p: XY, a: XY, b: XY) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


def stray(smooth: list[XY], straight: list[XY]) -> float:
    """The farthest any point of the smooth outline is from the straight one."""
    edges = list(zip(straight, straight[1:] + straight[:1], strict=True))
    return max((min(segment_distance(p, a, b) for a, b in edges) for p in smooth), default=0.0)


def sharpest(points: list[Point], closed: bool, edges: tuple[float, float], sx: float, sy: float) -> float:
    """The smallest angle at a point smoothing rounds off, in degrees (180 is straight on)."""
    n = len(points)
    best = 180.0
    for i, p in enumerate(points):
        if is_corner(p, edges) or (not closed and i in (0, n - 1)):
            continue
        a, b = points[i - 1], points[(i + 1) % n]
        v1 = ((a[0] - p[0]) * sx, (a[1] - p[1]) * sy)
        v2 = ((b[0] - p[0]) * sx, (b[1] - p[1]) * sy)
        n1, n2 = math.hypot(*v1), math.hypot(*v2)
        if n1 and n2:
            cos = max(-1.0, min(1.0, (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)))
            best = min(best, math.degrees(math.acos(cos)))
    return best


def turn_flips(points: list[Point], edges: tuple[float, float], sx: float, sy: float) -> int:
    """How often a closed outline switches between turning left and right at the points smoothing rounds off: a
    sampled circle or arc hardly ever does, a zigzag at every point. Points where it runs nearly straight (a
    sampled curve's noise) don't count, nor do its corners and the points on the part's edges."""
    signs = []
    n = len(points)
    for i, p in enumerate(points):
        if is_corner(p, edges):
            continue
        a, b = points[i - 1], points[(i + 1) % n]
        u = ((p[0] - a[0]) * sx, (p[1] - a[1]) * sy)
        v = ((b[0] - p[0]) * sx, (b[1] - p[1]) * sy)
        span = math.hypot(*u) * math.hypot(*v)
        if span and abs(u[0] * v[1] - u[1] * v[0]) / span > 0.035:  # turning by more than about 2°
            signs.append(u[0] * v[1] - u[1] * v[0] > 0)
    return sum(1 for i in range(len(signs)) if signs[i] != signs[i - 1])


def inner_points(area: Area, edges: tuple[float, float]) -> int:
    """How many of its points are inside the part, off its edges (where a curve would bend)."""
    lines = [area["points"]] if "points" in area else [area[k] for k in ("below", "above") if k in area]
    return sum(
        1
        for line in lines
        for i, p in enumerate(line)
        if (not is_corner(p, edges) and 0 < i < len(line) - 1)
        or ("points" in area and not is_corner(p, edges) and i in (0, len(line) - 1))
    )


def review(area: Area, edges: tuple[float, float], sx: float, sy: float) -> tuple[float, float]:
    """(how far smoothing would move it, in meters; its sharpest inner turn) for one area."""
    lo, hi = edges

    def scale(pts: list[XY]) -> list[XY]:
        return [(x * sx, y * sy) for x, y in pts]

    straight = scale(area_polygon({**area, "smooth": False}, lo, hi, edges))
    smooth = scale(area_polygon({**area, "smooth": True}, lo, hi, edges))
    lines = [area["points"]] if "points" in area else [area[k] for k in ("below", "above") if k in area]
    angle = min(sharpest(line, "points" in area, edges, sx, sy) for line in lines)
    return stray(smooth, straight), angle


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--points", type=int, default=3, help="at least this many points inside the part")
    ap.add_argument("--angle", type=float, default=140, help="every inner turn at least this open (degrees)")
    ap.add_argument("--min", type=float, default=0.05, help="smoothing would move it at least this far (meters)")
    ap.add_argument("--dense", type=int, default=12, help="a closed outline with this many inner points is listed")
    ap.add_argument("--line-min", type=float, default=0.01, help="a band's bent edge moves at least this (meters)")
    ap.add_argument("--tsv", type=Path, help="also write the listed areas here")
    args = ap.parse_args()
    rows: list[tuple[float, float, int, str, str, str, str]] = []
    smooth_already = 0
    for path in livery_paths():
        livery = load_livery(path)
        ref = f"{livery['airline']}/{livery['id']}"
        for key, edges, sx, sy in PARTS:
            part = livery.get(key)
            if not isinstance(part, dict):
                continue
            for i, area in enumerate(part.get("areas") or []):
                if area.get("smooth") is True:
                    smooth_already += 1
                    continue
                inner = inner_points(area, edges)
                if inner == 0:
                    continue
                moved, angle = review(area, edges, sx, sy)
                if angle < args.angle:
                    continue
                if inner >= args.points and moved >= args.min:
                    why = "moves"
                elif (
                    "points" in area
                    and inner >= args.dense
                    and turn_flips(area["points"], edges, sx, sy) <= max(4, inner // 3)
                ):
                    why = "dense"
                elif "points" not in area and moved >= args.line_min:
                    why = "line"
                else:
                    continue
                rows.append((moved, angle, inner, why, ref, f"{key}.areas[{i}]", area.get("name", "")))
    rows.sort(key=lambda r: (r[4], r[5]))
    schemes = len({r[4] for r in rows})
    print(f"{len(rows)} areas in {schemes} schemes look like sampled curves ({smooth_already} already smooth)")
    print("moves m  sharpest°  points  why    scheme / area")
    for moved, angle, inner, why, ref, where, name in rows:
        print(f"{moved:7.2f}  {angle:9.0f}  {inner:6}  {why:5}  {ref} {where} {name}")
    if args.tsv:
        lines = ["moves_m\tsharpest_deg\tpoints\twhy\tscheme\tarea\tname"]
        lines += [f"{m:.3f}\t{a:.0f}\t{n}\t{y}\t{r}\t{w}\t{nm}" for m, a, n, y, r, w, nm in rows]
        args.tsv.write_text("\n".join(lines) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
