"""The partner brand for SkyWest and Republic jets not placed yet (after regional_partners.py and the photos):
adsbdb (an open aircraft database) names it as the jet's operator ("United Express", "Delta Connection",
"American Eagle", "Alaska Airlines"). Looked up a request a second for the addresses still untagged, each
answer kept a week in the store (adsbdb.json, which regional_merge.py also reads); added as a cited source per
jet, its confidence by whether who the jet flew for (regional_partners.weekly: its flight numbers, else hubs)
agrees. Run it before regional_merge.py, so that a jet adsbdb places elsewhere isn't tagged from its flying.

  regional_brands.py MASTER.txt [--write] [--include-low]   (FAA registry for tail numbers); writes only where
                                                           the brand and its flying agree, unless --include-low
"""

import argparse
import json
import sys
import time
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import regional_partners as rp
from common import fetch_json, load_airframes, write_json
from regional_merge import FILES, registrations, same_partner
from shapes import Airframe, AirframeFile

WEEKS = 2
CACHE_DAYS = 7  # a lookup younger than this is reused


def brand(hex_: str) -> tuple[str | None, str | None]:
    """adsbdb's (registered owner, registration) for an address; (None, None) if the lookup fails."""
    try:
        aircraft: dict[str, Any] = fetch_json(f"https://api.adsbdb.com/v0/aircraft/{hex_}", timeout=15)["response"][
            "aircraft"
        ]
    except Exception:
        return None, None
    return aircraft.get("registered_owner"), aircraft.get("registration")


def flying(store: Path) -> tuple[dict[str, str], dict[str, list[str | None]]]:
    """Each jet's operator, and its partner by week where a week decides one (regional_partners.weekly)."""
    logs = rp.read_weeks(store, WEEKS)
    blocks = rp.number_partners(logs, rp.tagged_well())
    operators = {hex_: operator for hex_, (operator, _) in logs.meta.items()}
    weeks = {hex_: [w.partner for w in rp.weekly(logs, blocks, hex_)] for hex_ in logs.meta}
    return operators, weeks


def cached_brand(hex_: str, cache: dict[str, list[str | None]]) -> tuple[str | None, str | None]:
    """brand(), from the cache when looked up within CACHE_DAYS (then no request), else asked and cached."""
    hit = cache.get(hex_)
    if hit and hit[2] and date.fromisoformat(hit[2]) >= date.today() - timedelta(days=CACHE_DAYS):
        return hit[0], hit[1]
    owner, reg = brand(hex_)
    time.sleep(1.0)
    if owner or reg:
        cache[hex_] = [owner, reg, date.today().isoformat()]
    return owner, reg


def brand_airframe(hex_: str, tail: str, livery: str, confidence: str, owner: str, decided: int) -> Airframe:
    agreement = (
        f"; flew for that partner in {decided} of {WEEKS} weeks (adsb.lol: its flight numbers, else hubs)"
        if decided
        else "; flying didn't decide"
    )
    return {
        "registration": tail,
        "hex": hex_,
        "livery": livery,
        "confidence": confidence,
        "sources": [
            {
                "url": f"https://api.adsbdb.com/v0/aircraft/{hex_}",
                "title": "adsbdb aircraft record",
                "accessed": time.strftime("%Y-%m-%d"),
                "note": f'Operator given as "{owner}"' + agreement,
            }
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("master", type=Path, help="the FAA registry's MASTER.txt")
    parser.add_argument("--write", action="store_true", help="add the jets to airframes/SKW.json and RPA.json")
    parser.add_argument("--include-low", action="store_true", help="also add those only the brand places")
    parser.add_argument(
        "--store", type=Path, default=rp.DEFAULT_STORE, help=f"the daily logs (default {rp.DEFAULT_STORE})"
    )
    args = parser.parse_args()

    regs = registrations(args.master)
    operator, weeks = flying(args.store)
    files: dict[str, AirframeFile] = {k: load_airframes(p) for k, p in FILES.items()}
    tagged = {a.get("hex") for d in files.values() for a in d["airframes"]}
    todo = sorted(h for h in operator if h not in tagged)
    cache = rp.adsbdb_cache(args.store)
    print(f"{len(todo)} SkyWest/Republic jets seen in two weeks and untagged: looking them up (~1 a second)")
    counts: Counter[str] = Counter()
    odd = []
    for h in todo:
        owner, reg = cached_brand(h, cache)
        livery = rp.adsbdb_partner(owner, operator[h])
        if not owner or not livery:
            counts["no partner named"] += 1
            continue
        seen = [w for w in weeks[h] if w]
        if any(not same_partner(w, livery) for w in seen):
            known = regs.get(h)
            odd.append((operator[h], h, reg or (known.registration if known else "?"), owner, seen))
            counts["disagrees with its flying"] += 1
            continue
        confidence = "medium" if seen else "low"
        counts[confidence] += 1
        if confidence == "low" and not args.include_low:
            continue  # one source alone: tagged only with --include-low (2026-11-13: two signals agreeing)
        known = regs.get(h)
        tail = known.registration if known else (reg or h.upper())
        if args.write:
            files[operator[h]]["airframes"].append(brand_airframe(h, tail, livery, confidence, owner, len(seen)))
    (args.store / rp.ADSBDB_CACHE).write_text(json.dumps(cache, indent=1, sort_keys=True))
    if args.write:
        for k, d in files.items():
            d["airframes"].sort(key=lambda a: a["registration"])
            write_json(FILES[k], d)
    print(dict(counts), "(written)" if args.write else "(not written: --write)")
    for row in odd:
        print("  disagrees:", row)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
