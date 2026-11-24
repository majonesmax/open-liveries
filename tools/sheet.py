"""A contact sheet for checking a scheme's change: its renders before and after, left and right, on the built-in
shape and (with --shape) a measured one, above one or two photos, as one PNG.

"Before" is the scheme as committed (HEAD, or --rev), "after" the working file. The renders come from the renderer
(node renderer/dist/cli.js) and are rasterized by headless Chrome, which honours a title's `textLength`: a
rasteriser that ignores it draws titles at their typeface's own length and hides the problems worth seeing.
Usage: .venv/bin/python -I tools/sheet.py ICAO/id [PHOTO ...] [--shape shapes/B738.json] [--rev REV] [--out OUT.png]
       (--no-builtin with --shape: only the measured shape's rows)
       → build/sheets/ICAO-id.png (its SVGs and page in build/sheets/ICAO-id/)

Needs Node with the renderer built (`npm run build`), git, Pillow (`.venv/bin/pip install --group photos`) and
Chrome or Chromium: $CHROME, else the first found on the PATH or in its usual macOS place."""

import argparse
import html
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import LIVERIES, ROOT


def chrome() -> str:
    """Headless Chrome's command: $CHROME, else the first Chrome or Chromium found."""
    for candidate in (
        os.environ.get("CHROME"),
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ):
        if candidate and Path(candidate).exists():
            return candidate
    raise SystemExit("No Chrome or Chromium found: set $CHROME to its path.")


WIDTH = 1400  # the sheet's width in pixels: two renders side by side, or the photos across it
LABEL = 24  # a row label's height
PHOTO_HEIGHT = 520  # the photos row's height, at most
BACKGROUND = (0xCF, 0xD8, 0xE3)


def render(scheme: Path, view: str, shape: str | None, out: Path) -> Path:
    """One render of a scheme file to an SVG file."""
    cmd = ["node", str(ROOT / "renderer/dist/cli.js"), str(scheme), "--view", view]
    if shape:
        cmd += ["--shape", shape]
    out.write_text(subprocess.run(cmd, check=True, capture_output=True, text=True, cwd=ROOT).stdout)
    return out


def aspect(svg: Path) -> float:
    """An SVG's height over its width, from its viewBox."""
    found = re.search(r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"', svg.read_text()[:500])
    return float(found.group(2)) / float(found.group(1)) if found else 0.35


def photo_aspect(photo: Path) -> float:
    from PIL import Image

    with Image.open(photo) as im:
        return im.height / im.width


def trim(png: Path) -> None:
    """Cut the screenshot's empty background off its foot."""
    from PIL import Image, ImageChops

    with Image.open(png) as im:
        rgb = im.convert("RGB")
    box = ImageChops.difference(rgb, Image.new("RGB", rgb.size, BACKGROUND)).getbbox()
    if box:
        rgb.crop((0, 0, rgb.width, min(rgb.height, box[3] + 8))).save(png)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("scheme", help="ICAO/id, as under liveries/")
    ap.add_argument("photos", nargs="*", type=Path, help="one or two photos to put under the renders")
    ap.add_argument("--shape", help="also render on this measured shape (shapes/<TYPE>.json)")
    ap.add_argument("--builtin", help="the built-in shape to render on (the renderer's default if not given)")
    ap.add_argument("--no-builtin", action="store_true", help="with --shape: only the measured shape's rows")
    ap.add_argument("--rev", default="HEAD", help="the revision 'before' is taken from (default HEAD)")
    ap.add_argument("--out", type=Path, help="the PNG (default build/sheets/ICAO-id.png)")
    a = ap.parse_args()
    if len(a.photos) > 2:
        raise SystemExit("one or two photos")
    rel = Path("liveries") / f"{a.scheme}.json"
    after = LIVERIES / f"{a.scheme}.json"
    if not after.exists():
        raise SystemExit(f"no {rel}")
    name = a.scheme.replace("/", "-")
    work = ROOT / "build/sheets" / name
    work.mkdir(parents=True, exist_ok=True)
    out: Path = a.out or ROOT / "build/sheets" / f"{name}.png"

    versions = [("after", after)]
    old = subprocess.run(["git", "show", f"{a.rev}:{rel}"], capture_output=True, text=True, cwd=ROOT)
    if old.returncode == 0:
        before = work / "before.json"
        before.write_text(old.stdout)
        versions.insert(0, ("before", before))
    else:
        print(f"{rel} isn't in {a.rev}: no 'before' rows")

    # (label, the renderer's --shape, file suffix)
    shapes: list[tuple[str, str | None, str]] = []
    if not (a.no_builtin and a.shape):
        shapes.append((f"built-in shape {a.builtin or ''}".strip(), a.builtin, ""))
    if a.shape:
        shapes.append((f"measured shape {Path(a.shape).stem}", str(Path(a.shape).resolve()), "-m"))
    rows: list[tuple[str, list[Path]]] = []
    for shape_label, shape, suffix in shapes:
        for tag, scheme in versions:
            cells = [render(scheme, view, shape, work / f"{tag}-{view}{suffix}.svg") for view in ("left", "right")]
            source = a.rev if tag == "before" else "working file"
            rows.append((f"{tag} ({source}), {shape_label}: left, right", cells))

    bg = "#" + "".join(f"{c:02x}" for c in BACKGROUND)
    page = [f"<html><body style='margin:0;background:{bg};font:14px -apple-system,sans-serif'>"]
    height = 0
    for label, cells in rows:
        page.append(f"<div style='height:{LABEL}px;padding:4px 8px;box-sizing:border-box'>{html.escape(label)}</div>")
        page.append("<div style='display:flex'>")
        page += [f"<img src='{c.as_uri()}' style='width:50%'>" for c in cells]
        page.append("</div>")
        height += LABEL + round(WIDTH / 2 * max(aspect(c) for c in cells))
    if a.photos:
        each = WIDTH // len(a.photos)
        tallest = max(each * photo_aspect(p) for p in a.photos)
        row = min(PHOTO_HEIGHT, round(tallest))
        page.append("<div style='display:flex;justify-content:center'>")
        for p in a.photos:
            page.append(
                f"<img src='{p.resolve().as_uri()}' style='max-width:{each}px;height:{row}px;object-fit:contain'>"
            )
        page.append("</div>")
        height += row
    page.append("</body></html>")
    sheet = work / "sheet.html"
    sheet.write_text("\n".join(page) + "\n")

    profile = tempfile.mkdtemp(prefix="sheet-chrome-")
    try:
        subprocess.run(
            [
                chrome(),
                "--headless",
                "--disable-gpu",
                "--hide-scrollbars",
                "--allow-file-access-from-files",
                f"--user-data-dir={profile}",
                f"--window-size={WIDTH},{height + 200}",  # some room: the page is trimmed to its content after
                f"--screenshot={out.resolve()}",
                sheet.as_uri(),
            ],
            check=True,
            capture_output=True,
        )
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    trim(out)
    print(f"→ {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
