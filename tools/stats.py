"""What's in the dataset, counted from the files: schemes by kind and confidence, how much of each is drawn,
which airframes are tagged and on what evidence. Prints a Markdown summary; with --write it replaces the
README's stats section (between the `stats:start` / `stats:end` markers), so the numbers move with the data.

  .venv/bin/python -I tools/stats.py           # print
  .venv/bin/python -I tools/stats.py --write   # update README.md
"""

import argparse
import sys
from collections import Counter
from collections.abc import Iterable
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, airframe_paths, livery_paths, load_airframes, load_livery, load_operators
from shapes import Airframe, Livery

START, END = "<!-- stats:start -->", "<!-- stats:end -->"

# What kind of evidence a source is, by where it lives.
KINDS = [
    ("commons.wikimedia.org", "dated photo (Wikimedia Commons)"),
    ("wikipedia.org", "Wikipedia"),
    ("registry.faa.gov", "FAA aircraft registry"),
    ("github.com/adsblol", "where it flies (adsb.lol flight history)"),
    ("api.adsbdb.com", "aircraft database (adsbdb)"),
    ("hexdb.io", "aircraft database (hexdb)"),
    ("lockonaviation.net", "spotter fleet list (names only)"),
    ("planecaptures.com", "spotter fleet list (names only)"),
]
AIRLINE_SITES = (
    "flyfrontier.com",
    "alaskaair.com",
    "delta.com",
    "emirates.com",
    "cathaypacific.com",
    "evaair.com",
    "ana.co.jp",
    "airarabia.com",
    "lufthansagroup.com",
    "britishairways.com",
    "mediaroom.com",
    "prnewswire.com",
)


def kind(url: str | None) -> str:
    """The kind of evidence a source's URL is (KINDS, the airlines' own sites, else the press)."""
    u = urlparse(url or "")
    where = u.netloc.removeprefix("www.") + u.path
    for key, name in KINDS:
        if key in where:
            return name
    if any(site in u.netloc for site in AIRLINE_SITES):
        return "the airline or its press release"
    return "aviation press and other" if u.netloc else "no link"


def table(rows: Iterable[tuple[str, int]], head: tuple[str, str]) -> str:
    """A two-column Markdown table, the count right-aligned."""
    out = [f"| {head[0]} | {head[1]} |", "|---|--:|"]
    out += [f"| {k} | {v} |" for k, v in rows]
    return "\n".join(out)


def count_leads() -> int:
    """Rows in leads.tsv, less its header."""
    leads = ROOT / "leads.tsv"
    if not leads.exists():
        return 0
    return max(len(leads.read_text().splitlines()) - 1, 0)


def first_source_kind(airframe: Airframe) -> str:
    sources = airframe.get("sources")
    return kind(sources[0].get("url")) if sources else "no link"


def stats() -> str:
    """The README's stats section, as Markdown."""
    schemes: list[Livery] = [load_livery(p) for p in livery_paths()]
    # (the file it's in, the airframe): the file is the callsign that flies it.
    frames: list[tuple[str, Airframe]] = [(p.stem, a) for p in airframe_paths() for a in load_airframes(p)["airframes"]]
    airframes = [a for _, a in frames]
    operators = load_operators()

    drawn = [s for s in schemes if s.get("fuselage", {}).get("areas") or s.get("fin", {}).get("areas")]
    standard = [s for s in schemes if s["kind"] == "standard"]
    kinds = ", ".join(f"{n} {k}" for k, n in Counter(s["kind"] for s in schemes).most_common())
    current = sum(1 for a in airframes if not a.get("to"))
    past = sum(1 for a in airframes if a.get("to"))
    with_art = sum(1 for a in airframes if a.get("art"))
    lines = [
        f"*Counted by `tools/stats.py` on {date.today().isoformat()}.*",
        "",
        f"- **{len(schemes)} schemes** from **{len({s['airline'] for s in schemes})} airlines**: {kinds}.",
        f"- **{len(drawn)} drawn** (colored areas you can reproduce); the other {len(schemes) - len(drawn)} are "
        f"described in words only so far. {sum(1 for s in schemes if s.get('titles'))} have their titles set out, "
        f"{sum(1 for s in schemes if s.get('logos'))} their logos placed.",
        f"- **{len({s['airline'] for s in standard})} airlines' everyday schemes** ({len(standard)} with freighter "
        f"and older variants), plus **{len(operators)} operators** that fly in another "
        f"airline's paint (regionals in their mainline's).",
        f"- **{len(airframes)} airframes tagged** (registration, usually its ICAO address, and the scheme it wears): "
        f"{current} current, {past} past; {with_art} with their own tail art.",
        f"- **{count_leads()} leads**: special schemes seen on public lists, not yet researched.",
        "",
        table(Counter(s["confidence"] for s in schemes).most_common(), ("Scheme confidence", "Schemes")),
        "",
        table(Counter(a.get("confidence", "-") for a in airframes).most_common(), ("Airframe confidence", "Airframes")),
        "",
        "Evidence behind each airframe's tag (its first source; most have more than one):",
        "",
        table(Counter(first_source_kind(a) for a in airframes).most_common(), ("Evidence", "Airframes")),
        "",
        "Sources cited by the schemes:",
        "",
        table(
            Counter(kind(src.get("url")) for s in schemes for src in s.get("sources", [])).most_common(),
            ("Source", "Citations"),
        ),
        "",
        table(Counter(f for f, _ in frames).most_common(10), ("Most airframes tagged (airline)", "Airframes")),
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--write", action="store_true", help="replace the README's stats section")
    write = parser.parse_args().write
    text = stats()
    if not write:
        print(text)
        return 0
    readme = ROOT / "README.md"
    s = readme.read_text()
    if START not in s:
        print(f"README.md has no {START} … {END} section", file=sys.stderr)
        return 1
    head, rest = s.split(START, 1)
    _, tail = rest.split(END, 1)
    readme.write_text(f"{head}{START}\n{text}\n{END}{tail}")
    print("README.md: stats updated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
