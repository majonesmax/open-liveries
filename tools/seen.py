"""Ask adsb.lol (open data, ODbL) whether each current airframe is flying now: confirms its ICAO address and
sets `lastSeen` to today when it is. Evidence the registration exists and flies, not of its paint.
Usage: .venv/bin/python -I tools/seen.py [AIRLINE ...]   (--write to update the files; --not-seen-since DATE to
skip airframes already seen since then, e.g. to finish a run that was cut short)"""

import argparse
import datetime
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import airframe_paths, fetch_json, load_airframes, write_json
from shapes import Airframe

RETRIES = 4


def lookup(registration: str) -> list[dict[str, Any]]:
    """adsb.lol's aircraft flying now under this registration (usually none or one). It throttles bursts even at a
    request a second (HTTP 429), so it's asked again a few times."""
    found: list[dict[str, Any]] = fetch_json(
        f"https://api.adsb.lol/v2/registration/{registration}", timeout=20, retries=RETRIES
    ).get("ac", [])
    return found


def check(airline: str, airframe: Airframe, today: str, write: bool) -> bool:
    """Look one airframe up and print what adsb.lol says; with `write`, mark it seen. True if it changed."""
    try:
        aircraft = lookup(airframe["registration"])
    except Exception as e:
        print(f"{airline} {airframe['registration']}: lookup failed ({e})")
        return False
    if not aircraft:
        print(f"{airline} {airframe['registration']}: not flying now")
        return False
    first = aircraft[0]
    hex_ = first.get("hex", "").lower()
    note = "" if not airframe.get("hex") or airframe["hex"] == hex_ else f"  ← listed {airframe['hex']}"
    callsign = (first.get("flight") or "").strip()
    print(f"{airline} {airframe['registration']}: flying, {hex_} {first.get('t', '')} {callsign}{note}")
    if not write:
        return False
    airframe.setdefault("hex", hex_)
    airframe["lastSeen"] = today
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("airlines", nargs="*", metavar="AIRLINE", help="airframe files to check (default: all)")
    parser.add_argument("--write", action="store_true", help="set lastSeen (and a missing hex) in the files")
    parser.add_argument("--not-seen-since", metavar="DATE", help="only airframes without a lastSeen on or after DATE")
    args = parser.parse_args()

    today = datetime.date.today().isoformat()
    for path in airframe_paths():
        if args.airlines and path.stem not in args.airlines:
            continue
        airframes = load_airframes(path)
        changed = False
        for airframe in airframes["airframes"]:
            if airframe.get("to"):
                continue
            if args.not_seen_since and airframe.get("lastSeen", "") >= args.not_seen_since:
                continue
            if check(path.stem, airframe, today, args.write):
                changed = True
            time.sleep(1.1)  # gently
        if changed:
            write_json(path, airframes)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
