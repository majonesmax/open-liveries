"""A compact file of the measured shapes (shapes/*.json, docs/SHAPES.md) for apps that build their own models: every
line thinned to the points it needs to stay within 2 cm (1 cm on small parts) and every number in whole centimeters,
each line a flat list [a0, b0, a1, b1, ...] in the shape's own axes and order. What a 3D model needs (the fuselage,
an upper deck, fin, wings, tailplane, wingtip devices, engines with their pylons, propellers and tail ducts, the
cabin's windows and doors, the cockpit's panes); not the sources, checks or notes, which stay in the shapes.

    {"source", "units": "cm",
     "types": {designator: [shape id, ...]},          the designator's own shape first (docs/SHAPES.md)
     "shapes": {id: {
        "L": length, "crown", "belly": [x, z, ...], "half": [x, y, ...], "widest": z,
        "hump": {"crown": [x, z, ...], "w": width, "section": [y, z, ...]},
        "fin": {"le", "te", "fillet", "rudder": [x, z, ...]},          rudder: its hinge line
        "wing", "stab": {"le", "te": [y, x, ...], "z": [y, z, ...], "fin": 1 on a T-tail,
                         "fair": [[y, front, back, depth, width], ...] a wing's flap track fairings},
        "tip": {"kind", "le", "te": [x, z, ...], "front": [y, z, ...]},
        "eng": [{"x": [lip, exhaust], "cowl", "y", "top", "bot": [x, z, ...], "m": "fuselage" | "tail" (else wing),
                 "duct": "s", "half": [x, y, ...], "inlet": [z, width, height], "strut": [x, x],
                 "nozzle": {"top", "bot"}, "pylon": {"le", "te": [y, x, ...], "z": [y, z, ...], "t": thickness},
                 "prop": {"x", "z", "d", "n", "spinner": [tip x, base x, diameter]}}],
        "win", "win2": {"z": [bottom, top], "w": width, "x": [...], "wb": [first, last] where a freighter's would be},
                                                                        win2 the upper deck's row
        "doors": [[x0, x1, z0, z1, kind, side?], ...],                 kind d door, e exit, c cargo; side l or r
        "cockpit": [[x, z, ...], ...]}}}

Usage: .venv/bin/python -I tools/export_shapes.py OUT.json"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, load_json, thin

SHAPES = ROOT / "shapes"
LINE = 0.02  # how far a thinned line may stray, meters: well under a pixel on a phone's largest drawn plane
SMALL = 0.01  # on small parts (wingtips, cockpit panes, propellers' spinners, inlets)

Line = list[list[float]]


def cm(v: float) -> int:
    return round(v * 100)


def flat(line: Line, tolerance: float = LINE) -> list[int]:
    """A line thinned and flattened to whole centimeters: [a0, b0, a1, b1, ...]."""
    points = thin([(float(a), float(b)) for a, b in line], tolerance)
    out: list[int] = []
    for a, b in points:
        out += [cm(a), cm(b)]
    return out


def surface(part: dict[str, Any], fin_mounted: bool = False) -> dict[str, Any]:
    """A wing or tailplane: its edges from above, its middle height from the front."""
    out: dict[str, Any] = {"le": flat(part["leading"]), "te": flat(part["trailing"]), "z": flat(part["z"])}
    if fin_mounted:
        out["fin"] = 1
    if part.get("fairings"):  # a wing's flap track fairings: [y, front, back, depth] each
        out["fair"] = [
            [cm(f["y"]), cm(f["x"][0]), cm(f["x"][1]), cm(f["depth"]), cm(f.get("width", f["depth"]))]
            for f in part["fairings"]
        ]
    return out


def engine(e: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {
        "x": [cm(e["x"][0]), cm(e["x"][1])],
        "y": cm(e.get("y", 0)),
        "top": flat(e["top"]),
        "bot": flat(e["bottom"]),
    }
    if "cowlEnd" in e:
        out["cowl"] = cm(e["cowlEnd"])
    if e.get("mount", "wing") != "wing":
        out["m"] = e["mount"]
    if e.get("duct") == "s":
        out["duct"] = "s"
    if e.get("halfWidth"):
        out["half"] = flat(e["halfWidth"], SMALL)
    if e.get("inlet"):
        inlet = e["inlet"]
        out["inlet"] = [cm(inlet["z"]), cm(inlet["width"]), cm(inlet["height"])]
    if e.get("strut"):
        out["strut"] = [cm(x) for x in e["strut"]]
    if e.get("nozzle"):
        out["nozzle"] = {"top": flat(e["nozzle"]["top"], SMALL), "bot": flat(e["nozzle"]["bottom"], SMALL)}
    if e.get("pylon"):
        p = e["pylon"]
        out["pylon"] = {
            "le": flat(p["leading"], SMALL),
            "te": flat(p["trailing"], SMALL),
            "z": flat(p["z"], SMALL),
            "t": cm(p["thickness"]),
        }
    if e.get("propeller"):
        p = e["propeller"]
        prop: dict[str, Any] = {"x": cm(p["x"]), "z": cm(p["z"]), "d": cm(p["diameter"]), "n": p["blades"]}
        if p.get("spinner"):
            s = p["spinner"]
            prop["spinner"] = [cm(s["x"][0]), cm(s["x"][1]), cm(s["diameter"])]
        out["prop"] = prop
    return out


def windows(row: dict[str, Any]) -> dict[str, Any]:
    out = {"z": [cm(row["z"][0]), cm(row["z"][1])], "w": cm(row["width"]), "x": [cm(x) for x in row["x"]]}
    if "wouldBe" in row:  # a freighter: where its passenger version's first and last are
        out["wb"] = [cm(row["wouldBe"][0]), cm(row["wouldBe"][1])]
    return out


DOOR_KINDS = {"door": "d", "exit": "e", "cargo": "c"}


def compact(shape: dict[str, Any]) -> dict[str, Any]:
    """One shape in the compact form."""
    fuselage = shape["fuselage"]
    out: dict[str, Any] = {
        "L": cm(fuselage["length"]),
        "crown": flat(fuselage["crown"]),
        "belly": flat(fuselage["belly"]),
        "half": flat(fuselage["halfWidth"]),
    }
    if "widest" in fuselage:
        out["widest"] = cm(fuselage["widest"])
    if fuselage.get("hump"):
        hump = fuselage["hump"]
        out["hump"] = {"crown": flat(hump["crown"]), "w": cm(hump["width"])}
        if hump.get("section"):
            out["hump"]["section"] = flat(hump["section"], SMALL)
    fin = shape["fin"]
    out["fin"] = {"le": flat(fin["leading"]), "te": flat(fin["trailing"])}
    if fin.get("fillet"):
        out["fin"]["fillet"] = flat(fin["fillet"])
    if fin.get("rudder"):
        out["fin"]["rudder"] = flat(fin["rudder"])
    out["wing"] = surface(shape["wing"])
    stabilizer = shape["stabilizer"]
    out["stab"] = surface(stabilizer, stabilizer.get("mount") == "fin")
    if shape.get("wingtip"):
        tip = shape["wingtip"]
        out["tip"] = {"kind": tip["kind"], "le": flat(tip["leading"], SMALL), "te": flat(tip["trailing"], SMALL)}
        if tip.get("front"):
            out["tip"]["front"] = flat(tip["front"], SMALL)
    out["eng"] = [engine(e) for e in shape["engines"]]
    cabin = shape.get("cabin", {})
    if cabin.get("windows"):
        out["win"] = windows(cabin["windows"])
    if cabin.get("upperWindows"):
        out["win2"] = windows(cabin["upperWindows"])
    doors = []
    for door in cabin.get("doors", []):
        entry: list[Any] = [*(cm(x) for x in door["x"]), *(cm(z) for z in door["z"]), DOOR_KINDS.get(door["kind"], "d")]
        if door.get("side") in ("left", "right"):
            entry.append(door["side"][0])
        doors.append(entry)
    if doors:
        out["doors"] = doors
    panes = shape.get("cockpit", {}).get("windows", [])
    if panes:
        out["cockpit"] = [flat([*pane, pane[0]], SMALL)[:-2] for pane in panes]
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("out", help="the compact JSON to write")
    out_path = Path(parser.parse_args().out)

    shapes: dict[str, Any] = {}
    types: dict[str, list[str]] = {}
    for path in sorted(SHAPES.glob("*.json")):
        shape = load_json(path)
        shapes[shape["id"]] = compact(shape)
        for designator in shape["types"]:
            types.setdefault(designator, []).append(shape["id"])
    # The designator's own shape (the one whose id it is) first: the one a scheme measured on it means.
    for designator, ids in types.items():
        ids.sort(key=lambda i: (i != designator, i))

    out = {
        "source": "https://github.com/majonesmax/open-liveries (CC0)",
        "units": "cm",
        "types": types,
        "shapes": shapes,
    }
    out_path.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    size = out_path.stat().st_size / 1024
    print(f"{len(shapes)} shapes serving {len(types)} designators → {out_path} ({size:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
