"""A compact file for apps: every drawn livery with its colors resolved to hex and its `below`/`above`
lines turned into polygons, and the airframes wearing one now, by ICAO address and by registration.
A scheme's paint for one type (`types`, docs/COORDINATES.md) comes along as `types`: for each key (a shape's id or
an ICAO designator), the compact keys that differ on it, the entry laid over the scheme's paint (`paint_for`) and
compacted the same way; an app drawing on a measured shape (tools/export_shapes.py) takes the shape's id's entry,
else its designator's, over the scheme's own keys. `on` is the measured shape a scheme was drawn on (its `drawnOn`,
a type designator, when shapes/ has that type), so an app can tell a freighter's scheme (drawn on a shape without
cabin windows) and pick that variant of a type with two (the 747-8F or the 747-8I).
`operators` maps a callsign flying in another airline's paint to that airline's code (its default scheme in
`airlines`), or to a scheme's ref in `liveries` when it flies a drawn variant of it (Envoy: "AAL/eagle").
Usage: .venv/bin/python -I tools/export_compact.py OUT.json"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (
    ROOT,
    airframe_paths,
    area_polygon,
    ceased_airlines,
    fuselage_polygon,
    load_airframes,
    load_operators,
    operator_scheme,
    paint_for,
    resolve_color,
    select_schemes,
    thin,
)
from shapes import Area, Livery

# The compact form is for apps, keyed short; its entries are plain dicts.
Compact = dict[str, Any]

RUDDER = [[0.72, 0], [1, 0], [1, 1], [0.72, 1]]  # x from 0.72 aft, the full height


def areas(livery: Livery, items: list[Area] | None, lo: float, hi: float, fuselage: bool = False) -> list[Compact]:
    """Each area as {c: hex, p: polygon rounded to 4 places, s: side if only one}. Polygons are the smooth
    outlines docs/COORDINATES.md describes, already curved and thinned, so an app draws straight lines between
    the points."""
    out = []
    for area in items or []:
        # The fuselage's edges run straight as seen from the side: pointed along and thinned like a curve.
        polygon = fuselage_polygon(area, lo, hi) if fuselage else area_polygon(area, lo, hi)
        entry: Compact = {
            "c": resolve_color(livery, area["color"]),
            "p": [[round(x, 4), round(y, 4)] for x, y in thin([*polygon, polygon[0]])[:-1]],
        }
        if area.get("side", "both") != "both":
            entry["s"] = area["side"]
        out.append(entry)
    return out


def titles(livery: Livery) -> list[Compact]:
    """The titles on the fuselage and fin (the parts an app draws)."""
    out = []
    for title in livery.get("titles", []):
        if title["place"] not in ("fuselage", "fin"):
            continue
        lettering = title.get("type", {})
        entry: Compact = {
            "t": title["text"],
            "on": title["place"],
            "at": title["at"],
            "h": title["height"],
            "c": resolve_color(livery, title["color"]),
            "slant": lettering.get("slantDeg", 0),
            "weight": lettering.get("weight", 700),
            "fonts": lettering.get("similar", []),
        }
        if "parts" in title:
            entry["parts"] = [{"t": p["text"], "c": resolve_color(livery, p["color"])} for p in title["parts"]]
        if title.get("length"):
            entry["len"] = title["length"]
        if title.get("rotationDeg"):
            entry["rot"] = title["rotationDeg"]
        if title.get("mark"):
            entry["mark"] = title["mark"]
        if title.get("registration"):
            entry["reg"] = True  # the aircraft's own number goes here: an app letters its registration instead
        if title.get("side", "both") != "both":
            entry["s"] = title["side"]
        out.append(entry)
    return out


def logos(livery: Livery) -> list[Compact]:
    """The logos on the fuselage and fin: where, how tall and their colors (not the artwork)."""
    out = []
    for logo in livery.get("logos", []):
        if logo["place"] not in ("fuselage", "fin"):
            continue
        entry: Compact = {
            "m": logo["mark"],
            "on": logo["place"],
            "at": logo["at"],
            "h": logo["height"],
            "cs": [resolve_color(livery, c) for c in logo.get("colors", [])],
        }
        if logo.get("side", "both") != "both":
            entry["s"] = logo["side"]
        if logo.get("licensed"):
            entry["lic"] = logo["licensed"]  # whose artwork it is (docs/LOGOS.md, Licensed artwork)
        out.append(entry)
    return out


SHAPE_IDS = {path.stem for path in (ROOT / "shapes").glob("*.json")}


def compact(livery: Livery) -> Compact:
    """One scheme in the compact form, with its paint for one type (`types`) and the shape it was drawn on (`on`)."""
    out = compact_paint(livery)
    if livery.get("drawnOn") in SHAPE_IDS:
        out["on"] = livery["drawnOn"]
    types: dict[str, Compact] = {}
    for key in livery.get("types", {}):
        on_type = compact_paint(paint_for(livery, key))
        differs = {k: v for k, v in on_type.items() if out.get(k) != v}
        if differs:
            types[key] = differs
    if types:
        out["types"] = types
    return out


def compact_paint(livery: Livery) -> Compact:
    """One scheme's paint in the compact form."""
    fuselage, fin = livery["fuselage"], livery.get("fin", {})
    out: Compact = {
        "name": livery["name"],
        "kind": livery["kind"],
        "body": resolve_color(livery, fuselage["base"]),
        "bodyAreas": areas(livery, fuselage.get("areas"), -1, 1, fuselage=True),
    }
    if fuselage.get("radome"):
        radome = fuselage["radome"]
        out["radome"] = {"c": resolve_color(livery, radome["color"]), "to": radome.get("to", 0.025)}
    if fin:
        out["fin"] = resolve_color(livery, fin.get("base")) or out["body"]
        out["finAreas"] = areas(livery, fin.get("areas"), 0, 1)
        if fin.get("rudder"):
            out["finAreas"].insert(0, {"c": resolve_color(livery, fin["rudder"]), "p": RUDDER})
    if found := titles(livery):
        out["titles"] = found
    if found := logos(livery):
        out["logos"] = found
    wings = livery.get("wings", {})
    single = {
        "engine": livery.get("engines", {}).get("cowling"),
        "wing": wings.get("top"),
        "wingUnder": wings.get("under"),
        "winglet": livery.get("winglets", {}).get("outer"),
    }
    for key, name in single.items():
        color = resolve_color(livery, name)
        if color:
            out[key] = color
    return out


def art_by_key() -> dict[str, dict[str, Any]]:
    """Per-jet artwork within a scheme (Frontier's tail animals): by address and registration."""
    art: dict[str, dict[str, Any]] = {}
    for path in airframe_paths():
        for airframe in load_airframes(path)["airframes"]:
            if not airframe.get("art") or airframe.get("to"):
                continue
            fields: dict[str, Any] = dict(airframe["art"])
            entry = {k: fields[k] for k in ("name", "subject", "family", "colors") if fields.get(k)}
            for key in (airframe.get("hex"), airframe["registration"]):
                if key:
                    art[key] = entry
    return art


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("out", help="the compact JSON to write")
    out_path = Path(parser.parse_args().out)

    names = json.loads((ROOT / "airlines.json").read_text())["airlines"]
    ceased = ceased_airlines()
    chosen = select_schemes()
    airlines = {code: compact(livery) for code, livery in chosen.airlines.items()}
    liveries = {ref: compact(livery) for ref, livery in chosen.liveries.items()}
    # Past airlines' schemes, by ref only, for an app's ghost flights to ask for by name: never in `liveries`, `hex`,
    # `registration` or `airlines`, so no live plane is matched to one.
    past = {ref: compact(livery) for ref, livery in chosen.past.items()}
    by_hex, by_reg = chosen.by_hex, chosen.by_reg

    # An operator in another's paint: its parent's code, or a regional brand's scheme by its ref (Envoy flies
    # American Eagle's, not American's own).
    operators = {}
    for code in load_operators():
        worn, scheme = operator_scheme(code)
        if scheme is not None:
            liveries.setdefault(worn, compact(scheme))
            operators[code] = worn
        elif worn in airlines:
            operators[code] = worn

    out = {
        "source": "https://github.com/majonesmax/open-liveries (CC0)",
        "liveries": liveries,
        "hex": by_hex,
        "registration": by_reg,
        "airlines": airlines,
        "operators": operators,
        "art": art_by_key(),
        "past": past,
        # Each airline's name by its ICAO code, for an app whose other sources lag where a code changed hands
        # (adsbdb named SkyAlps's SWU "Swiss European Air Lines", Aeroitalia's AEZ "Aerial Transit Company").
        "names": {code: a["name"] for code, a in sorted(names.items()) if a.get("name") and code not in ceased},
    }
    out_path.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    print(
        f"{len(liveries)} specials, {len(by_hex)} by address, {len(by_reg)} by registration, "
        f"{len(airlines)} airlines' schemes (+{len(operators)} operators in them) → {out_path} "
        f"({out_path.stat().st_size // 1024} KB)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
