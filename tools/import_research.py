"""Bring a research file (a list of special liveries found and sourced, one per airframe) in as liveries
described in words (no geometry yet) and their airframe assignments. Existing files are kept: a livery
already drawn isn't overwritten, and an airframe already listed is left as it is.

The research file is a JSON list, one object per airframe:

    airline_icao, livery_name, description, registration, confidence (high, medium or low), sources (URLs),
    and optionally aircraft_type_icao, icao_hex, icao_hex_source, date_applied, date_retired, status,
    status_evidence, status_evidence_date, history, notes

Usage: .venv/bin/python -I tools/import_research.py research.json [--accessed YYYY-MM-DD]
       (--accessed: when the sources were read; default today)"""

import argparse
import datetime
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import AIRFRAMES, LIVERIES, load_airframes, load_json, write_json
from shapes import Airframe, AirframeFile, Livery, Source

CONFIDENCES = ("high", "medium", "low")


def date(text: object) -> str | None:
    """The first year or year-month in free text ('2010-2011 (85th…)' → '2010'); None if there isn't one."""
    if not text:
        return None
    m = re.search(r"\b(\d{4})(?:-(\d{2}))?\b", str(text))
    if not m:
        return None
    year, month = m.group(1), m.group(2)
    return f"{year}-{month}" if month and 1 <= int(month) <= 12 else year


def slug(name: str) -> str:
    """A livery id from its name: lower case, hyphens, a year kept from brackets, at most six words."""
    name = re.sub(r"\((\d{4})[^)]*\)", r"\1", name)
    name = re.sub(r"\(.*?\)", "", name).replace("'", "").replace("’", "")
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return "-".join(s.split("-")[:6]) or "special"


def kind(name: str) -> str:
    n = name.lower()
    if "oneworld" in n or "star alliance" in n or "skyteam" in n:
        return "alliance"
    if "retro" in n or "heritage" in n:
        return "retro"
    return "special"


def words(desc: str | dict[str, str]) -> str:
    """A description as prose: a string as it is, or {"main_color": "blue"} as "Main color: blue."."""
    if isinstance(desc, str):
        return desc
    return " ".join(f"{k.replace('_', ' ').capitalize()}: {v.rstrip('.')}." for k, v in desc.items() if v)


def new_livery(entry: dict[str, Any], lid: str, confidence: str, sources: list[Source]) -> Livery:
    livery: Livery = {
        "$schema": "../../schema/livery.schema.json",
        "id": lid,
        "airline": entry["airline_icao"],
        "name": entry["livery_name"],
        "kind": kind(entry["livery_name"]),
        "confidence": confidence,
        "description": words(entry["description"]),
        "sources": sources,
    }
    if entry.get("history"):
        livery["history"] = entry["history"]
    if entry.get("notes"):
        livery["notes"] = entry["notes"]
    applied = date(entry.get("date_applied"))
    if applied:
        livery["from"] = applied
    return livery


def new_airframe(entry: dict[str, Any], lid: str, confidence: str, sources: list[Source]) -> Airframe:
    airframe: Airframe = {
        "registration": entry["registration"],
        "livery": lid,
        "confidence": confidence,
        "sources": sources,
    }
    if entry.get("icao_hex"):
        airframe["hex"] = entry["icao_hex"].lower()
        airframe["hexSource"] = entry.get("icao_hex_source", "")
    if entry.get("aircraft_type_icao"):
        airframe["type"] = entry["aircraft_type_icao"]
    applied, retired = date(entry.get("date_applied")), date(entry.get("date_retired"))
    if applied:
        airframe["from"] = applied
    if retired:
        airframe["to"] = retired
    evidence_date = entry.get("status_evidence_date")
    if evidence_date:
        seen = date(evidence_date) if len(evidence_date) < 8 else evidence_date[:10]
        if seen:
            airframe["lastSeen"] = seen
    airframe["status"] = f"{entry.get('status', '')}: {entry.get('status_evidence', '')}".strip(": ")
    return airframe


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("research", type=Path, help="the research file (JSON list)")
    parser.add_argument("--accessed", default=datetime.date.today().isoformat(), help="when the sources were read")
    args = parser.parse_args()
    entries: list[dict[str, Any]] = load_json(args.research)

    liveries: dict[tuple[str, str], Livery] = {}
    airframes: dict[str, list[Airframe]] = {}
    for entry in entries:
        code = entry["airline_icao"]
        lid = slug(entry["livery_name"])
        sources: list[Source] = [{"url": u, "accessed": args.accessed} for u in entry["sources"]]
        confidence = entry["confidence"] if entry["confidence"] in CONFIDENCES else "low"
        key = (code, lid)
        if key not in liveries:
            # Its own copy: the airframe below keeps this entry's sources, not the livery's as it grows.
            liveries[key] = new_livery(entry, lid, confidence, list(sources))
        else:
            known = {s["url"] for s in liveries[key]["sources"]}
            liveries[key]["sources"] += [s for s in sources if s["url"] not in known]
        airframes.setdefault(code, []).append(new_airframe(entry, lid, confidence, sources))

    new_liveries = 0
    for (code, lid), livery in liveries.items():
        path = LIVERIES / code / f"{lid}.json"
        if path.exists():
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        write_json(path, livery)
        new_liveries += 1

    new_airframes = 0
    for code, items in airframes.items():
        path = AIRFRAMES / f"{code}.json"
        if path.exists():
            listed = load_airframes(path)
        else:
            listed = AirframeFile({"$schema": "../schema/airframes.schema.json", "airline": code, "airframes": []})
        have = {(a["registration"], a["livery"]) for a in listed["airframes"]}
        for airframe in items:
            if (airframe["registration"], airframe["livery"]) not in have:
                listed["airframes"].append(airframe)
                new_airframes += 1
        listed["airframes"].sort(key=lambda a: a["registration"])
        write_json(path, listed)
    print(f"{new_liveries} liveries, {new_airframes} airframes added")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
