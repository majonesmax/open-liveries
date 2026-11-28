"""What the tools share: where the files are, reading and writing them in the repo's format, and the few
rules every reader of a scheme needs (color names, area polygons, livery references)."""

import json
import math
import time
import urllib.error
import urllib.request
from itertools import pairwise
from pathlib import Path
from typing import Any, NamedTuple, cast

from shapes import AirframeFile, Area, Livery, Operator, Point

ROOT = Path(__file__).resolve().parent.parent
LIVERIES = ROOT / "liveries"
AIRFRAMES = ROOT / "airframes"


def load_json(path: Path) -> Any:
    """A JSON file, as json.loads gives it. Callers name its shape (shapes.py) straight away."""
    return json.loads(path.read_text())


def write_json(path: Path, data: object) -> None:
    """The repo's format: indented by 2, UTF-8 as is (not \\u escapes), a newline at the end."""
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


#: How the tools identify themselves to the services they ask.
USER_AGENT = "open-liveries/0 (+https://github.com/majonesmax/open-liveries)"


def request(url: str) -> urllib.request.Request:
    """A request carrying the tools' User-Agent."""
    return urllib.request.Request(url, headers={"User-Agent": USER_AGENT})


def fetch_json(url: str, timeout: float = 30, retries: int = 0) -> Any:
    """A URL's JSON. Asked too often (HTTP 429), it waits as the service asks (Retry-After), or longer each time,
    and tries again up to `retries` times; other errors are raised."""
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(request(url), timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == retries:
                raise
            retry_after = e.headers.get("Retry-After", "")
            time.sleep(float(retry_after) if retry_after.isdigit() else 15.0 * (attempt + 1))
    raise AssertionError("unreachable")


def livery_paths() -> list[Path]:
    """Every scheme file, liveries/<airline>/<id>.json, in order."""
    return sorted(LIVERIES.glob("*/*.json"))


def airframe_paths() -> list[Path]:
    """Every airframe file, airframes/<airline>.json, in order."""
    return sorted(AIRFRAMES.glob("*.json"))


def load_livery(path: Path) -> Livery:
    return cast(Livery, load_json(path))


def load_airframes(path: Path) -> AirframeFile:
    return cast(AirframeFile, load_json(path))


def load_operators() -> dict[str, Operator]:
    return cast(dict[str, Operator], load_json(ROOT / "operators.json"))


def livery_ref(airline: str, livery: str) -> str:
    """An airframe's livery as "ICAO/id": its own airline's unless it names another ("UAL/express")."""
    return livery if "/" in livery else f"{airline}/{livery}"


def ceased_airlines() -> set[str]:
    """The past airlines (`ceased` in airlines.json): their schemes are only ever asked for by ref."""
    return {code for code, airline in load_json(ROOT / "airlines.json")["airlines"].items() if "ceased" in airline}


def is_default(livery: Livery, defaults: dict[str, Any]) -> bool:
    """An airline's own scheme, once it's drawn from photos: the one most of its fleet wears (`commonest`), else its
    current one. `defaults` is the airlines given one so far."""
    if livery["confidence"] == "approximate" or livery.get("to"):
        return False
    return bool(livery.get("commonest")) or (livery["id"] == "standard" and livery["airline"] not in defaults)


def operator_scheme(code: str) -> tuple[str, Livery | None]:
    """The scheme an operator flies in, as an app keys it: a regional brand drawn as a variant of its parent's
    (`AAL/eagle`, `UAL/express`) by its ref, with the scheme; else its parent's code, for the parent's own scheme
    (and when the variant isn't drawn well enough to stand in for it)."""
    ref = load_operators()[code]["wears"]
    parent = ref.split("/")[0]
    path = LIVERIES / f"{ref}.json"
    scheme = load_livery(path) if path.exists() else None
    if not scheme or "fuselage" not in scheme or scheme["confidence"] == "approximate" or scheme.get("to"):
        return parent, None
    if scheme.get("commonest") or scheme["id"] == "standard":
        return parent, None
    return ref, scheme


class Selection(NamedTuple):
    """The drawn schemes an app needs, as the exports choose them."""

    #: Each airline's default scheme, by its ICAO code.
    airlines: dict[str, Livery]
    #: The other schemes by ref: specials and retros, then regular schemes only some jets wear (named by an airframe).
    liveries: dict[str, Livery]
    #: Past airlines' schemes by ref, never an airline's default or named by a live airframe.
    past: dict[str, Livery]
    #: Each current airframe's scheme by ICAO address, and by registration.
    by_hex: dict[str, str]
    by_reg: dict[str, str]


def select_schemes() -> Selection:
    """Which drawn schemes the exports carry, and which airframes wear which."""
    ceased = ceased_airlines()
    selection = Selection({}, {}, {}, {}, {})
    for path in livery_paths():
        livery = load_livery(path)
        if "fuselage" not in livery:
            continue
        ref = f"{livery['airline']}/{livery['id']}"
        if livery["airline"] in ceased:
            if livery["confidence"] != "approximate":
                selection.past[ref] = livery
        elif livery["kind"] == "standard":
            if is_default(livery, selection.airlines):
                selection.airlines[livery["airline"]] = livery
        else:
            selection.liveries[ref] = livery
    for path in airframe_paths():
        airframes = load_airframes(path)
        for airframe in airframes["airframes"]:
            ref = livery_ref(airframes["airline"], airframe["livery"])
            if airframe.get("to"):
                continue
            if ref not in selection.liveries:
                # A regular scheme worn by only some of a callsign's jets (a freighter scheme, Amazon's, DHL's on a
                # mixed operator): included for its airframes, not announced as a special.
                scheme_path = LIVERIES / f"{ref}.json"
                scheme = load_livery(scheme_path) if scheme_path.exists() else None
                if not scheme or "fuselage" not in scheme or scheme["confidence"] == "approximate":
                    continue
                selection.liveries[ref] = scheme
            if airframe.get("hex"):
                selection.by_hex[airframe["hex"]] = ref
            selection.by_reg[airframe["registration"]] = ref
    return selection


TYPE_PARTS = ("fuselage", "fin", "stabilizer", "wings", "winglets", "engines")


def type_key(livery: Livery, shape: dict[str, Any]) -> str | None:
    """Which of a scheme's `types` entries applies on a measured shape (shapes/<id>.json): the one keyed by its id,
    else the first keyed by one of its ICAO types (docs/COORDINATES.md, Paint for one type)."""
    types = livery.get("types", {})
    if shape.get("id") in types:
        return str(shape["id"])
    return next((t for t in shape.get("types", []) if t in types), None)


def paint_for(livery: Livery, key: str | None) -> Livery:
    """The scheme with its `types[key]` entry laid over its own paint, as the renderer does (renderer/src/per-type.ts):
    the palette merged by name, each part's keys replacing the base part's, titles and logos replaced whole; without
    `types`. The scheme itself (still with `types`) when there's no such entry."""
    paint = livery.get("types", {}).get(key) if key else None
    if not paint:
        return livery
    merged: dict[str, Any] = {k: v for k, v in livery.items() if k != "types"}
    if "palette" in paint:
        merged["palette"] = {**livery.get("palette", {}), **paint["palette"]}
    for part in TYPE_PARTS:
        if part in paint:
            merged[part] = {**cast(dict[str, Any], livery.get(part, {})), **paint[part]}
    for part in ("titles", "logos"):
        if part in paint:
            merged[part] = paint[part]
    return cast(Livery, merged)


def resolve_color(livery: Livery, color: str | None) -> str | None:
    """A color as hex: as given if it's already "#RRGGBB", else from the scheme's palette (None if missing)."""
    if not color:
        return None
    if color.startswith("#"):
        return color
    entry = livery.get("palette", {}).get(color)
    return entry["hex"] if entry else None


XY = tuple[float, float]
CURVE_STEPS = 8  # points along each curved stretch between two of an area's points (as the renderer)


def _curve_stretch(p0: XY, p1: XY, p2: XY, p3: XY) -> list[XY]:
    """A centripetal Catmull-Rom curve from p1 toward p2 (p2 left for the next stretch), as the renderer draws it."""

    def gap(a: XY, b: XY) -> float:
        return max(math.sqrt(math.hypot(b[0] - a[0], b[1] - a[1])), 1e-6)

    t1 = gap(p0, p1)
    t2 = t1 + gap(p1, p2)
    t3 = t2 + gap(p2, p3)

    def mix(a: XY, b: XY, ta: float, tb: float, t: float) -> XY:
        w = (t - ta) / (tb - ta)
        return (a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w)

    out = []
    for i in range(CURVE_STEPS):
        t = t1 + (t2 - t1) * i / CURVE_STEPS
        a1, a2, a3 = mix(p0, p1, 0, t1, t), mix(p1, p2, t1, t2, t), mix(p2, p3, t2, t3, t)
        out.append(mix(mix(a1, a2, 0, t2, t), mix(a2, a3, t1, t3, t), t1, t2, t))
    return out


def _curve_through(run: list[XY]) -> list[XY]:
    """A curve through a run of points, sharp at both ends (each end's missing neighbour mirrored)."""
    out: list[XY] = []
    for i in range(len(run) - 1):
        p1, p2 = run[i], run[i + 1]
        p0 = run[i - 1] if i > 0 else (2 * p1[0] - p2[0], 2 * p1[1] - p2[1])
        p3 = run[i + 2] if i + 2 < len(run) else (2 * p2[0] - p1[0], 2 * p2[1] - p1[1])
        out += [p1] if len(run) == 2 else _curve_stretch(p0, p1, p2, p3)
    return [*out, run[-1]] if run else out


def is_corner(p: Point, edges: tuple[float, float]) -> bool:
    """A point an area's outline keeps sharp: flagged ([x, y, 1]), or on or past the part's edge."""
    e = 1e-6
    return (len(p) > 2 and p[2] == 1) or p[0] <= e or p[0] >= 1 - e or p[1] <= edges[0] + e or p[1] >= edges[1] - e


def smooth_closed(points: list[Point], edges: tuple[float, float]) -> list[XY]:
    """A closed outline as a smooth curve through its points, sharp at its corners (docs/COORDINATES.md)."""
    xy = [(p[0], p[1]) for p in points]
    corners = [i for i, p in enumerate(points) if is_corner(p, edges)]
    if len(points) < 3:
        return xy
    n = len(xy)
    if not corners:
        return [q for i in range(n) for q in _curve_stretch(xy[i - 1], xy[i], xy[(i + 1) % n], xy[(i + 2) % n])]
    start = corners[0]
    ring = xy[start:] + xy[:start] + [xy[start]]
    flags = [is_corner(p, edges) for p in points[start:] + points[:start] + [points[start]]]
    out: list[XY] = []
    begin = 0
    for i in range(1, len(ring)):
        if flags[i]:
            out += _curve_through(ring[begin : i + 1])[:-1]
            begin = i
    return out


def smooth_line(line: list[Point], edges: tuple[float, float]) -> list[XY]:
    """An open line as a smooth curve through its points: its ends and corners sharp."""
    xy = [(p[0], p[1]) for p in line]
    out: list[XY] = []
    begin = 0
    for i in range(1, len(line)):
        if i < len(line) - 1 and not is_corner(line[i], edges):
            continue
        out += _curve_through(xy[begin : i + 1])[:-1]
        begin = i
    return [*out, xy[-1]] if xy else out


def to_height(y: float) -> float:
    """Round the fuselage y is an angle; a side view draws it at this height (COORDINATES.md)."""
    return math.sin(max(-1.0, min(1.0, y)) * math.pi / 2)


def from_height(h: float) -> float:
    return math.asin(max(-1.0, min(1.0, h))) * 2 / math.pi


EDGE_STEP = 0.003  # the renderer's: points along an edge at most this far apart


def fuselage_polygon(area: Area, lo: float = -1, hi: float = 1) -> list[XY]:
    """A fuselage area's outline as the renderer draws it: its edges straight (or curved) as seen from the side,
    so shaped in side-view heights, pointed along every edge, and turned back to y (an angle round the fuselage)."""
    return from_heights(fuselage_heights(area, lo, hi))


def fuselage_heights(area: Area, lo: float = -1, hi: float = 1) -> list[XY]:
    """A fuselage area's outline in side-view heights (`to_height`), as `fuselage_polygon` shapes it."""

    def shaped(points: list[Point]) -> list[Point]:
        return [[p[0], to_height(p[1]), *p[2:]] for p in points]

    in_heights: Area = {**area}
    for key in ("points", "below", "above"):
        if key in area:
            in_heights[key] = shaped(area[key])
    return area_polygon(in_heights, to_height(lo), to_height(hi))


def from_heights(poly: list[XY]) -> list[XY]:
    """An outline in side-view heights pointed along every edge and turned back to y."""
    out: list[XY] = []
    for p, q in zip(poly, [*poly[1:], poly[0]], strict=True):
        n = max(1, math.ceil(math.hypot(q[0] - p[0], q[1] - p[1]) / EDGE_STEP))
        out += [(p[0] + (q[0] - p[0]) * s / n, from_height(p[1] + (q[1] - p[1]) * s / n)) for s in range(n)]
    return out


def _hex_rgb(hex_color: str) -> tuple[int, int, int]:
    return int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16)


def gradient_bands(livery: Livery, area: Area, poly: list[XY], heights: bool = False) -> list[tuple[str, list[XY]]]:
    """A gradient area (docs/COORDINATES.md › Gradients) for a drawing that paints only flat colors: its outline
    `poly` (in side-view heights on the fuselage, `heights`) cut into bands across the fade, each the color at its
    middle (mixed in sRGB, as SVG mixes), fine enough not to read as stripes. One band of its `color` without one."""
    g = area.get("gradient")
    base = resolve_color(livery, area["color"]) or "#808080"
    if not g:
        return [(base, poly)]
    lift = to_height if heights else (lambda y: y)
    fx, fy = g["from"][0], lift(g["from"][1])
    dx, dy = g["to"][0] - fx, lift(g["to"][1]) - fy
    length2 = dx * dx + dy * dy
    stops = [(float(o), resolve_color(livery, c) or base) for o, c in g["stops"]]
    if length2 == 0 or not stops:
        return [(base, poly)]

    def at(t: float) -> str:
        if t <= stops[0][0]:
            return stops[0][1]
        for (o0, c0), (o1, c1) in pairwise(stops):
            if t <= o1:
                w = (t - o0) / (o1 - o0) if o1 > o0 else 1
                a, b = _hex_rgb(c0), _hex_rgb(c1)
                return "#" + "".join(f"{round(p + (q - p) * w):02X}" for p, q in zip(a, b, strict=True))
        return stops[-1][1]

    def t_of(p: XY) -> float:
        return ((p[0] - fx) * dx + (p[1] - fy) * dy) / length2

    # Cuts: each stop, and steps between two stops about every 4% of their largest channel's change, up to 16.
    cuts = [stops[0][0]]
    for (o0, c0), (o1, c1) in pairwise(stops):
        change = max(abs(p - q) for p, q in zip(_hex_rgb(c0), _hex_rgb(c1), strict=True))
        n = max(1, min(16, math.ceil(change / 10))) if o1 > o0 else 0
        cuts += [o0 + (o1 - o0) * (i + 1) / n for i in range(n)]
    ranges = [(-math.inf, cuts[0]), *pairwise(cuts), (cuts[-1], math.inf)]
    out: list[tuple[str, list[XY]]] = []
    for t0, t1 in ranges:
        band = poly
        if t0 > -math.inf:
            band = _clip(band, lambda p, t0=t0: t_of(p) - t0)
        if t1 < math.inf:
            band = _clip(band, lambda p, t1=t1: t1 - t_of(p))
        area_x2 = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(band, [*band[1:], *band[:1]], strict=True))
        if len(band) >= 3 and abs(area_x2) > 1e-9:
            middle = t0 if t1 == math.inf else t1 if t0 == -math.inf else (t0 + t1) / 2
            out.append((at(middle), band))
    return out


def _clip(pts: list[XY], keep: Any) -> list[XY]:
    """Sutherland–Hodgman against one half-plane, `keep(p)` → signed distance (≥ 0 kept)."""
    out: list[XY] = []
    for a, b in zip(pts, [*pts[1:], *pts[:1]], strict=True):
        da, db = keep(a), keep(b)
        if da >= 0:
            out.append(a)
        if (da >= 0) != (db >= 0):
            t = da / (da - db)
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def gradient_ends(source: list[XY], drawn: list[XY], start: XY, end: XY) -> tuple[XY, XY] | None:
    """Where a gradient from `start` to `end` in a part's space runs in a drawing, given points of the part and where
    they're drawn: through the best-fitting affine map (renderer/src/paint.ts `gradientEnds`)."""
    n = min(len(source), len(drawn))
    if n < 3:
        return None
    sx, sy = sum(p[0] for p in source[:n]) / n, sum(p[1] for p in source[:n]) / n
    qx, qy = sum(p[0] for p in drawn[:n]) / n, sum(p[1] for p in drawn[:n]) / n
    xx = xy = yy = ux = uy = vx = vy = 0.0
    for (px, py), (rx, ry) in zip(source[:n], drawn[:n], strict=True):
        a, b, u, v = px - sx, py - sy, rx - qx, ry - qy
        xx, xy, yy = xx + a * a, xy + a * b, yy + b * b
        ux, uy, vx, vy = ux + u * a, uy + u * b, vx + v * a, vy + v * b
    det = xx * yy - xy * xy
    if abs(det) < 1e-12 * (xx * yy or 1):
        return None
    a11, a12 = (ux * yy - uy * xy) / det, (uy * xx - ux * xy) / det
    a21, a22 = (vx * yy - vy * xy) / det, (vy * xx - vx * xy) / det
    ex, ey = end[0] - start[0], end[1] - start[1]
    length2, a_det = ex * ex + ey * ey, a11 * a22 - a12 * a21
    if length2 == 0 or abs(a_det) < 1e-12:
        return None
    gx, gy = (a22 * ex - a21 * ey) / a_det / length2, (-a12 * ex + a11 * ey) / a_det / length2
    g2 = gx * gx + gy * gy
    x0 = qx + a11 * (start[0] - sx) + a12 * (start[1] - sy)
    y0 = qy + a21 * (start[0] - sx) + a22 * (start[1] - sy)
    return (x0, y0), (x0 + gx / g2, y0 + gy / g2)


def area_polygon(area: Area, lo: float, hi: float, edges: tuple[float, float] | None = None) -> list[XY]:
    """An area as a closed polygon in its part's space. A `below` line is closed down to `lo` (the part's
    lower edge), an `above` line up to `hi`; with both, the band between them. Its outline is a smooth curve
    With `smooth: true` its outline is a smooth curve through its points, sharp at corners and at the part's edges
    (`edges`, by default `lo` and `hi`), as the renderer draws it; otherwise straight lines."""
    edges = edges or (lo, hi)
    straight = area.get("smooth") is not True

    def line(points: list[Point]) -> list[XY]:
        return [(p[0], p[1]) for p in points] if straight else smooth_line(points, edges)

    if "points" in area:
        return [(p[0], p[1]) for p in area["points"]] if straight else smooth_closed(area["points"], edges)
    below = line(area["below"]) if "below" in area else None
    above = line(area["above"]) if "above" in area else None
    if below and above:
        return below + list(reversed(above))
    if below:
        return [*below, (below[-1][0], lo), (below[0][0], lo)]
    if above:
        return [*above, (above[-1][0], hi), (above[0][0], hi)]
    raise ValueError(f"an area needs points, below or above: {area}")


THIN = 0.001  # how far a thinned outline may stray, in part units (about 4 cm along a narrowbody's fuselage)


def thin(points: list[tuple[float, float]], tolerance: float = THIN) -> list[tuple[float, float]]:
    """Ramer-Douglas-Peucker: the points a polyline needs to stay within `tolerance` of itself."""
    if len(points) < 3:
        return points
    (ax, ay), (bx, by) = points[0], points[-1]
    length = math.hypot(bx - ax, by - ay)
    far, index = 0.0, 0
    for i, (x, y) in enumerate(points[1:-1], 1):
        # A closed outline starts and ends on one point: there, the distance from it.
        d = abs((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / length if length else math.hypot(x - ax, y - ay)
        if d > far:
            far, index = d, i
    if far <= tolerance:
        return [points[0], points[-1]]
    return thin(points[: index + 1], tolerance)[:-1] + thin(points[index:], tolerance)
