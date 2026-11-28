"""Check every livery, airframe and shape file: the JSON Schemas, then what a schema can't say (palette names,
source indexes, ids matching file names, airframes pointing at liveries that exist, dates in order).
Usage: .venv/bin/python -I tools/validate.py  (exit 1 on any problem)."""

import argparse
import json
import math
import re
import sys
import urllib.parse
from collections.abc import Iterator
from itertools import pairwise
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

sys.path.insert(0, str(Path(__file__).resolve().parent))
import nnumber
from common import ROOT, airframe_paths, livery_paths, livery_ref, load_json

# Keys whose string value is a color (a palette name or "#RRGGBB"), anywhere in a scheme's parts.
COLOR_KEYS = ("color", "base", "rudder", "top", "under", "outer", "inner", "cowling", "inletLip", "pylon", "mask")
PARTS = ("fuselage", "fin", "stabilizer", "wings", "winglets", "engines", "logos", "titles")


def schema(name: str) -> Draft202012Validator:
    return Draft202012Validator(load_json(ROOT / "schema" / name))


def schema_problems(validator: Draft202012Validator, data: object, where: str) -> list[str]:
    """Each schema error as "where: path/in/file: message" (the message cut to 200 characters)."""
    return [
        f"{where}: {'/'.join(map(str, e.absolute_path)) or '(top)'}: {e.message[:200]}"
        for e in validator.iter_errors(data)
    ]


def _colors_under(value: object, path: str) -> Iterator[tuple[str, str]]:
    if isinstance(value, dict):
        for k, x in value.items():
            if k in COLOR_KEYS and isinstance(x, str):
                yield f"{path}.{k}", x
            if k == "colors" and isinstance(x, list):
                for i, c in enumerate(x):
                    yield f"{path}.colors[{i}]", c
            if k == "gradient" and isinstance(x, dict):
                for i, stop in enumerate(x.get("stops", [])):
                    if isinstance(stop, list) and len(stop) == 2 and isinstance(stop[1], str):
                        yield f"{path}.gradient.stops[{i}]", stop[1]
            yield from _colors_under(x, f"{path}.{k}")
    elif isinstance(value, list):
        for i, x in enumerate(value):
            yield from _colors_under(x, f"{path}[{i}]")


def colors_in(livery: dict[str, Any]) -> Iterator[tuple[str, str]]:
    """Every color reference in a livery, with where it is."""
    for part in PARTS:
        if part in livery:
            if part in ("fuselage", "fin") and isinstance(livery[part].get("base"), str):
                yield f"{part}.base", livery[part]["base"]
            yield from _colors_under(livery[part], part)


def source_refs_in(value: object, path: str = "") -> Iterator[tuple[str, int]]:
    """Every `sourceRefs` index, with where it is."""
    if isinstance(value, dict):
        for k, x in value.items():
            if k == "sourceRefs":
                for i in x:
                    yield path, i
            else:
                yield from source_refs_in(x, f"{path}.{k}")
    elif isinstance(value, list):
        for i, x in enumerate(value):
            yield from source_refs_in(x, f"{path}[{i}]")


def gradient_problems(value: object, path: str = "") -> Iterator[str]:
    """Gradients whose stops go backwards or whose line has no length (docs/COORDINATES.md › Gradients)."""
    if isinstance(value, dict):
        g = value.get("gradient")
        if isinstance(g, dict):
            offsets = [s[0] for s in g.get("stops", []) if isinstance(s, list) and s]
            if any(b < a for a, b in pairwise(offsets)):
                yield f"{path}.gradient: its stops' offsets must ascend"
            a, b = g.get("from"), g.get("to")
            if isinstance(a, list) and a == b:
                yield f"{path}.gradient: 'from' and 'to' are the same point"
        for k, x in value.items():
            yield from gradient_problems(x, f"{path}.{k}" if path else k)
    elif isinstance(value, list):
        for i, x in enumerate(value):
            yield from gradient_problems(x, f"{path}[{i}]")


def title_problems(titles: list[Any]) -> list[str]:
    """Titles whose `parts` don't spell their text."""
    return [
        f"titles[{i}]: its parts don't spell '{title.get('text')}'"
        for i, title in enumerate(titles)
        if title.get("parts") and "".join(p.get("text", "") for p in title["parts"]) != title.get("text")
    ]


def type_problems(livery: dict[str, Any], key: str, paint: dict[str, Any], shape_ids: set[str]) -> list[str]:
    """A `types` entry (docs/COORDINATES.md, Paint for one type): keyed by a shape in shapes/, its colors in the
    palette it's drawn with (the scheme's and its own), its titles spelled, and a part the scheme leaves out given
    whole (a fuselage or fin needs its `base`)."""
    problems = []
    if key not in shape_ids:
        problems.append(f"no shapes/{key}.json to measure it on")
    palette = {**livery.get("palette", {}), **paint.get("palette", {})}
    for where, c in colors_in(paint):
        if not c.startswith("#") and c not in palette:
            problems.append(f"{where}: '{c}' isn't in the palette")
    problems += title_problems(paint.get("titles", []))
    for part in ("fuselage", "fin"):
        if part in paint and part not in livery and "base" not in paint[part]:
            problems.append(f"{part}: the scheme has none, so this one needs its base")
    return problems


# Sites whose photos are copyrighted or not openly licensed: evidence that a scheme exists on a jet, never what a
# part is measured from (a part's `sourceRefs`). Measure from openly licensed photos (Wikimedia Commons), the
# airline's own press images, or your own.
EVIDENCE_ONLY = (
    "jetphotos.com",
    "airliners.net",
    "planespotters.net",
    "airportspotting.com",
    "airhistory.net",
    "planecaptures.com",
    "lockonaviation.net",
    "flickr.com",
    "reddit.com",
    "facebook.com",
    "bsky.app",
    "instagram.com",
    "x.com",
    "twitter.com",
)


def evidence_only(url: str) -> bool:
    host = urllib.parse.urlparse(url).hostname or ""
    return any(host == site or host.endswith("." + site) for site in EVIDENCE_ONLY)


def check_operators(ids: set[str]) -> list[str]:
    """operators.json: its schema, and each operator's scheme existing."""
    operators = load_json(ROOT / "operators.json")
    problems = schema_problems(schema("operators.schema.json"), operators, "operators.json")
    for code, operator in operators.items():
        if operator.get("wears") not in ids:
            problems.append(f"operators.json: {code} wears {operator.get('wears')}, which isn't a scheme here")
    return problems


def check_leads() -> list[str]:
    """leads.tsv: its header, five columns a row, and an ICAO code (or nothing) for the airline."""
    lines = (ROOT / "leads.tsv").read_text().splitlines()
    problems = []
    if not lines or lines[0].split("\t") != ["airline", "type", "registration", "livery", "seen in"]:
        problems.append("leads.tsv: the header should be airline, type, registration, livery, seen in")
    for n, line in enumerate(lines[1:], 2):
        cols = line.split("\t")
        if len(cols) != 5:
            problems.append(f"leads.tsv:{n}: {len(cols)} columns, not 5")
        elif cols[0] and not re.fullmatch(r"[A-Z0-9]{3,6}", cols[0]):
            problems.append(f"leads.tsv:{n}: airline '{cols[0]}' isn't an ICAO code")
        elif not cols[3]:
            problems.append(f"leads.tsv:{n}: no livery named")
    return problems


def check_livery(
    path: Path, livery_schema: Draft202012Validator, airlines: dict[str, Any], shape_ids: set[str]
) -> tuple[list[str], str | None]:
    """What's wrong with one scheme file (nothing if it's fine), and its "airline/id" (None if it isn't JSON)."""
    rel = path.relative_to(ROOT)
    try:
        d = load_json(path)
    except json.JSONDecodeError as e:
        return [f"{rel}: not JSON ({e})"], None
    problems = schema_problems(livery_schema, d, str(rel))
    if d.get("airline") != path.parent.name or d.get("id") != path.stem:
        problems.append(f"{rel}: airline/id must match the folder and file name ({d.get('airline')}/{d.get('id')})")
    palette = d.get("palette", {})
    for where, c in colors_in(d):
        if not c.startswith("#") and c not in palette:
            problems.append(f"{rel}: {where}: '{c}' isn't in the palette")
    for key, paint in d.get("types", {}).items():
        problems += [f"{rel}: types.{key}: {p}" for p in type_problems(d, key, paint, shape_ids)]
    sources = d.get("sources", [])
    for where, i in source_refs_in(d):
        if i >= len(sources):
            problems.append(f"{rel}: {where}: source {i} doesn't exist ({len(sources)} sources)")
        elif evidence_only(sources[i].get("url", "")):
            problems.append(
                f"{rel}: {where}: measured from {sources[i]['url']}, which is evidence only (CONTRIBUTING.md)"
            )
    problems += [f"{rel}: {p}" for p in title_problems(d.get("titles", []))]
    problems += [f"{rel}: {p}" for p in gradient_problems({k: d[k] for k in (*PARTS, "types") if k in d})]
    if d.get("from") and d.get("to") and d["to"] < d["from"]:
        problems.append(f"{rel}: 'to' is before 'from'")
    if d.get("airline") not in airlines.get("airlines", {}):
        problems.append(f"{rel}: airline {d.get('airline')} isn't in airlines.json")
    return problems, f"{d.get('airline')}/{d.get('id')}"


def check_airframes(
    path: Path, airframes_schema: Draft202012Validator, ids: set[str], current: dict[str, str]
) -> list[str]:
    """What's wrong with one airframe file. `current` (registration → the file listing it with no end date)
    is shared across files, so a jet current in a mainline's file and a regional's is caught."""
    rel = path.relative_to(ROOT)
    d = load_json(path)
    problems = schema_problems(airframes_schema, d, str(rel))
    if d.get("airline") != path.stem:
        problems.append(f"{rel}: airline must match the file name")
    seen: set[str] = set()
    for a in d.get("airframes", []):
        reg = a["registration"]
        ref = livery_ref(d["airline"], a["livery"])
        if ref not in ids:
            problems.append(f"{rel}: {reg}: no livery {ref}")
        derived = nnumber.icao(reg)
        if derived and a.get("hex") and a["hex"] != derived:
            problems.append(f"{rel}: {reg}: hex {a['hex']} but an N-number's is {derived}")
        if a.get("to") and a["to"] < a["from"]:
            problems.append(f"{rel}: {reg}: 'to' is before 'from'")
        if not a.get("to"):
            if reg in seen:
                problems.append(f"{rel}: {reg}: two current liveries")
            seen.add(reg)
            other = current.setdefault(reg, str(rel))
            if other != str(rel):
                problems.append(f"{rel}: {reg}: also current in {other}")
    return problems


def notches(
    line: list[list[float]], outward: int, reach: float = 1.5, depth: float = 0.05
) -> list[tuple[float, float]]:
    """Points on a fuselage outline sitting further in than the outline both ahead and behind within `reach` meters:
    a dip a real fuselage doesn't have (a landing-gear bay, or a wingtip or fin traced into the line). The nose tip
    and the last 8% (the tail cone, where the fin's fairings meet the line and it closes) are left out."""
    found: list[tuple[float, float]] = []
    length = line[-1][0]
    for x, y in line:
        if x < 0.05 or x > 0.92 * length:
            continue
        ahead = [outward * q[1] for q in line if x - reach <= q[0] < x and q[0] >= 0.05]
        behind = [outward * q[1] for q in line if x < q[0] <= x + reach]
        if ahead and behind:
            dip = min(max(ahead), max(behind)) - outward * y
            if dip > depth and (not found or x - found[-1][0] > reach):
                found.append((x, round(dip, 2)))
    return found


def windshield_gap(shape: dict[str, Any]) -> float:
    """How far short of the crown the cockpit's glass stops, in the fuselage texture's units (its height share from
    the crown, 1 being from the crown to the widest line): the left and right windshields meet across the crown at 0.
    The outline's top is the crown, or over an upper deck the deck's (docs/SHAPES.md, Cockpit)."""
    fuselage = shape["fuselage"]
    crown, belly = sorted(fuselage["crown"]), sorted(fuselage["belly"])
    deck = sorted(fuselage["hump"]["crown"]) if "hump" in fuselage else []

    def at(line: list[list[float]], x: float) -> float:
        for (x0, z0), (x1, z1) in pairwise(line):
            if x0 <= x <= x1:
                return z0 + (z1 - z0) * (x - x0) / ((x1 - x0) or 1)
        return line[0][1] if x < line[0][0] else line[-1][1]

    best = -1.0
    for pane in shape["cockpit"]["windows"]:
        for x, z in pane:
            top = max(at(crown, x), at(deck, x) if deck and deck[0][0] <= x <= deck[-1][0] else -1e9)
            bottom = at(belly, x)
            r = (top - bottom) / 2 or 1
            best = max(best, math.asin(max(-1.0, min(1.0, (z - (top + bottom) / 2) / r))) * 2 / math.pi)
    return 1 - best


def gear_problems(shape: dict[str, Any], where: str) -> list[str]:
    """The landing gear (docs/SHAPES.md, Gear): nose first, along the fuselage, below the belly, a main leg under the
    wing it hangs from, and the wheels a leg says it has spaced as it says."""
    gear = shape.get("gear")
    if not gear:
        return []
    problems: list[str] = []
    fuselage, legs = shape["fuselage"], gear["legs"]
    if legs[0]["kind"] != "nose":
        problems.append(f"{where}: gear.legs should start with the nose gear")
    lowest = min(z for _, z in fuselage["belly"])
    if gear["ground"] >= lowest:
        problems.append(f"{where}: gear.ground ({gear['ground']}) should be below the belly's lowest point ({lowest})")
    span = max(y for y, _ in shape["wing"]["trailing"])
    for k, leg in enumerate(legs):
        if not 0 < leg["x"] < fuselage["length"]:
            problems.append(f"{where}: gear.legs[{k}] at x {leg['x']} isn't along the fuselage")
        if leg["kind"] in ("nose", "center") and leg["y"] != 0:
            problems.append(f"{where}: gear.legs[{k}] ({leg['kind']}) should be on the centerline (y 0)")
        if leg.get("mount", "wing" if leg["kind"] == "main" else "fuselage") == "wing" and not 0 < leg["y"] < span:
            problems.append(f"{where}: gear.legs[{k}] at y {leg['y']} isn't under the wing it hangs from")
        if leg["wheels"] > 1 and "spacing" not in leg:
            problems.append(f"{where}: gear.legs[{k}] has {leg['wheels']} wheels: give their spacing")
        if leg["wheels"] > 2 and "tandem" not in leg:
            problems.append(f"{where}: gear.legs[{k}] is a bogie: give its tandem (axles apart)")
        if leg.get("spacing", 1) <= leg["tire"][1]:
            problems.append(f"{where}: gear.legs[{k}]'s tires overlap (spacing under their width)")
    return problems


def check_shape(path: Path, validator: Draft202012Validator) -> list[str]:
    """A shape file: its schema, its id matching its name, and each line running the way docs/SHAPES.md says."""
    where = str(path.relative_to(ROOT))
    shape = load_json(path)
    problems = schema_problems(validator, shape, where)
    if problems:
        return problems
    if shape["id"] != path.stem:
        problems.append(f"{where}: id {shape['id']!r} doesn't match the file name")
    fuselage = shape["fuselage"]
    for name in ("crown", "belly", "halfWidth"):
        xs = [p[0] for p in fuselage[name]]
        if xs[0] != 0 or abs(xs[-1] - fuselage["length"]) > 0.05:
            problems.append(f"{where}: fuselage.{name} should run from the nose tip (x 0) to the tail cone (x length)")
    for name, outward in (("crown", 1), ("belly", -1)):
        for x, depth in notches(fuselage[name], outward):
            problems.append(f"{where}: fuselage.{name} has a {depth:.2f} m notch at x {x} (a part traced into it?)")
    # Behind the fin's trailing edge only the tail cone is left: its top only falls toward the end.
    crown = fuselage["crown"]
    fin_end = min(p[0] for p in shape["fin"]["trailing"])
    behind = [p for p in crown if p[0] >= fin_end]
    low = behind[0][1] if behind else 0
    for x, z in behind:
        low = min(low, z)
        if z - low > 0.05:
            problems.append(
                f"{where}: fuselage.crown climbs again at x {x}, behind its top (a tailplane traced into it?)"
            )
            break
    # A fin edge starts on its straight run: a curl at its root (a trace's hook) bends the fin's paint off along the
    # fuselage where the renderer carries the edge down to the crown.
    for edge in ("leading", "trailing"):
        line = sorted(shape["fin"][edge], key=lambda p: p[1])
        p, q = line[0], line[1]
        far = next((r for r in line if r[1] - p[1] >= 0.5), None)
        if far and q[1] > p[1]:
            near, run = (q[0] - p[0]) / (q[1] - p[1]), (far[0] - p[0]) / (far[1] - p[1])
            if abs(near - run) > 1:
                problems.append(f"{where}: fin.{edge} hooks at its root (x {p[0]}): start it on the straight run")
    for part in ("wing", "stabilizer"):
        for edge in ("leading", "trailing", "z"):
            ys = [p[0] for p in shape[part][edge]]
            if any(b < a for a, b in pairwise(ys)):
                problems.append(f"{where}: {part}.{edge} should run root to tip (y never falling)")
    hump = fuselage.get("hump")
    if hump and not all(0 <= p[0] <= fuselage["length"] for p in hump["crown"]):
        problems.append(f"{where}: fuselage.hump.crown should lie along the fuselage (x 0 to length)")
    # The windshields meet across the crown at their center post (docs/SHAPES.md, Cockpit): the glass reaches the
    # crown, so the fuselage texture's left and right panes join there.
    if shape["cockpit"]["windows"] and (gap := windshield_gap(shape)) > 0.02:
        problems.append(
            f"{where}: the windshield stops {gap:.3f} short of the crown (the fuselage texture's share): its post"
            " should lie on the outline (tools/trace/windshield.py)"
        )
    # Flap track fairings hang under the wing (docs/SHAPES.md, Wing): within its span, beginning ahead of its trailing
    # edge and ending behind it, hanging below it.
    wing = shape["wing"]
    span = max(p[0] for p in wing["trailing"])
    for k, fairing in enumerate(wing.get("fairings", [])):
        y, (front, back), depth = fairing["y"], fairing["x"], fairing["depth"]
        trailing_x = next(
            (
                x
                for (y0, x0), (y1, x1) in pairwise(wing["trailing"])
                if y0 <= y <= y1
                for x in [x0 + (x1 - x0) * ((y - y0) / (y1 - y0) if y1 != y0 else 0)]
            ),
            None,
        )
        if not 0 < y <= span or trailing_x is None:
            problems.append(f"{where}: wing.fairings[{k}] at y {y} isn't under the wing")
        elif not front < trailing_x < back:
            problems.append(
                f"{where}: wing.fairings[{k}] should run from ahead of the trailing edge"
                f" (x {trailing_x:.2f}) to behind it"
            )
        if depth <= 0:
            problems.append(f"{where}: wing.fairings[{k}] should hang below the wing (depth > 0)")
    problems += gear_problems(shape, where)
    # Several engines a side: inboard first (the side view draws them in that order, the nearer over the farther).
    if any(b["y"] < a["y"] for a, b in pairwise(shape["engines"])):
        problems.append(f"{where}: engines should run inboard first (y rising)")
    return problems


def main() -> int:
    argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    airlines = load_json(ROOT / "airlines.json")
    problems = schema_problems(schema("airlines.schema.json"), airlines, "airlines.json")

    livery_schema = schema("livery.schema.json")
    shape_ids = {path.stem for path in (ROOT / "shapes").glob("*.json")}
    ids = set()
    for path in livery_paths():
        found, livery_id = check_livery(path, livery_schema, airlines, shape_ids)
        problems += found
        if livery_id:
            ids.add(livery_id)

    airframes_schema = schema("airframes.schema.json")
    current: dict[str, str] = {}
    files = airframe_paths()
    for path in files:
        problems += check_airframes(path, airframes_schema, ids, current)

    problems += check_operators(ids)
    problems += check_leads()

    shape_schema = schema("shape.schema.json")
    shapes = sorted((ROOT / "shapes").glob("*.json"))
    for path in shapes:
        problems += check_shape(path, shape_schema)

    for line in problems:
        print(line)
    print(
        f"{len(ids)} liveries, {len(files)} airframe files, {len(shapes)} shapes: "
        + ("ok" if not problems else f"{len(problems)} problems")
    )
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
