"""SkyWest and Republic jets that a mainline partner owns itself, tagged from their registration block. A partner
buys its regional jets in batches and registers each batch in a block of N-numbers (Delta's N6xxCZ E175s,
United's N6xxUX), all flown by one regional in the owner's paint. So a jet still untagged is given its block's
scheme where (all of these):

- the FAA registry names a partner as its owner (OWNERS);
- at least MIN_SIBLINGS of its block (same owner, same N-number length, first digit and letters) are tagged here,
  every one with the same scheme, the owner's, and at least one of them seen in it (a dated photo): that one
  settles which of the owner's schemes (United's 2019 or 2010), which an inference can't;
- who it flew for (regional_partners.weekly: its flight numbers, else hubs) puts it with no other partner in any
  week, and adsbdb (regional_brands.py's cached lookups) names no other partner.

Tagged medium, citing the registry and the block (and adsbdb and the flying where they agree). Jets that fail only
the last check are listed: the evidence disagrees.

  regional_blocks.py MASTER.txt [--write]     (run before regional_brands.py and regional_merge.py)
"""

import argparse
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import cast

sys.path.insert(0, str(Path(__file__).resolve().parent))
import regional_partners as rp
from common import load_airframes, write_json
from regional_merge import FILES, Registration, registrations, same_partner
from shapes import Airframe

# Registered owners that are a partner itself (the FAA registry's NAME), by its scheme's airline.
OWNERS = {
    "DELTA AIR LINES INC": "DAL",
    "UNITED AIRLINES INC": "UAL",
    "AMERICAN AIRLINES INC": "AAL",
    "ALASKA AIRLINES INC": "ASA",
}
MIN_SIBLINGS = 3
REGISTRY = "https://registry.faa.gov/database/ReleasableAircraft.zip"


def block(registration: Registration) -> tuple[str, int, str, str] | None:
    """A jet's block: its owner, and its N-number's length, first digit and letters (N604CZ → 3, "6", "CZ")."""
    m = re.fullmatch(r"N(\d+)([A-Z]*)", registration.registration)
    return (registration.owner, len(m[1]), m[1][0], m[2]) if m else None


def seen(airframe: Airframe) -> bool:
    """Tagged from a photo of it (a Commons file among its sources)."""
    return any("commons.wikimedia.org" in s["url"] for s in airframe["sources"])


def block_airframe(
    hex_: str,
    tail: str,
    type_: str,
    livery: str,
    owner: str,
    siblings: list[Airframe],
    registry_date: str,
    flying: str | None,
    adsbdb: list[str | None] | None,
    history: str,
) -> Airframe:
    """A new entry tagged by its block, its siblings and their evidence in the source note."""
    best = sorted(siblings, key=lambda a: (not seen(a), ("high", "medium", "low").index(a["confidence"])))
    named = ", ".join(f"{a['registration']} ({'photo' if seen(a) else a['confidence']})" for a in best[:8])
    named += f" and {len(best) - 8} more" if len(best) > 8 else ""
    sources = [
        {
            "url": REGISTRY,
            "title": "FAA Releasable Aircraft Database (MASTER.txt)",
            "accessed": registry_date,
            "note": (
                f"Registered to {owner.title()}, the partner itself; every tagged jet of its "
                f"block registered to it wears {livery}: {named} (tools/regional_blocks.py)."
            ),
        }
    ]
    if adsbdb:
        sources.append(
            {
                "url": f"https://api.adsbdb.com/v0/aircraft/{hex_}",
                "title": "adsbdb aircraft record",
                "accessed": adsbdb[2] or "",
                "note": f'Operator given as "{adsbdb[0]}"',
            }
        )
    if flying:
        sources.append(
            {"url": history, "title": "adsb.lol daily history (ODbL)", "note": f"Flew for that partner: {flying}."}
        )
    fields: dict[str, object] = {"registration": tail, "hex": hex_}
    if type_:
        fields["type"] = type_
    fields["livery"] = livery
    fields["confidence"] = "medium"
    fields["sources"] = sources
    fields["notes"] = "Tagged from its registration block, not seen: check against a photo."
    return cast(Airframe, fields)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("master", type=Path, help="the FAA registry's MASTER.txt")
    parser.add_argument("--write", action="store_true", help="add the jets to airframes/SKW.json and RPA.json")
    parser.add_argument(
        "--store", type=Path, default=rp.DEFAULT_STORE, help=f"the daily logs (default {rp.DEFAULT_STORE})"
    )
    args = parser.parse_args()

    regs = registrations(args.master)
    registry_date = date.fromtimestamp(args.master.stat().st_mtime).isoformat()  # when it was downloaded
    logs = rp.read_weeks(args.store, 2)
    numbers = rp.number_partners(logs, rp.tagged_well())
    adsbdb = rp.adsbdb_cache(args.store)
    files = {k: load_airframes(p) for k, p in FILES.items()}
    tagged = {a["hex"]: a for d in files.values() for a in d["airframes"] if a.get("hex") and not a.get("to")}
    members: dict[tuple[str, int, str, str], list[Airframe]] = defaultdict(list)
    for hex_, a in tagged.items():
        b = block(regs[hex_]) if hex_ in regs else None
        if b:
            members[b].append(a)

    added: list[tuple[str, str, str]] = []
    disagree: list[tuple[str, str, str]] = []
    for hex_, (operator, type_) in sorted(logs.meta.items()):
        reg = regs.get(hex_)
        b = block(reg) if reg else None
        if hex_ in tagged or not reg or not b or reg.owner not in OWNERS:
            continue
        siblings = members[b]
        liveries = {a["livery"] for a in siblings}
        if len(siblings) < MIN_SIBLINGS or len(liveries) != 1:
            continue
        livery = liveries.pop()
        if livery.split("/")[0] != OWNERS[reg.owner] or not any(map(seen, siblings)):
            continue
        weeks = rp.weekly(logs, numbers, hex_)
        flown = {w.partner for w in weeks if w.partner}
        named = rp.adsbdb_partner(adsbdb[hex_][0], operator) if hex_ in adsbdb else None
        against = [(f"flew for {p}") for p in flown if not same_partner(p, livery)]
        against += [f"adsbdb names {named}"] if named and not same_partner(named, livery) else []
        if against:
            disagree.append((reg.registration, livery, "; ".join(against)))
            continue
        agrees = adsbdb[hex_] if named else None
        decided = len(flown) == 1 and all(w.partner for w in weeks)
        flying = rp.evidence(weeks, logs.days) if decided else None
        added.append((reg.registration, livery, f"{len(siblings)} siblings"))
        if args.write:
            files[operator]["airframes"].append(
                block_airframe(
                    hex_,
                    reg.registration,
                    type_,
                    livery,
                    reg.owner,
                    siblings,
                    registry_date,
                    flying,
                    agrees,
                    rp.history_url(args.store),
                )
            )
    if args.write:
        for k, d in files.items():
            d["airframes"].sort(key=lambda a: a["registration"])
            write_json(FILES[k], d)
    for row in added:
        print("  tagged:" if args.write else "  would tag:", row)
    for row in disagree:
        print("  disagrees (left out):", row)
    print(f"{len(added)} by their block", "(written)" if args.write else "(not written: --write)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
