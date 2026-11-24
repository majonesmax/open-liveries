"""Write index.json at the repo root: one line per scheme (id, airline, name, kind, confidence, dates, its first
fuselage title, whether it's drawn, whether it's its airline's default, how many current airframes wear it),
plus the airlines' names (airlines.json), the operators map, the airframe files, current registrations, per
airline the other airlines' schemes its tagged jets fly in (Sun Country's freighters in Prime Air paint), and the
measured shapes (shapes/) with the types they're for. For
static sites (examples/svg-viewer) that can't list folders: they load index.json first, then each scheme's JSON
as it's needed.

  .venv/bin/python -I tools/index.py
"""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import cast

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (
    ROOT,
    airframe_paths,
    livery_paths,
    livery_ref,
    load_airframes,
    load_json,
    load_livery,
    load_operators,
)
from shapes import AirlinesFile, Livery


def is_drawn(livery: Livery) -> bool:
    return "fuselage" in livery or bool((livery.get("fin") or {}).get("areas"))


def scheme_line(livery: Livery) -> dict[str, object]:
    """A scheme's line, in index.json's key order (None for what it hasn't, dropped when written)."""
    return {
        "id": f"{livery['airline']}/{livery['id']}",
        "airline": livery["airline"],
        "name": livery["name"],
        "kind": livery["kind"],
        "confidence": livery["confidence"],
        "from": livery.get("from"),
        "to": livery.get("to"),
        "commonest": livery.get("commonest", False),
        "drawn": is_drawn(livery),
        "drawnOn": livery.get("drawnOn"),
        # Not an airline name (that's airlines.json): the first fuselage title, a hint for search and lists.
        "title": next((t["text"] for t in livery.get("titles", []) if t["place"] == "fuselage"), None),
    }


def defaults(schemes: list[dict[str, object]]) -> dict[str, str]:
    """docs/COORDINATES.md, The airline's default scheme: the current standard-kind scheme marked commonest,
    else the one whose id is 'standard'."""
    by_airline: dict[str, list[dict[str, object]]] = {}
    for scheme in schemes:
        by_airline.setdefault(str(scheme["airline"]), []).append(scheme)
    out = {}
    for airline, theirs in by_airline.items():
        current = [s for s in theirs if s["kind"] == "standard" and not s.get("to")]
        pick = next((s for s in current if s.get("commonest")), None)
        pick = pick or next((s for s in theirs if str(s["id"]).split("/")[1] == "standard"), None)
        if pick:
            out[airline] = str(pick["id"])
    return out


def main() -> int:
    argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()

    schemes = [scheme_line(load_livery(path)) for path in livery_paths()]

    wearing: Counter[str] = Counter()
    also_flies: dict[str, Counter[str]] = {}
    registrations: dict[str, str] = {}
    files = []
    for path in airframe_paths():
        airframes = load_airframes(path)
        files.append(path.stem)
        for airframe in airframes["airframes"]:
            if airframe.get("to"):
                continue
            ref = livery_ref(airframes["airline"], airframe["livery"])
            wearing[ref] += 1
            if not ref.startswith(airframes["airline"] + "/"):
                also_flies.setdefault(airframes["airline"], Counter())[ref] += 1
            registrations[airframe["registration"]] = ref

    default = defaults(schemes)
    for scheme in schemes:
        scheme["default"] = default.get(str(scheme["airline"])) == scheme["id"]
        scheme["airframes"] = wearing[str(scheme["id"])]

    index = {
        "schemes": [{k: v for k, v in s.items() if v is not None} for s in schemes],
        "airlines": cast(AirlinesFile, load_json(ROOT / "airlines.json"))["airlines"],
        "operators": load_operators(),
        "airframeFiles": files,
        "registrations": dict(sorted(registrations.items())),
        # The measured types in shapes/, for drawing a scheme on the type it was measured on (`drawnOn`).
        "shapes": [
            {"id": s["id"], "name": s["name"], "types": s["types"]}
            for s in (load_json(path) for path in sorted((ROOT / "shapes").glob("*.json")))
        ],
        # Most-flown first: [{"scheme": "ATN/prime-air-blue", "airframes": 8}, ...].
        "alsoFlies": {
            airline: [{"scheme": ref, "airframes": n} for ref, n in sorted(refs.items(), key=lambda r: (-r[1], r[0]))]
            for airline, refs in sorted(also_flies.items())
        },
    }
    (ROOT / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(
        f"index.json: {len(schemes)} schemes, {len(default)} airline defaults, "
        f"{len(registrations)} current registrations"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
