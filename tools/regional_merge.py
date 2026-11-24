"""Check regional_partners.py's report against the airframes already tagged here (by the FAA registry or a
dated photo), and add the jets it decided that aren't tagged yet, marked as inferred from who they fly for. A jet
adsbdb names another partner for (regional_brands.py's lookups, cached in the store) is left out and listed.

  regional_merge.py REPORT.json MASTER.txt [--write]    (MASTER.txt is the FAA registry's releasable database,
                                                          public domain: its N-numbers by Mode S hex)
"""

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path
from typing import NamedTuple, cast

sys.path.insert(0, str(Path(__file__).resolve().parent))
import regional_partners as rp
from common import AIRFRAMES, load_airframes, write_json
from regional_partners import Decided
from shapes import Airframe

# The regionals' airframe files, by callsign.
FILES = {"SKW": AIRFRAMES / "SKW.json", "RPA": AIRFRAMES / "RPA.json"}


class Registration(NamedTuple):
    registration: str  # "N123AB"
    owner: str


class Disagreement(NamedTuple):
    """A tagged jet whose flying points at another partner."""

    operator: str
    hex: str
    registration: str
    tagged: str
    flying: str
    by: str


def same_partner(a: str, b: str) -> bool:
    """The partner, ignoring which United or Alaska variant (express vs express-2010; regional vs -horizon)."""
    return a.split("/")[0] == b.split("/")[0]


def registrations(master: Path) -> dict[str, Registration]:
    """The FAA registry's N-number for each Mode S address (hex, lowercase), and who it's registered to."""
    out = {}
    with master.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            hex_ = (row.get("MODE S CODE HEX") or "").strip().lower()
            if hex_:
                out[hex_] = Registration("N" + row["N-NUMBER"].strip(), row["NAME"].strip())
    return out


def inferred_airframe(hex_: str, decided: Decided, registration: Registration, days: int, history: str) -> Airframe:
    """A new airframe entry for a jet tagged from its flying alone (confidence low, its evidence in the source)."""
    note = f"Inferred from who it flies for: {decided['evidence']} (tools/regional_partners.py)."
    # Built in the files' key order, `type` only when the report has one.
    fields: dict[str, object] = {"registration": registration.registration, "hex": hex_}
    if decided["type"]:
        fields["type"] = decided["type"]
    fields["livery"] = decided["livery"]
    fields["confidence"] = "low"
    fields["sources"] = [{"url": history, "title": "adsb.lol daily history (ODbL)", "note": note}]
    fields["notes"] = (
        f"Registered to {registration.owner} (FAA registry). Inferred from its flying, not seen: check against a photo."
    )
    return cast(Airframe, fields)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("report", type=Path, help="regional_partners.py --report's OUT.json")
    parser.add_argument("master", type=Path, help="the FAA registry's MASTER.txt")
    parser.add_argument("--write", action="store_true", help="add the new jets to airframes/SKW.json and RPA.json")
    parser.add_argument(
        "--store", type=Path, default=rp.DEFAULT_STORE, help=f"the daily logs (default {rp.DEFAULT_STORE})"
    )
    args = parser.parse_args()
    adsbdb = rp.adsbdb_cache(args.store)
    named_elsewhere: list[tuple[str, str, str, str]] = []

    inferred = cast(dict[str, Decided], json.loads(args.report.read_text()))
    regs = registrations(args.master)
    days = max((v["days"] for v in inferred.values()), default=0)
    agree: Counter[str] = Counter()
    added: Counter[str] = Counter()
    disagree: list[Disagreement] = []
    for operator, path in FILES.items():
        airframes = load_airframes(path)
        by_hex = {a["hex"]: a for a in airframes["airframes"] if a.get("hex")}
        for hex_, decided in inferred.items():
            if decided["operator"] != operator:
                continue
            known = by_hex.get(hex_)
            if known:
                if same_partner(known["livery"], decided["livery"]):
                    agree[operator] += 1
                else:
                    disagree.append(
                        Disagreement(
                            operator,
                            hex_,
                            known["registration"],
                            known["livery"],
                            decided["livery"],
                            decided["by"],
                        )
                    )
                continue
            registration = regs.get(hex_)
            if not registration:
                continue  # not in the US register (or not under this address): left for a photo
            named = rp.adsbdb_partner(adsbdb[hex_][0], operator) if hex_ in adsbdb else None
            if named and not same_partner(named, decided["livery"]):
                named_elsewhere.append((registration.registration, hex_, decided["livery"], named))
                continue
            added[operator] += 1
            if args.write:
                airframes["airframes"].append(
                    inferred_airframe(hex_, decided, registration, days, rp.history_url(args.store))
                )
        if args.write:
            airframes["airframes"].sort(key=lambda a: a["registration"])
            write_json(path, airframes)

    agreed = sum(agree.values())
    checked = agreed + len(disagree)
    share = f" ({100 * agreed / checked:.0f}%)" if checked else ""
    print(f"against the tagged ones: {agreed} of {checked} agree{share}")
    for row in disagree:
        print("  differs:", tuple(row))
    for left_out in named_elsewhere:
        print("  adsbdb names another partner (left out):", left_out)
    print("new:", dict(added), "(written)" if args.write else "(not written: --write)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
