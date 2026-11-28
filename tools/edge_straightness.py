"""Fuselage paint edges that wander where they should run straight: a ranked list, to check against photos.

A fuselage y is a share of the local radius (docs/COORDINATES.md), so an edge written at a constant y follows the
side outline: it dips under the wing-to-body fairing and bends with the nose and tail tapers. A stripe that's straight
on the aircraft is written as a constant (or straight diagonal) height in meters, with a point at every crown and belly
outline point along its run, so it draws straight between them.

For each scheme on each shape it's flown on, each fuselage area is drawn as the renderer draws it (the scheme's paint
for that type laid over its own, the edges straight in side-view heights between points, smooth areas curved) and
turned to the side view in meters. Its outline is cut into runs along x (where it turns back, or meets the crown or
the belly), and each run is kept over the body's constant section: where the crown is level and the belly hasn't
begun its sweep up to the tail (the wing-to-body fairing is inside it). A run there spanning at least `--span`
meters is fitted with a straight line, and its farthest point from that line is its deviation. Runs that deviate by
more than `--threshold` over their middle 80% are listed, worst first, with where along the body (x share) they
stray farthest and whether the area is smooth (a curve the photos show, usually not a fault). A run is cut where it
turns sharply (`--turn`): a stripe's step or a sweep's start is a corner, not a wander. Runs off only near an end of
the section (a nose sweep or a hockey stick running into it) are listed apart, and so are schemes whose photos show an
edge bent by design (`DELIBERATE`).

Usage: .venv/bin/python -I tools/edge_straightness.py [SCHEME@SHAPE ...] [--threshold 0.03] [--span 3] [--all]
       (SCHEME as AIRLINE/id; without any, the schemes the Ghostflights broadcast flies, on its shapes)"""

import argparse
import json
import math
import sys
from bisect import bisect_right
from collections.abc import Callable
from itertools import pairwise
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import LIVERIES, ROOT, fuselage_polygon, load_livery, paint_for, type_key

# The Ghostflights broadcast's schemes and the shapes each is flown on (its data/airlines.json and tools/build_sim.py:
# the B722 on the passenger 727, the 747 on the B742, the Convair 580 on CVLT, Pan Am's 747SP and L-1011-500).
GHOSTFLIGHTS: dict[str, list[str]] = {
    "NWA/orient-red-tail": ["B752", "B722-passenger", "DC10", "B742"],
    "RC1979/herman": ["MD82", "DC91", "DC93", "DC95", "CVLT", "B722-passenger"],
    "EA1926/hockey-stick-1985": ["B722-passenger", "DC93", "DC95", "B752", "A30B", "L101"],
    "WA1926/silver-1980s": ["B722-passenger", "B733"],
    "WA1926/w-1970s": ["DC10"],
    "PS1949/smile": ["MD82", "DC93", "B462"],
    "OZ1950/swallows-1980s": ["DC91", "DC93", "MD82"],
    "TW1930/twin-stripe-1985": ["B722-passenger", "MD82", "L101", "B742"],
    "PA1927/cheatline-1985": ["B722-passenger", "B733", "B742", "B74S", "L101-500"],
    "PA1927/billboard": ["A30B"],
    "PI1948/speedbird-1985": ["B733", "B722-passenger"],
    "OC1967/stripes-1981": ["B733", "MD82"],
    "RW1968/sundance-1979": ["DC91", "DC93", "B722-passenger"],
    "PE1981/stripes-1985": ["B722-passenger", "B733", "B742"],
    "MC1981/script": ["MD82", "DC95"],
    **{
        f"BI1928/{p.stem}": ["B742"] if "747" in p.stem else ["B722-passenger"]
        for p in sorted((LIVERIES / "BI1928").glob("*.json"))
    },
}


# Schemes whose edges bend by design inside the section, seen in their photos: listed apart, not ranked.
DELIBERATE: dict[str, str] = {
    "OC1967/stripes-1981": "the bands step up behind the wing in one S (AirCal's 1981 stripes)",
    "DWI/dominican-flag": "a ribbon waving the body's length, looping down to the belly twice (Arajet's flag jet)",
}


def line_at(points: list[list[float]]) -> Callable[[float], float]:
    """A measured line's height at x meters, straight between its points (as the renderer's `at`)."""
    pts = sorted((p[0], p[1]) for p in points)
    xs = [p[0] for p in pts]

    def at(x: float) -> float:
        if x <= xs[0]:
            return float(pts[0][1])
        if x >= xs[-1]:
            return pts[-1][1]
        i = bisect_right(xs, x)
        (x0, z0), (x1, z1) = pts[i - 1], pts[i]
        return z0 if x1 == x0 else z0 + (z1 - z0) * (x - x0) / (x1 - x0)

    return at


class Body:
    """A measured shape's fuselage from the side: its outline, a fuselage (x, y) to meters, and its constant section."""

    def __init__(self, shape_id: str):
        self.shape = json.loads((ROOT / "shapes" / f"{shape_id}.json").read_text())
        fu = self.shape["fuselage"]
        self.id, self.length = shape_id, float(fu["length"])
        self.crown, self.belly = line_at(fu["crown"]), line_at(fu["belly"])
        self.outline_x = sorted({p[0] for p in fu["crown"]} | {p[0] for p in fu["belly"]})
        self.section = self._section()

    def z(self, x: float, y: float) -> float:
        """Fuselage (x share, y) to the side view's height in meters."""
        m = min(max(x, 0.0), 1.0) * self.length
        c, b = self.crown(m), self.belly(m)
        return (c + b) / 2 + (c - b) / 2 * math.sin(max(-1.0, min(1.0, y)) * math.pi / 2)

    def _section(self) -> tuple[float, float]:
        """The constant section, as x shares: the crown within 10 cm of its level and the belly within 15 cm of its
        own (a fairing hanging lower is still inside; the tail's sweep up isn't), around the middle of the body."""
        xs = [i / 1000 for i in range(1001)]
        mid = [x for x in xs if 0.3 <= x <= 0.6]
        crowns = sorted(self.crown(x * self.length) for x in mid)
        bellies = sorted(self.belly(x * self.length) for x in mid)
        crown_level, belly_level = crowns[len(crowns) // 2], bellies[3 * len(bellies) // 4]
        ok = [
            self.crown(x * self.length) >= crown_level - 0.10 and self.belly(x * self.length) <= belly_level + 0.15
            for x in xs
        ]
        i = j = 450
        while i > 0 and ok[i - 1]:
            i -= 1
        while j < 1000 and ok[j + 1]:
            j += 1
        return xs[i], xs[j]


def runs(poly: list[tuple[float, float]]) -> list[list[tuple[float, float]]]:
    """A closed (or open) outline cut into runs along x: at each turn back, and where it lies on the crown or belly."""
    out: list[list[tuple[float, float]]] = []
    cur: list[tuple[float, float]] = []
    direction = 0
    for p in [*poly, poly[0]]:
        if abs(p[1]) >= 0.999:
            if len(cur) > 1:
                out.append(cur)
            cur, direction = [], 0
            continue
        if cur:
            dx = p[0] - cur[-1][0]
            d = 0 if abs(dx) < 1e-9 else (1 if dx > 0 else -1)
            if d == 0 or (direction and d != direction):
                if len(cur) > 1:
                    out.append(cur)
                cur = [cur[-1]] if d else []
                direction = d
            elif not direction:
                direction = d
        cur.append(p)
    if len(cur) > 1:
        out.append(cur)
    return out


def split_at_corners(run: list[tuple[float, float]], body: Body, turn: float) -> list[list[tuple[float, float]]]:
    """A run cut where it turns by more than `turn` degrees in meters (a stripe's step, a sweep's start): the
    pieces either side are judged on their own."""
    m = [(x * body.length, body.z(x, y)) for x, y in run]
    out, start = [], 0
    for i in range(1, len(run) - 1):
        a = math.atan2(m[i][1] - m[i - 1][1], m[i][0] - m[i - 1][0])
        b = math.atan2(m[i + 1][1] - m[i][1], m[i + 1][0] - m[i][0])
        d = abs((b - a + math.pi) % (2 * math.pi) - math.pi)
        if math.degrees(d) > turn:
            out.append(run[start : i + 1])
            start = i
    out.append(run[start:])
    return [r for r in out if len(r) > 1]


def fit(xs: list[float], zs: list[float]) -> tuple[float, int, float]:
    """The straight line's farthest miss (meters), where (index), and its slope."""
    n = len(xs)
    mx, mz = sum(xs) / n, sum(zs) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    k = sum((x - mx) * (z - mz) for x, z in zip(xs, zs, strict=True)) / sxx if sxx else 0.0
    res = [z - (mz + k * (x - mx)) for x, z in zip(xs, zs, strict=True)]
    i = max(range(n), key=lambda j: abs(res[j]))
    return abs(res[i]), i, k


def check(scheme_ref: str, shape_id: str, span: float, turn: float) -> list[dict[str, Any]]:
    livery = load_livery(LIVERIES / f"{scheme_ref}.json")
    body = Body(shape_id)
    key = type_key(livery, body.shape)
    paint = paint_for(livery, key)
    lo, hi = body.section
    found = []
    for n, area in enumerate(paint.get("fuselage", {}).get("areas", [])):
        poly = fuselage_polygon(area)
        for run in (piece for whole in runs(poly) for piece in split_at_corners(whole, body, turn)):
            inside = [(x, y) for x, y in run if lo <= x <= hi]
            if len(inside) < 3:
                continue
            xs = [x * body.length for x, _ in inside]
            if max(xs) - min(xs) < span:
                continue
            zs = [body.z(x, y) for x, y in inside]
            miss, i, slope = fit(xs, zs)
            # The same over the run's middle 80%: a sweep (the nose's, a hockey stick's) running into the section
            # at one end misses only there, and isn't a wander.
            a, z = min(xs), max(xs)
            mid = [j for j, x in enumerate(xs) if a + 0.1 * (z - a) <= x <= z - 0.1 * (z - a)]
            inner = fit([xs[j] for j in mid], [zs[j] for j in mid])[0] if len(mid) >= 3 else miss
            found.append(
                {
                    "scheme": scheme_ref,
                    "shape": shape_id,
                    "entry": key if key and "fuselage" in livery.get("types", {}).get(key, {}) else "base",
                    "area": n,
                    "name": area.get("name", ""),
                    "side": area.get("side", ""),
                    "smooth": area.get("smooth") is True,
                    "from": round(min(x for x, _ in inside), 3),
                    "to": round(max(x for x, _ in inside), 3),
                    "z": round(sum(zs) / len(zs), 2),
                    "slope": round(slope, 4),
                    "miss_cm": round(miss * 100, 1),
                    "inner_cm": round(inner * 100, 1),
                    "deliberate": DELIBERATE.get(scheme_ref, ""),
                    "at": round(inside[i][0], 3),
                    "section": (lo, hi),
                }
            )
    return found


# Fitting a straight edge (for fixing what the check finds): points along a line in meters, as fuselage [x, y].
FIT_TOLERANCE = 0.0003  # meters: how far the drawn edge may stray from the line between the points kept


def body_y(body: Body, x: float, z: float) -> float:
    """The fuselage y at x share drawn at height z meters (on the crown or belly where z is past them)."""
    m = min(max(x, 0.0), 1.0) * body.length
    c, b = body.crown(m), body.belly(m)
    r = (c - b) / 2
    return math.asin(max(-1.0, min(1.0, (z - (c + b) / 2) / r))) * 2 / math.pi if r > 0 else 0.0


def drawn_z(body: Body, p: tuple[float, float], q: tuple[float, float], x: float) -> float:
    """The height the renderer draws at x between two of an edge's points: straight in side-view heights
    (sin(y·90°)) as a share of the local radius, so it bends with the outline between them."""
    t = 0.0 if q[0] == p[0] else (x - p[0]) / (q[0] - p[0])
    h = math.sin(p[1] * math.pi / 2) + (math.sin(q[1] * math.pi / 2) - math.sin(p[1] * math.pi / 2)) * t
    m = x * body.length
    c, b = body.crown(m), body.belly(m)
    return (c + b) / 2 + (c - b) / 2 * h


def straight_edge(
    body: Body,
    x0: float,
    z0: float,
    x1: float,
    z1: float | None = None,
    tolerance: float = FIT_TOLERANCE,
    digits: int = 5,
) -> list[list[float]]:
    """An edge straight in meters from (x0, z0) to (x1, z1) (level when z1 is left out), in the order given, as
    fuselage points: one at every crown and belly outline point it runs past (and where it meets the outline), the
    rest pruned while the drawn edge stays within `tolerance` of the line; where the line is past the crown or the
    belly the points lie on it (y ±1), only its ends kept."""
    z1 = z0 if z1 is None else z1
    lo, hi = min(x0, x1), max(x0, x1)

    def target(x: float) -> float:
        return z0 + (z1 - z0) * ((x - x0) / (x1 - x0) if x1 != x0 else 0.0)

    xs = {x0, x1} | {m / body.length for m in body.outline_x if lo < m / body.length < hi}
    # Where the line meets the crown or the belly: on each stretch between outline points it's straight, so solve.
    grid = sorted(xs)
    for a, b in pairwise(grid):
        for line in (body.crown, body.belly):
            fa, fb = line(a * body.length) - target(a), line(b * body.length) - target(b)
            if fa * fb < 0:
                xs.add(a + (b - a) * fa / (fa - fb))
    grid = sorted(xs)
    # Between two outline points the drawn edge is a gentle curve: split until each piece holds the line.
    dense: list[float] = []
    for a, b in pairwise(grid):
        stack = [(a, b)]
        while stack:
            u, v = stack.pop()
            pu, pv = (u, body_y(body, u, target(u))), (v, body_y(body, v, target(v)))
            far = max(
                abs(drawn_z(body, pu, pv, u + (v - u) * k / 8) - clamp_z(body, u + (v - u) * k / 8, target))
                for k in range(1, 8)
            )
            if far > tolerance / 2 and v - u > 1e-5:
                stack += [((u + v) / 2, v), (u, (u + v) / 2)]
            else:
                dense.append(u)
    dense.append(grid[-1])
    dense = sorted(set(dense))
    pts = [(x, body_y(body, x, target(x))) for x in dense]

    # Prune: from each kept point, the farthest next one that still holds every point between to the line.
    def holds(i: int, j: int) -> bool:
        for k in range(i + 1, j):
            if abs(drawn_z(body, pts[i], pts[j], pts[k][0]) - clamp_z(body, pts[k][0], target)) > tolerance:
                return False
            mid = (pts[k - 1][0] + pts[k][0]) / 2
            if abs(drawn_z(body, pts[i], pts[j], mid) - clamp_z(body, mid, target)) > tolerance:
                return False
        return True

    kept = [0]
    while kept[-1] < len(pts) - 1:
        i, j = kept[-1], kept[-1] + 1
        while j + 1 < len(pts) and holds(i, j + 1):
            j += 1
        kept.append(j)
    out = [[round(pts[k][0], digits), round(pts[k][1], digits)] for k in kept]
    return out if x0 <= x1 else out[::-1]


def clamp_z(body: Body, x: float, target: Callable[[float], float]) -> float:
    """The line's height at x, held to the outline (paint can't leave the body)."""
    m = x * body.length
    return min(max(target(x), body.belly(m)), body.crown(m))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pairs", nargs="*", help="SCHEME@SHAPE (default: the Ghostflights set)")
    ap.add_argument("--threshold", type=float, default=0.03, help="meters off a straight line to list (0.03)")
    ap.add_argument("--span", type=float, default=3.0, help="least run length in meters to judge (3)")
    ap.add_argument("--turn", type=float, default=12.0, help="degrees a run may turn before it's cut in two (12)")
    ap.add_argument("--all", action="store_true", help="list every run, not only those over the threshold")
    ap.add_argument("--skip", action="append", default=[], help="SCHEME@SHAPE to leave out")
    args = ap.parse_args()
    pairs = [tuple(p.split("@")) for p in args.pairs] or [(s, t) for s, ts in GHOSTFLIGHTS.items() for t in ts]
    pairs = [p for p in pairs if "@".join(p) not in args.skip]
    rows = [r for s, t in pairs for r in check(s, t, args.span, args.turn)]

    def over(r: dict[str, Any]) -> bool:
        return bool(args.all or r["inner_cm"] > args.threshold * 100)

    ranked = sorted((r for r in rows if over(r) and not r["deliberate"]), key=lambda r: -r["inner_cm"])
    apart = sorted((r for r in rows if over(r) and r["deliberate"]), key=lambda r: -r["inner_cm"])
    sweeps = sorted(
        (r for r in rows if not over(r) and r["miss_cm"] > args.threshold * 100), key=lambda r: -r["miss_cm"]
    )
    head = "miss_cm\tinner_cm\tscheme@shape\tentry\tarea\tside\tsmooth\tx_from-to\tz_m\tslope\tworst_at\tname"

    def show(r: dict[str, Any]) -> str:
        return (
            f"{r['miss_cm']:.1f}\t{r['inner_cm']:.1f}\t{r['scheme']}@{r['shape']}\t{r['entry']}\t{r['area']}\t"
            f"{r['side'] or '-'}\t{'smooth' if r['smooth'] else '-'}\t{r['from']}-{r['to']}\t{r['z']}\t{r['slope']}\t"
            f"{r['at']}\t{r['name'][:70]}"
        )

    what = "every run" if args.all else f"inner > {args.threshold * 100:g} cm"
    print(f"# {len(pairs)} scheme/shape pairs, {len(rows)} runs judged; {len(ranked)} listed ({what})")
    print("# miss: farthest from a straight line over the run in the section; inner: the same over its middle 80%")
    print(head)
    for r in ranked:
        print(show(r))
    print(
        f"\n# Bent by design ({len(apart)}): " + "; ".join(sorted({f"{r['scheme']}: {r['deliberate']}" for r in apart}))
    )
    for r in apart:
        print(show(r))
    print(f"\n# Off only at an end of the section ({len(sweeps)}): a sweep running into it (nose, hockey stick)")
    for r in sweeps:
        print(show(r))
    return 0


if __name__ == "__main__":
    sys.exit(main())
