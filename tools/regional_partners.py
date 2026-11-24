"""Whose paint a SkyWest or Republic jet wears, from who it flies for. Both fly for several mainlines under their
own callsign prefix, so the prefix doesn't say; but each jet is given to one partner and works that partner's
flights. So, from adsb.lol's daily history dumps (ODbL), each SKW/RPA jet's landings and departures by its ICAO
address, and two readings of them:

- its flight numbers: the number after the prefix is the partner's marketing flight number (SKW3953 flies as DL3953),
  and each partner has its own ranges. The ranges aren't hard-coded: each run learns them, by hundred, from the
  jets already tagged high or medium (a hundred counts where at least 20 of their flights are, 95% for one
  partner). Checked 2026-11-16 against the photo-tagged jets: 200 of 201 agree (N738EV, photographed in
  American Eagle paint, flies United's numbers: moved, the paint may lag).
- where it flies: its events at airports that are one partner's hubs (HUBS). Noisier (a partner's spoke flights
  land at the others' hubs; 92% agreed): used for a week only when the flight numbers don't decide it.

  regional_partners.py --days 7                 fetch the latest 7 dumps (3 GB each, one at a time), log, delete
  regional_partners.py --report OUT.json [--weeks 2]   score the latest week (or weeks, each agreeing); OUT.json
                                                       for tools/regional_merge.py

Kept: address, callsign, type, airport, kind, time; only SKW and RPA flights (airliners on airline business, not
LADD/PIA), one CSV a day in --store (default build/regionals/, not committed). Fetching needs the GitHub CLI (`gh`) and
about 3 GB of disk a day while one is scanned. Only the hubs' events are kept (tools/hub_runways.json): all the hub
reading needs, and the flight numbers of every flight to or from a hub. Maintainer-only: a contributor doesn't need
any of this to add or change a scheme.
"""

import argparse
import csv
import gzip
import json
import re
import subprocess
import sys
import tempfile
from collections import Counter, defaultdict
from datetime import date
from multiprocessing import Pool
from pathlib import Path
from typing import Any, NamedTuple, TypedDict, cast

sys.path.insert(0, str(Path(__file__).resolve().parent))
import runways
from common import AIRFRAMES, ROOT

DEFAULT_STORE = ROOT / "build/regionals"


def history_repo(year: int) -> str:
    """adsb.lol's daily history for a year, one GitHub repository each."""
    return f"adsblol/globe_history_{year}"


def history_url(store: Path) -> str:
    """The history the store's latest log came from, for a source's url."""
    latest = max((p.stem for p in store.glob("*.csv")), default=str(date.today()))
    return f"https://github.com/{history_repo(int(latest[:4]))}"


OPERATORS = ("SKW", "RPA")
# Hubs that are one partner's alone (shared ones, LAX, ORD, SEA, JFK, BOS, don't count).
HUBS = {
    "DAL/connection": {"ATL", "DTW", "MSP", "SLC"},
    "UAL/express": {"DEN", "IAH", "SFO", "EWR", "IAD"},
    "AAL/eagle": {"DFW", "CLT", "PHX", "MIA", "PHL", "DCA"},
    "ASA/regional": {"PDX", "ANC"},
}
MIN_EVENTS, SHARE = 4, 0.9
# Flight numbers: a hundred (SKW35xx) counts for a partner where the tagged jets flew at least NUMBER_FLIGHTS of
# their flights in it, NUMBER_SHARE for that partner; a week decides with MIN_FLIGHTS flights, SHARE one partner's.
NUMBER_FLIGHTS, NUMBER_SHARE, MIN_FLIGHTS = 20, 0.95, 3
CSV_HEADER = ["hex", "callsign", "type", "airport", "kind", "time"]
# adsbdb's operator names → the partner's scheme (tools/regional_brands.py looks them up; cached in the store).
BRANDS = {
    "united express": "UAL/express",
    "delta connection": "DAL/connection",
    "american eagle": "AAL/eagle",
    "alaska airlines": "ASA/regional",
    "alaska horizon": "ASA/regional",
}
ADSBDB_CACHE = "adsbdb.json"  # in the store: address → [operator, registration, date looked up]


def adsbdb_cache(store: Path) -> dict[str, list[str | None]]:
    """regional_brands.py's lookups so far (empty before its first run)."""
    path = store / ADSBDB_CACHE
    return cast(dict[str, list[str | None]], json.loads(path.read_text())) if path.exists() else {}


def adsbdb_partner(owner: str | None, operator: str) -> str | None:
    """The scheme adsbdb's operator name stands for, or None (no partner named; Alaska for a Republic jet, which
    Republic doesn't fly for, is a stale record)."""
    livery = BRANDS.get((owner or "").strip().lower())
    return None if livery and operator == "RPA" and livery.startswith("ASA") else livery


class Event(NamedTuple):
    """A landing or departure, one row of a day's CSV."""

    hex: str
    callsign: str
    type: str
    airport: str
    kind: str
    time: int


class Decided(TypedDict):
    """A jet whose weeks agreed on a partner: one entry of the report."""

    operator: str  # SKW or RPA
    type: str
    livery: str  # the partner's scheme, e.g. "UAL/express"
    by: str  # "flight numbers" or "hubs": which reading decided it (its weeks may mix the two)
    evidence: str  # in words, for the airframe's source note
    days: int


class Flying(NamedTuple):
    """What the logs say of each jet: its operator and type, by week its hub events by partner, and by week the
    flights it flew (day and callsign, each once)."""

    days: int
    meta: dict[str, tuple[str, str]]  # hex → (operator, type)
    weeks: list[dict[str, Counter[str]]]  # week → hex → partner → events
    flights: list[dict[str, set[tuple[int, str]]]]  # week → hex → {(day, callsign)}


class Week(NamedTuple):
    """One week's reading of a jet: the partner (or None), what decided it, and the counts behind it."""

    partner: str | None
    by: str  # "flight numbers" or "hubs"
    n: int  # flights (or hub events) for that partner
    of: int  # of all counted


def hub_partners() -> dict[str, str]:
    """Each hub airport → the partner whose hub it is."""
    return {airport: partner for partner, airports in HUBS.items() for airport in airports}


def scan(path: str) -> list[Event]:
    """One aircraft's day (a trace file): its SKW/RPA landings and departures, one per airport and kind within
    runways.SAME_EVENT_S."""
    raw = Path(path).read_bytes()
    aircraft: dict[str, Any] = json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)
    if aircraft.get("dbFlags", 0) & (runways.LADD | runways.PIA):
        return []
    hex_ = aircraft.get("icao", Path(path).stem.split("_")[-1]).lower()
    base = aircraft.get("timestamp", 0)
    callsign = None
    out: list[Event] = []
    last: dict[tuple[str, str], float] = {}  # (airport, kind) → when last matched
    # A trace point: [seconds since base, lat, lon, altitude ft or "ground", ground speed, track, flags,
    # vertical rate ft/min, details (with the callsign as "flight"), ...]
    for point in aircraft["trace"]:
        if point[8] and point[8].get("flight"):
            callsign = point[8]["flight"].strip()
        if not callsign or not callsign.startswith(OPERATORS):
            continue
        if point[3] in ("ground", None) or point[5] is None or point[4] is None:
            continue
        hit = runways.match(point[1], point[2], point[3], point[5], point[7] or 0)
        if not hit:
            continue
        key = (hit.airport, hit.kind)
        recent = key in last and point[0] - last[key] < runways.SAME_EVENT_S
        last[key] = point[0]
        if not recent:
            out.append(Event(hex_, callsign, aircraft.get("t") or "", hit.airport, hit.kind, round(base + point[0])))
    return out


def log_day(dump: Path, day: str, store: Path) -> None:
    """Scan an unpacked dump (four processes) and write its events to STORE/DAY.csv."""
    files = sorted(str(p) for p in dump.glob("traces/*/trace_full_*.json"))
    store.mkdir(parents=True, exist_ok=True)
    rows = 0
    with (store / f"{day}.csv").open("w", newline="") as f, Pool(4) as pool:
        writer = csv.writer(f)
        writer.writerow(CSV_HEADER)
        for events in pool.imap_unordered(scan, files, chunksize=100):
            writer.writerows(events)
            rows += len(events)
    print(f"{day}: {len(files)} aircraft, {rows} SKW/RPA events", flush=True)


def fetch(days: int, store: Path) -> None:
    """Download, scan and delete the latest `days` daily dumps that aren't logged yet, one at a time."""
    tags: list[str] = []
    for year in (date.today().year - 1, date.today().year):  # early January reaches back into last year's
        listing = subprocess.run(
            ["gh", "release", "list", "-R", history_repo(year), "--limit", "60", "--json", "tagName"],
            capture_output=True,
            text=True,
        )
        if listing.returncode == 0:
            tags += [
                t["tagName"]
                for t in json.loads(listing.stdout)
                if re.fullmatch(r"v\d{4}\.\d\d\.\d\d-planes-readsb-prod-0", t["tagName"])
            ]
    tags.sort()
    for tag in tags[-days:]:
        day = tag[1:11].replace(".", "-")
        if (store / f"{day}.csv").exists():
            continue
        store.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=store.parent) as folder:
            subprocess.run(
                ["gh", "release", "download", tag, "-R", history_repo(int(day[:4])), "-D", folder], check=True
            )
            # The day comes split in parts of one tar.
            parts = sorted(Path(folder).glob("*.tar.*"))
            with subprocess.Popen(["cat", *map(str, parts)], stdout=subprocess.PIPE) as cat:
                subprocess.run(["tar", "-x", "-C", folder], stdin=cat.stdout, check=True)
            log_day(Path(folder), day, store)


def read_weeks(store: Path, weeks: int) -> Flying:
    """The latest 7 × `weeks` days' logs, split into runs of 7 (latest last; a short first run when there are
    fewer days)."""
    hubs = hub_partners()
    files = sorted(store.glob("*.csv"))[-7 * weeks :]
    if not files:
        raise SystemExit(f"No daily logs in {store}: fetch some first (regional_partners.py --days 7).")
    seen: list[dict[str, Counter[str]]] = [defaultdict(Counter) for _ in range(weeks)]
    flights: list[dict[str, set[tuple[int, str]]]] = [defaultdict(set) for _ in range(weeks)]
    meta: dict[str, tuple[str, str]] = {}
    for i, path in enumerate(files):
        week = min(i // 7, weeks - 1)
        with path.open() as f:
            for row in csv.DictReader(f):
                meta[row["hex"]] = (row["callsign"][:3], row["type"])
                flights[week][row["hex"]].add((i, row["callsign"]))
                if row["airport"] in hubs:
                    seen[week][row["hex"]][hubs[row["airport"]]] += 1
    return Flying(len(files), meta, seen, flights)


def partner_of(livery: str) -> str:
    """A scheme's partner key in HUBS ("UAL/express-2010" → "UAL/express")."""
    return next(k for k in HUBS if k.split("/")[0] == livery.split("/")[0])


def number_block(callsign: str) -> tuple[str, int] | None:
    """A callsign's operator and flight number's hundred ("SKW3953" → ("SKW", 39)); None for one that isn't a
    plain flight number (positioning and charter callsigns end in a letter)."""
    m = re.fullmatch(r"([A-Z]{3})(\d{1,4})", callsign)
    return (m[1], int(m[2]) // 100) if m else None


def number_partners(flying: Flying, tagged: dict[str, str]) -> dict[tuple[str, int], str]:
    """Each flight-number hundred → its partner, learned from the jets tagged so far (address → livery, high and
    medium only): where they flew at least NUMBER_FLIGHTS flights in it, NUMBER_SHARE of them for one partner."""
    counts: dict[tuple[str, int], Counter[str]] = defaultdict(Counter)
    for week in flying.flights:
        for hex_, flown in week.items():
            if hex_ in tagged:
                for _, callsign in flown:
                    block = number_block(callsign)
                    if block:
                        counts[block][partner_of(tagged[hex_])] += 1
    out = {}
    for block, c in counts.items():
        partner, n = c.most_common(1)[0]
        if c.total() >= NUMBER_FLIGHTS and n / c.total() >= NUMBER_SHARE:
            out[block] = partner
    return out


def tagged_well() -> dict[str, str]:
    """The SKW/RPA jets tagged high or medium, still in that scheme: address → livery."""
    out = {}
    for operator in OPERATORS:
        data = json.loads((AIRFRAMES / f"{operator}.json").read_text())
        for a in data["airframes"]:
            if a.get("hex") and a["confidence"] in ("high", "medium") and not a.get("to"):
                out[a["hex"]] = a["livery"]
    return out


def weekly(flying: Flying, blocks: dict[tuple[str, int], str], hex_: str) -> list[Week]:
    """A jet's partner, week by week: by its flight numbers where that week has MIN_FLIGHTS of them in known
    hundreds; otherwise by where it flew (decide)."""
    out = []
    for w in range(len(flying.weeks)):
        numbers = Counter(
            blocks[b] for _, c in flying.flights[w].get(hex_, ()) if (b := number_block(c)) and b in blocks
        )
        if numbers.total() >= MIN_FLIGHTS:
            partner, n = numbers.most_common(1)[0]
            out.append(Week(partner if n / numbers.total() >= SHARE else None, "flight numbers", n, numbers.total()))
        else:
            hub, n, of = decide(flying.weeks[w].get(hex_, Counter()))
            out.append(Week(hub, "hubs", n, of))
    return out


def decide(counts: Counter[str]) -> tuple[str | None, int, int]:
    """One partner, if at least MIN_EVENTS of its landings and departures were at its hubs and SHARE of all hub
    ones: (partner or None, its events, all hub events)."""
    at_hubs = sum(counts.values())
    if not at_hubs:
        return None, 0, 0
    partner, n = counts.most_common(1)[0]
    return (partner if n >= MIN_EVENTS and n / at_hubs >= SHARE else None), n, at_hubs


def evidence(results: list[Week], days: int) -> str:
    """What decided a jet, in words: "61 of 61 flights under that partner's flight numbers over 14 days"."""
    words = {
        "flight numbers": "flights under that partner's flight numbers",
        "hubs": "landings and departures at that partner's hubs",
    }
    parts = []
    for by, what in words.items():
        n = sum(r.n for r in results if r.by == by)
        of = sum(r.of for r in results if r.by == by)
        if of:
            parts.append(f"{n} of {of} {what}")
    return f"{'; '.join(parts)} over {days} days, each week agreeing"


def report(out_path: Path, weeks: int, store: Path) -> None:
    """Score each jet. With `weeks` > 1 the days are split into that many runs of 7 (latest last), and a jet is
    decided only where every week, on its own, gives the same partner: a jet moved between partners shows as
    weeks that disagree, and its paint may lag (paint and partner differed for 16 of 85 checked in one week)."""
    flying = read_weeks(store, weeks)
    blocks = number_partners(flying, tagged_well())
    out: dict[str, Decided] = {}
    split = undecided = 0
    for hex_, (operator, type_) in flying.meta.items():
        results = weekly(flying, blocks, hex_)
        partners = {r.partner for r in results}
        first = results[0].partner
        if len(partners) == 1 and first is not None:
            out[hex_] = {
                "operator": operator,
                "type": type_,
                "livery": first,
                "by": " and ".join(sorted({r.by for r in results})),
                "evidence": evidence(results, flying.days),
                "days": flying.days,
            }
        elif len({r.partner for r in results if r.partner}) > 1:
            split += 1
        else:
            undecided += 1
    out_path.write_text(json.dumps(out, indent=1))
    print(f"{len(blocks)} flight-number hundreds placed from the tagged jets")
    print(
        f"{len(flying.meta)} jets seen over {flying.days} days in {weeks} week(s): {len(out)} decided the same "
        f"every week, {split} changed partner between weeks, {undecided} not decided in some week"
    )
    by = Counter((v["operator"], v["livery"]) for v in out.values())
    for (operator, livery), n in sorted(by.items()):
        print(f"  {operator} {livery}: {n}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--days", type=int, help="fetch and log the latest N daily dumps")
    parser.add_argument("--report", type=Path, metavar="OUT.json", help="score the logged days into OUT.json")
    parser.add_argument("--weeks", type=int, default=1, help="weeks that must each agree (default 1)")
    parser.add_argument("--store", type=Path, default=DEFAULT_STORE, help=f"the daily logs (default {DEFAULT_STORE})")
    args = parser.parse_args()
    if args.days:
        fetch(args.days, args.store)
    if args.report:
        report(args.report, args.weeks, args.store)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
