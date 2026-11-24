"""Runway ends at the regional partners' hubs, and the matcher that says whether a point on a flight's trace
lines up with one, landing or departing. The runways are OurAirports' (public domain), for the airports in
regional_partners.HUBS only (tools/hub_runways.json).

  runways.py --extract runways.csv airports.csv   rewrite tools/hub_runways.json for HUBS' airports, from
                                                  OurAirports' data (ourairports.com/data/)
"""

import argparse
import csv
import json
import math
import sys
from collections import defaultdict
from functools import cache
from pathlib import Path
from typing import NamedTuple

HUB_RUNWAYS = Path(__file__).resolve().parent / "hub_runways.json"
SOURCE = "OurAirports (public domain), ourairports.com/data/"
COLUMNS = [
    "airport",
    "low ident",
    "low lat",
    "low lon",
    "high ident",
    "high lat",
    "high lon",
    "width ft",
    "elevation ft",
]

LADD, PIA = 8, 4  # adsb.lol's dbFlags for aircraft that asked to be hidden
CEILING_FT = 5000  # above the airport
APPROACH_M = 6000  # how far out on the approach or climb-out
CROSS_M = 250  # how far off the centerline
HEADING_DEG = 12  # how far off the runway's heading
SAME_EVENT_S = 1200  # points this close in time at one airport are one landing (or departure)
CELL_DEG = 0.25

Cell = tuple[int, int]


class RunwayEnd(NamedTuple):
    """One end of a runway, facing along it: a unit vector (ux east, uy north) towards the other end."""

    airport: str
    ident: str
    lat: float
    lon: float
    ux: float
    uy: float
    length: float  # meters
    heading: float  # degrees true


class Hit(NamedTuple):
    cross: float  # meters off the centerline
    airport: str
    runway: str
    kind: str  # "land" or "depart"


def meters(lat: float, lon: float, lat0: float, lon0: float) -> tuple[float, float]:
    """(east, north) in meters from (lat0, lon0), flat-earth: near enough over a few kilometers."""
    return (lon - lon0) * 111320 * math.cos(math.radians(lat0)), (lat - lat0) * 110574


def cell(lat: float, lon: float) -> Cell:
    return int(lat // CELL_DEG), int(lon // CELL_DEG)


@cache
def runways() -> tuple[dict[Cell, list[RunwayEnd]], dict[str, int]]:
    """Runway ends by map cell, near enough to be found from anywhere on the approach or climb-out, and each
    airport's elevation (ft)."""
    rows = json.loads(HUB_RUNWAYS.read_text())["runways"]
    elevation: dict[str, int] = defaultdict(int)
    for row in rows:
        elevation[row[0]] = max(elevation[row[0]], row[8])  # 0 means unknown on some rows
    grid: dict[Cell, list[RunwayEnd]] = defaultdict(list)
    for code, low, lat1, lon1, high, lat2, lon2, _, _ in rows:
        for ident, a, b in ((low, (lat1, lon1), (lat2, lon2)), (high, (lat2, lon2), (lat1, lon1))):
            x, y = meters(b[0], b[1], a[0], a[1])
            length = math.hypot(x, y)
            if length == 0:
                continue
            heading = math.degrees(math.atan2(x, y)) % 360
            end = RunwayEnd(code, ident, a[0], a[1], x / length, y / length, length, heading)
            reach = (length + APPROACH_M + CROSS_M) / 110574
            wide = reach / max(math.cos(math.radians(a[0])), 0.1)
            (s, w), (n, e) = cell(a[0] - reach, a[1] - wide), cell(a[0] + reach, a[1] + wide)
            for row_cell in range(s, n + 1):
                for column in range(w, e + 1):
                    grid[(row_cell, column)].append(end)
    return dict(grid), dict(elevation)


def match(lat: float, lon: float, altitude: float, track: float, climb: float) -> Hit | None:
    """The runway this point lines up with, and whether it's landing or departing (altitude in ft, climb in
    ft/min); the closest to its centerline if more than one."""
    grid, elevation = runways()
    best = None
    for end in grid.get(cell(lat, lon), ()):
        if abs((track - end.heading + 180) % 360 - 180) >= HEADING_DEG:
            continue
        if altitude - elevation[end.airport] > CEILING_FT:
            continue
        x, y = meters(lat, lon, end.lat, end.lon)
        cross = abs(x * end.uy - y * end.ux)
        if cross >= CROSS_M:
            continue
        along = x * end.ux + y * end.uy
        if -APPROACH_M < along < 300 and climb < 0:
            kind = "land"
        elif end.length < along < end.length + APPROACH_M and climb > 0:
            kind = "depart"
        else:
            continue
        if best is None or cross < best.cross:
            best = Hit(cross, end.airport, end.ident, kind)
    return best


def extract(runways_csv: Path, airports_csv: Path, airports: set[str]) -> int:
    """Write hub_runways.json from OurAirports' runways.csv and airports.csv: these airports' (IATA codes) open,
    located runways, one per line. How many rows."""
    with airports_csv.open(newline="", encoding="utf-8") as f:
        iata = {
            r["ident"]: (r["iata_code"], r["elevation_ft"]) for r in csv.DictReader(f) if r["iata_code"] in airports
        }
    rows: list[list[object]] = []
    with runways_csv.open(newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            code, elevation = iata.get(r["airport_ident"], ("", ""))
            if not code or r["closed"] == "1" or not (r["le_latitude_deg"] and r["he_latitude_deg"]):
                continue
            rows.append(
                [
                    code,
                    r["le_ident"],
                    round(float(r["le_latitude_deg"]), 4),
                    round(float(r["le_longitude_deg"]), 4),
                    r["he_ident"],
                    round(float(r["he_latitude_deg"]), 4),
                    round(float(r["he_longitude_deg"]), 4),
                    int(r["width_ft"] or 0),
                    int(r["le_elevation_ft"] or elevation or 0),
                ]
            )
    rows.sort(key=lambda row: (str(row[0]), str(row[1])))
    lines = ",\n".join("    " + json.dumps(row) for row in rows)
    HUB_RUNWAYS.write_text(
        f'{{\n  "source": {json.dumps(SOURCE)},\n  "columns": {json.dumps(COLUMNS)},\n'
        f'  "runways": [\n{lines}\n  ]\n}}\n'
    )
    return len(rows)


def main() -> int:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from regional_partners import HUBS  # here, not at the top: regional_partners imports this module

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--extract", type=Path, nargs=2, required=True, metavar=("RUNWAYS_CSV", "AIRPORTS_CSV"))
    runways_csv, airports_csv = parser.parse_args().extract
    airports = set().union(*HUBS.values())
    print(f"{extract(runways_csv, airports_csv, airports)} runways at {len(airports)} airports → {HUB_RUNWAYS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
