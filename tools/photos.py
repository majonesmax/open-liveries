"""Fetch openly licensed photos of an airframe from Wikimedia Commons (its 'Category:REG (aircraft)'), to
check a livery against: build/photos/REG/, newest first, with each file's date, author and license.
Usage: .venv/bin/python -I tools/photos.py REG [count]
       .venv/bin/python -I tools/photos.py "Category:Airbus A320neo of Lufthansa" [count]   (any Commons category)
       .venv/bin/python -I tools/photos.py "File:N8524Z Southwest 737-800.jpg"   (one named file, as a scheme cites
       it, or its Commons page's URL: build/photos/<its name>/, 1920 px wide)
A category's members that aren't images (videos, PDFs) are skipped."""

import argparse
import html
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, NamedTuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, fetch_json, request

API = "https://commons.wikimedia.org/w/api.php"


class Photo(NamedTuple):
    taken: str  # YYYY-MM-DD, or "" if Commons doesn't say
    title: str
    url: str
    artist: str
    license: str


def get(params: dict[str, str]) -> Any:
    """A Commons API query's JSON."""
    return fetch_json(API + "?" + urllib.parse.urlencode({**params, "format": "json"}))


def query_photos(params: dict[str, str], width: int) -> list[Photo]:
    """The images a query's pages are, newest first by the date taken (else uploaded). Commons scales at most 50
    images per request, so the rest of a page's image info comes in follow-up requests (`iicontinue`)."""
    base = {**params, "prop": "imageinfo", "iiprop": "url|extmetadata|timestamp|mime", "iiurlwidth": str(width)}
    pages: dict[str, dict[str, Any]] = {}
    more: dict[str, str] = {}
    while True:
        d = get({**base, **more})
        for key, page in d.get("query", {}).get("pages", {}).items():
            pages.setdefault(key, page).update({k: v for k, v in page.items() if k == "imageinfo"})
        more = d.get("continue", {})
        if "iicontinue" not in more:
            break  # the rest is the next batch of members (gcmcontinue): up to 100 is enough
    photos = []
    for page in pages.values():
        info = (page.get("imageinfo") or [{}])[0]
        if not str(info.get("mime", "")).startswith("image/") or "thumburl" not in info:
            continue  # a video, a PDF, or a member Commons didn't return image info for
        meta = info.get("extmetadata", {})
        artist = html.unescape(re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", ""))).strip()
        license = meta.get("LicenseShortName", {}).get("value", "")
        photos.append(Photo(taken(meta, info), page["title"], info["thumburl"], artist, license))
    photos.sort(reverse=True)
    return photos


def taken(meta: dict[str, Any], info: dict[str, Any]) -> str:
    """The date taken, YYYY-MM-DD (or YYYY-MM, YYYY), from Commons' free-text field, else the upload date."""
    for text in (meta.get("DateTimeOriginal", {}).get("value", ""), info.get("timestamp", "")):
        found = re.search(r"\b(19|20)\d\d(-\d\d){0,2}\b", str(text))
        if found:
            return found.group(0)
    return ""


def category_photos(category: str) -> list[Photo]:
    """The category's images (up to 100 members), newest first."""
    params = {"action": "query", "generator": "categorymembers", "gcmtitle": category, "gcmtype": "file"}
    return query_photos({**params, "gcmlimit": "100"}, 1400)


def file_photo(title: str) -> list[Photo]:
    """One named file ("File:…"), if it's an image."""
    return query_photos({"action": "query", "titles": title}, 1920)


def folder_name(name: str) -> str:
    return name.replace(" ", "_").replace("/", "_")[:80]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("reg", help="a registration, a Commons category ('Category:…') or one file ('File:…')")
    parser.add_argument("count", type=int, nargs="?", default=4, help="how many to fetch (default 4)")
    args = parser.parse_args()
    reg: str = urllib.parse.unquote(args.reg.split("/wiki/")[-1]).replace("_", " ")

    if reg.startswith("File:"):
        photos = file_photo(reg)
        out = ROOT / "build/photos" / folder_name(Path(reg.removeprefix("File:")).stem)
        found = f"{reg}: {'found' if photos else 'not found, or not an image'}"
    else:
        category = reg if reg.startswith("Category:") else f"Category:{reg} (aircraft)"
        photos = category_photos(category)
        out = ROOT / "build/photos" / folder_name(reg.removeprefix("Category:"))
        found = f"{len(photos)} images in the category"
    if not photos:
        print(found)
        return 1
    out.mkdir(parents=True, exist_ok=True)
    lines = []
    for i, photo in enumerate(photos[: args.count]):
        dest = out / f"{i}-{photo.taken or 'undated'}.jpg"
        with urllib.request.urlopen(request(photo.url), timeout=60) as r:
            dest.write_bytes(r.read())
        lines.append(f"{dest.name}\t{photo.taken}\t{photo.title}\t{photo.license}\t{photo.artist[:80]}")
    (out / "credits.tsv").write_text("\n".join(lines) + "\n")
    print(f"{found}; fetched {len(lines)} → {out}")
    for line in lines:
        print(" ", line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
