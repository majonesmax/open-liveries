"""A file for apps that draw with the renderer itself (renderer/, `renderSide`): the same schemes as the compact
export (tools/export_compact.py: each airline's default, the specials, the regular schemes tagged by airframe), keyed
the same way, with past airlines' schemes among `liveries` (asked for by ref only), but whole, as the renderer reads
them: only what it doesn't draw is left out (sources, notes, descriptions, confidence, an area's or a title's words).
Pair it with the compact shapes (tools/export_shapes.py); the app turns a compact shape back into a measured one
(`shapes/<type>.json`'s fields) for the renderer.

    {"source", "liveries": {"AAL/eagle": scheme, ...}, "airlines": {"DAL": scheme, ...}}

Which airframe wears which scheme is the compact export's (`hex`, `registration`, `operators`); not repeated here.

Usage: .venv/bin/python -I tools/export_render.py OUT.json"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import load_operators, operator_scheme, select_schemes
from shapes import Livery

# Words for people and the research trail: never drawn.
DROP = {
    "$schema",
    "sources",
    "sourceRefs",
    "notes",
    "note",
    "description",
    "history",
    "reference",
    "confidence",
    "official",
    "style",
    "pantone",
    "ral",
    "commemorates",
    "evidence",
}


def stripped(value: Any, key: str = "") -> Any:
    """The scheme without what the renderer doesn't read; an area's `name` too (a description, not drawn)."""
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            if k in DROP or (k == "name" and key in ("areas", "palette")):
                continue
            out[k] = stripped(v, k)
        return out
    if isinstance(value, list):
        return [stripped(v, key) for v in value]
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("out", help="the JSON to write")
    out_path = Path(parser.parse_args().out)

    # The compact export's choice of schemes, with past airlines' among them: an app asks for those by ref only.
    chosen = select_schemes()
    liveries: dict[str, Livery] = {**chosen.liveries, **chosen.past}
    airlines = chosen.airlines
    for code in load_operators():
        worn, scheme = operator_scheme(code)
        if scheme is not None:
            liveries.setdefault(worn, scheme)

    out = {
        "source": "https://github.com/majonesmax/open-liveries (CC0)",
        "liveries": {k: stripped(v) for k, v in sorted(liveries.items())},
        "airlines": {k: stripped(v) for k, v in sorted(airlines.items())},
    }
    out_path.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False) + "\n")
    size = out_path.stat().st_size / 1024
    print(f"{len(liveries)} schemes and {len(airlines)} airlines' own → {out_path} ({size:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
