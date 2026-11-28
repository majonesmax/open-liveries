"""Draw liveries on a generic narrow-body, from the left side and from below, to check them against photos.
Usage: .venv/bin/python -I tools/preview.py [AIRLINE[/id] ...]  → build/preview/index.html (all, or those named).

Not a model of any type: a generic airliner in proportion, so shares (docs/COORDINATES.md) land where
they would on a 737 or A320. Logos are drawn as labeled outlines in their colors, not as the artwork."""

import argparse
import html
import math
import sys
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Literal, TypedDict

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (
    ROOT,
    area_polygon,
    fuselage_polygon,
    gradient_ends,
    livery_paths,
    load_livery,
    resolve_color,
    to_height,
)
from shapes import Area, Livery, Logo, Point, Title

OUT = ROOT / "build/preview"

XY = tuple[float, float]
Mapper = Callable[[float, float], XY]  # a part's (x, y) share → the drawing's px
Side = Literal["left", "right"]

L, R = 720.0, 36.0  # fuselage length and radius, px
X0 = 40.0
SIDE_CY = 150.0  # the side view's centerline
BELOW_CY = 560.0  # the view from below: the fuselage's centerline


class Planform(TypedDict):
    """A wing or stabilizer, in shares of L: leading edge and chord at root and tip, and the semi-span."""

    root_le: float
    root_chord: float
    tip_le: float
    tip_chord: float
    semi: float


WING = Planform(root_le=0.36, root_chord=0.17, tip_le=0.54, tip_chord=0.06, semi=0.42)
STAB = Planform(root_le=0.84, root_chord=0.10, tip_le=0.93, tip_chord=0.045, semi=0.17)
FIN = {"root_le": 0.79, "root_te": 0.975, "tip_le": 0.925, "tip_te": 0.99, "height": 2.6}  # height in R
# x share, length share of L, radius in R, span share of the wing
ENGINE = {"x": 0.33, "length": 0.13, "radius": 0.55, "span": 0.33}

DEFAULT = {
    "wing_top": "#B9BEC5",
    "wing_under": "#C9CDD2",
    "engine": "#D9DCE0",
    "lip": "#C0C4CA",
    "windows": "#2A2F38",
}
MISSING = "#FF00FF"  # a color the scheme names but doesn't define: loud on purpose
SQUARE = [(0.0, -1.0), (1.0, -1.0), (1.0, 1.0), (0.0, 1.0)]  # a whole engine, in its own space
UNIT = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]  # a whole wing or stabilizer
STROKE = 'stroke="#555" stroke-width="0.6"'
SWATCH_STROKE = 'stroke="#555" stroke-width="0.5"'


def color(livery: Livery, c: str | None, fallback: str = MISSING) -> str:
    return resolve_color(livery, c) or fallback


def shape(x: float) -> XY:
    """The fuselage's outline at x: (center offset, radius scale), in R. A rounded nose and a tail cone that
    sweeps up."""
    if x < 0.08:
        t = x / 0.08
        return (-0.08 * (1 - t), max(math.sqrt(max(1 - (1 - t) ** 2, 0)), 0.02))
    if x > 0.78:
        t = (x - 0.78) / 0.22
        s = 1 - 0.78 * t**1.3
        return ((1 - s) * 0.8, s)
    return (0.0, 1.0)


def side_point(x: float, y: float) -> XY:
    c, s = shape(x)
    y = max(-1.0, min(1.0, y))
    return X0 + x * L, SIDE_CY - (c + s * math.sin(y * math.pi / 2)) * R


def below_point(x: float, y: float, side: str) -> XY:
    """From below, nose to the left: the left side shows above the centerline (y −1 → 0 only)."""
    _, s = shape(x)
    y = max(-1.0, min(0.0, y))
    z = s * math.cos(y * math.pi / 2) * R
    return X0 + x * L, BELOW_CY + (-z if side == "left" else z)


def densify(pts: Sequence[XY], step: float = 0.01) -> list[XY]:
    """The closed polygon with points added along each edge, at most `step` apart, so it bends with the body."""
    out = []
    for (x1, y1), (x2, y2) in zip(pts, [*pts[1:], *pts[:1]], strict=True):
        n = max(1, int(max(abs(x2 - x1), abs(y2 - y1)) / step))
        out += [(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n) for i in range(n)]
    return out


def clip_half(pts: Sequence[XY], keep: Callable[[XY], float]) -> list[XY]:
    """Sutherland–Hodgman against one half-plane, `keep(p)` → signed distance (≥ 0 kept)."""
    out = []
    for a, b in zip(pts, [*pts[1:], *pts[:1]], strict=True):
        da, db = keep(a), keep(b)
        if da >= 0:
            out.append(a)
        if (da >= 0) != (db >= 0):
            t = da / (da - db)
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def path(points: Sequence[XY]) -> str:
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in points) + " Z"


def mapped(mapper: Mapper, points: Sequence[XY]) -> str:
    """An SVG path of a polygon in a part's space, densified and mapped to the drawing."""
    return path([mapper(*p) for p in densify(points)])


def sides(item: Area | Title | Logo) -> list[str]:
    side = item.get("side", "both")
    return ["left", "right"] if side == "both" else [side]


def outline_side() -> list[XY]:
    top = [side_point(i / 200, 1) for i in range(201)]
    bottom = [side_point(i / 200, -1) for i in range(200, -1, -1)]
    return top + bottom


def outline_below(side: str) -> list[XY]:
    edge = [below_point(i / 200, 0, side) for i in range(201)]
    center = [below_point(i / 200, -1, side) for i in range(200, -1, -1)]
    return edge + center


def fin_point(x: float, y: float) -> XY:
    le = FIN["root_le"] + (FIN["tip_le"] - FIN["root_le"]) * y
    te = FIN["root_te"] + (FIN["tip_te"] - FIN["root_te"]) * y
    fx = le + (te - le) * x
    root_y = side_point(FIN["root_le"] + (FIN["root_te"] - FIN["root_le"]) * x, 1)[1] + 3
    return X0 + fx * L, root_y - y * FIN["height"] * R


def surface_point(spec: Planform, x: float, y: float, side: str, root_z: float) -> XY:
    le = spec["root_le"] + (spec["tip_le"] - spec["root_le"]) * y
    chord = spec["root_chord"] + (spec["tip_chord"] - spec["root_chord"]) * y
    z = root_z + y * (spec["semi"] * L - root_z)
    return X0 + (le + chord * x) * L, BELOW_CY + (-z if side == "left" else z)


def below_mapper(side: str) -> Mapper:
    return lambda x, y: below_point(x, y, side)


def surface_mapper(spec: Planform, side: str, root_z: float) -> Mapper:
    return lambda x, y: surface_point(spec, x, y, side, root_z)


def engine_box(side_view: bool, side: str = "left") -> Mapper:
    """The nacelle's mapping: from below, under the wing at `span`; from the side, under the fuselage."""
    length, rad = ENGINE["length"] * L, ENGINE["radius"] * R
    x0 = X0 + ENGINE["x"] * L
    if side_view:
        cy = SIDE_CY + R * 1.0
        return lambda x, y: (x0 + x * length, cy - y * rad)
    z = R + ENGINE["span"] * (WING["semi"] * L - R)
    cz = BELOW_CY + (-z if side == "left" else z)
    return lambda x, y: (x0 + x * length, cz + (-y if side == "left" else y) * rad)


def draw_areas(
    d: Livery,
    areas: Sequence[Area] | None,
    mapper: Mapper,
    lo: float,
    hi: float,
    svg: list[str],
    clip: str = "",
    fuselage: bool = False,
    heights: bool | None = None,
) -> None:
    """`heights`: a gradient's ends are in side-view heights (the fuselage's; by default when `fuselage`)."""
    edges = (float(round(lo)), float(round(hi)))  # the part's own edges (the fin's lo/hi run a little past them)
    lift = to_height if (fuselage if heights is None else heights) else (lambda y: y)
    for a in areas or []:
        attr = f' clip-path="url(#{clip})"' if clip else ""
        poly = fuselage_polygon(a, lo, hi) if fuselage else area_polygon(a, lo, hi, edges)
        fill = color(d, a["color"])
        g = a.get("gradient")
        if g:
            dense = densify(poly)
            ends = gradient_ends(
                [(x, lift(y)) for x, y in dense],
                [mapper(*p) for p in dense],
                (g["from"][0], lift(g["from"][1])),
                (g["to"][0], lift(g["to"][1])),
            )
            if ends:
                gid = f"fade{len(svg)}"
                (x1, y1), (x2, y2) = ends
                stops = "".join(f'<stop offset="{o}" stop-color="{color(d, c, fill)}"/>' for o, c in g["stops"])
                svg.append(
                    f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{x1:.1f}" y1="{y1:.1f}" '
                    f'x2="{x2:.1f}" y2="{y2:.1f}">{stops}</linearGradient>'
                )
                fill = f"url(#{gid})"
        svg.append(f'<path d="{mapped(mapper, poly)}" fill="{fill}"{attr}/>')


def box(c: str, points: list[Point]) -> Area:
    """An area of one color over a fixed box (a rudder, a radome, a windscreen mask): straight-edged."""
    return {"color": c, "points": points}


def draw_side(d: Livery, svg: list[str]) -> None:
    """The view from the left: fin, fuselage with its areas and windows, engine, titles and logos."""
    fus, fin = d["fuselage"], d.get("fin", {})
    base = color(d, fus["base"])
    svg.append('<text x="20" y="30" class="h">From the left</text>')
    # Fin, behind the fuselage's top edge.
    fin_outline = [fin_point(0, 0), fin_point(0, 1), fin_point(1, 1), fin_point(1, 0)]
    svg.append('<clipPath id="fin"><path d="' + path(fin_outline) + '"/></clipPath>')
    svg.append(f'<path d="{path(fin_outline)}" fill="{color(d, fin.get("base"), base)}" {STROKE}/>')
    if fin.get("rudder"):
        draw_areas(d, [box(fin["rudder"], [[0.72, 0], [1, 0], [1, 1], [0.72, 1]])], fin_point, 0, 1, svg, "fin")
    draw_areas(d, fin.get("areas"), fin_point, -0.05, 1.05, svg, "fin")
    # Fuselage.
    svg.append(f'<path d="{path(outline_side())}" fill="{base}"/>')
    left = [a for a in fus.get("areas", []) if "left" in sides(a)]
    draw_areas(d, left, side_point, -1, 1, svg, "fus-side", fuselage=True)
    if fus.get("radome"):
        to = fus["radome"].get("to", 0.025)
        radome = box(fus["radome"]["color"], [[0, -1], [to, -1], [to, 1], [0, 1]])
        draw_areas(d, [radome], side_point, -1, 1, svg, "fus-side")
    mask = fus.get("cockpitWindows", {}).get("mask")
    if mask:
        surround = box(mask, [[0.045, 0.12], [0.1, 0.16], [0.1, 0.5], [0.06, 0.48]])
        draw_areas(d, [surround], side_point, -1, 1, svg, "fus-side")
    # Cockpit and cabin windows.
    windscreen = [(0.055, 0.25), (0.092, 0.25), (0.09, 0.42), (0.062, 0.4)]
    svg.append(f'<path d="{mapped(side_point, windscreen)}" fill="{DEFAULT["windows"]}"/>')
    if fus.get("windows", "plain") != "hidden":
        for i in range(30):
            x = 0.13 + i * 0.021
            if 0.4 < x < 0.47:
                continue  # over the wing
            (wx, wy) = side_point(x, 0.13)
            svg.append(
                f'<rect x="{wx:.1f}" y="{wy - 3.5:.1f}" width="4" height="7" rx="1.8" '
                f'fill="{DEFAULT["windows"]}" opacity="0.85"/>'
            )
    svg.append(f'<path d="{path(outline_side())}" fill="none" {STROKE}/>')
    # Engine, from the side.
    draw_engine(d, engine_box(True), svg)
    draw_marks(d, svg, view="side")


def draw_engine(d: Livery, mapper: Mapper, svg: list[str]) -> None:
    """A nacelle: its cowling, areas and inlet lip."""
    eng = d.get("engines", {})
    cowling = color(d, eng.get("cowling"), DEFAULT["engine"])
    svg.append(f'<path d="{mapped(mapper, SQUARE)}" fill="{cowling}" {STROKE}/>')
    draw_areas(d, eng.get("areas"), mapper, -1, 1, svg)
    if eng.get("inletLip"):
        lip = [(0.0, -1.0), (0.06, -1.0), (0.06, 1.0), (0.0, 1.0)]
        svg.append(f'<path d="{mapped(mapper, lip)}" fill="{color(d, eng["inletLip"])}"/>')


def draw_below(d: Livery, svg: list[str]) -> None:
    """The view from below, nose to the left: each side's wing, stabilizer, winglet, engine and belly half."""
    fus = d["fuselage"]
    base = color(d, fus["base"])
    wings, stab, winglets = d.get("wings", {}), d.get("stabilizer", {}), d.get("winglets", {})
    svg.append(f'<text x="20" y="{BELOW_CY - WING["semi"] * L - 20:.0f}" class="h">From below</text>')
    under = color(d, wings.get("under"), DEFAULT["wing_under"])
    side: Side
    for side in ("left", "right"):
        wing = surface_mapper(WING, side, R)
        svg.append(f'<path d="{mapped(wing, UNIT)}" fill="{under}" {STROKE}/>')
        draw_areas(d, [a for a in wings.get("areas", []) if side in sides(a)], wing, 0, 1, svg)
        tailplane = surface_mapper(STAB, side, R * 0.5)
        stab_under = color(d, stab.get("under"), DEFAULT["wing_under"])
        svg.append(f'<path d="{mapped(tailplane, UNIT)}" fill="{stab_under}" {STROKE}/>')
        draw_areas(d, [a for a in stab.get("areas", []) if side in sides(a)], tailplane, 0, 1, svg)
        if winglets.get("outer"):
            tip = surface_point(WING, 0.2, 1, side, R)
            svg.append(
                f'<rect x="{tip[0] - 2:.1f}" y="{tip[1] - (6 if side == "left" else -2):.1f}" width="26" '
                f'height="4" fill="{color(d, winglets["outer"])}"/>'
            )
        draw_engine(d, engine_box(False, side), svg)
        svg.append(f'<path d="{path(outline_below(side))}" fill="{base}"/>')
        # Only the lower half of each area shows from below.
        clipped = []
        for a in fus.get("areas", []):
            if side not in sides(a):
                continue
            poly = clip_half(fuselage_polygon(a, -1, 1), lambda p: -p[1])
            if len(poly) >= 3:
                clipped.append(box(a["color"], [list(p) for p in poly]))
                if "gradient" in a:
                    clipped[-1]["gradient"] = a["gradient"]
        draw_areas(d, clipped, below_mapper(side), -1, 0, svg, f"fus-below-{side}", heights=True)
        svg.append(f'<path d="{path(outline_below(side))}" fill="none" {STROKE}/>')
    draw_marks(d, svg, view="below")


def render(d: Livery) -> str:
    """One scheme's SVG: from the left above, from below underneath, its palette beside."""
    svg = [f'<clipPath id="fus-side"><path d="{path(outline_side())}"/></clipPath>']
    for s in ("left", "right"):
        svg.append(f'<clipPath id="fus-below-{s}"><path d="{path(outline_below(s))}"/></clipPath>')
    draw_side(d, svg)
    draw_below(d, svg)
    swatches(d, svg)
    h = BELOW_CY + WING["semi"] * L + 30
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 {h:.0f}" width="900" height="{h:.0f}">'
        "<style>.h{font:600 13px -apple-system,sans-serif;fill:#333}"
        ".m{font:10px -apple-system,sans-serif;fill:#222}</style>"
        '<rect width="100%" height="100%" fill="#EEF2F6"/>' + "".join(svg) + "</svg>"
    )


def draw_title(d: Livery, t: Title, svg: list[str]) -> None:
    """A title on the left side, in a typeface like the one painted, `length` spreading its letters."""
    point = side_point if t["place"] == "fuselage" else fin_point
    (x, y) = point(*t["at"])
    cap = t["height"] * (R if t["place"] == "fuselage" else FIN["height"] * R)
    xs = ""
    if t.get("length"):
        far = point(t["at"][0] + t["length"], t["at"][1])
        step = (far[0] - x) / max(len(t["text"]) - 1, 1)
        xs = " ".join(f"{x + i * step:.1f}" for i in range(len(t["text"])))
    lettering = t.get("type", {})
    family = ", ".join([f"'{f}'" for f in lettering.get("similar", [])] + ["-apple-system", "sans-serif"])
    skew = (
        f' transform="translate({x:.1f},{y:.1f}) rotate({-t.get("rotationDeg", 0):.1f}) '
        f'skewX({-lettering.get("slantDeg", 0):.1f}) translate({-x:.1f},{-y:.1f})"'
    )
    svg.append(
        f'<text x="{xs or f"{x:.1f}"}" y="{y:.1f}" font-family="{family}" '
        f'font-weight="{lettering.get("weight", 700)}" font-size="{cap / 0.72:.1f}" '
        f'fill="{color(d, t["color"])}"{skew} xml:space="preserve">{html.escape(t["text"])}</text>'
    )


def logo_place(g: Logo, view: str) -> tuple[XY, float] | None:
    """Where a logo's center is drawn in this view and how tall, in px; None if it isn't seen in it."""
    place = g["place"]
    if view == "side" and place in ("fin", "fuselage", "engines") and "left" in sides(g):
        if place == "fin":
            return fin_point(*g["at"]), g["height"] * FIN["height"] * R
        if place == "fuselage":
            return side_point(*g["at"]), g["height"] * R
        return engine_box(True)(*g["at"]), g["height"] * ENGINE["radius"] * R * 2
    if view == "below" and place == "belly":
        return (X0 + g["at"][0] * L, BELOW_CY), g["height"] * R
    return None


def draw_marks(d: Livery, svg: list[str], view: str) -> None:
    """Titles (from the side only) and logos, as labeled outlines in their colors."""
    for t in d.get("titles", []):
        if view == "side" and "left" in sides(t) and t["place"] in ("fuselage", "fin"):
            draw_title(d, t, svg)
    for g in d.get("logos", []):
        placed = logo_place(g, view)
        if not placed:
            continue
        (x, y), hpx = placed
        cols = [color(d, c) for c in g.get("colors", [])] or ["#888"]
        w = hpx
        svg.append(
            f'<rect x="{x - w / 2:.1f}" y="{y - hpx / 2:.1f}" width="{w:.1f}" height="{hpx:.1f}" '
            f'rx="{hpx / 4:.1f}" fill="{cols[0]}" fill-opacity="0.55" stroke="{cols[-1]}" stroke-dasharray="3 2"/>'
        )
        svg.append(
            f'<text x="{x:.1f}" y="{y + hpx / 2 + 11:.1f}" class="m" text-anchor="middle">'
            f"{html.escape(g['mark'])}</text>"
        )


def swatches(d: Livery, svg: list[str]) -> None:
    """The palette's first ten colors, with their names, beside the view from below."""
    x, y = 620, BELOW_CY - WING["semi"] * L + 10
    for name, p in list(d.get("palette", {}).items())[:10]:
        note = p.get("name", "") + (" · official" if p.get("official") else "")
        svg.append(f'<rect x="{x}" y="{y}" width="14" height="14" fill="{p["hex"]}" {SWATCH_STROKE}/>')
        svg.append(
            f'<text x="{x + 20}" y="{y + 11}" class="m">{html.escape(name)} {p["hex"]} {html.escape(note)}</text>'
        )
        y += 18


def card(name: str, d: Livery) -> str:
    """The page's entry for one scheme: its picture and a caption."""
    dates = f"{d.get('from', '?')}–{d.get('to', '')}"
    return (
        f'<figure><img src="{name}.svg" width="900"><figcaption>'
        f"<b>{html.escape(d['airline'])} · {html.escape(d['name'])}</b>"
        f" ({d['kind']}, {dates}) · confidence: {d['confidence']}<br>{html.escape(d.get('description', ''))}"
        "</figcaption></figure>"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("only", nargs="*", metavar="AIRLINE[/id]", help="schemes whose id starts with this")
    only: list[str] = parser.parse_args().only

    OUT.mkdir(parents=True, exist_ok=True)
    files = livery_paths()
    if only:
        files = [f for f in files if any(f"{f.parent.name}/{f.stem}".startswith(a) for a in only)]
    cards = []
    for f in files:
        d = load_livery(f)
        if "fuselage" not in d:
            continue  # described in words, not drawn yet
        name = f"{d['airline']}-{d['id']}"
        (OUT / f"{name}.svg").write_text(render(d))
        cards.append(card(name, d))
    (OUT / "index.html").write_text(
        '<!doctype html><meta charset="utf-8"><title>Livery previews</title>'
        "<style>body{font:14px -apple-system,sans-serif;margin:24px;background:#fff}figure{margin:0 0 32px}"
        "figcaption{max-width:900px;color:#333;margin-top:6px}</style>" + "".join(cards)
    )
    print(f"{len(cards)} previews → {OUT / 'index.html'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
