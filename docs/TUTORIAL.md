# Tutorial

Two walkthroughs: using the data (find and draw the paint on a real plane), then adding to it (a new special
scheme on one jet). The map of the whole repository is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Setup

```sh
python3 -m venv .venv && .venv/bin/pip install jsonschema
.venv/bin/python -I tools/validate.py        # "221 liveries, 36 airframe files: ok" (or the current counts)
.venv/bin/python -I tools/index.py           # index.json, for the viewer
python3 -m http.server                       # then open http://localhost:8000/examples/svg-viewer/
```

The viewer is the quickest way to get a feel for the data: search for `N1776R` and open Southwest's Independence
One, or `BAW` for British Airways' schemes.

## Part 1: what is that plane wearing?

Say an ADS-B receiver reports a Southwest 737 with ICAO address `a13668`, callsign `SWA1776`.

**1. Is that airframe listed?** Look through `airframes/*.json` for the address (or the registration, if you
have it):

```json
{
  "registration": "N1776R",
  "hex": "a13668",
  "livery": "independence-one",
  "confidence": "high",
  "sources": [{ "url": "https://www.prnewswire.com/…", "accessed": "2026-11-12" }]
}
```

It's in `airframes/SWA.json`, so its scheme is `liveries/SWA/independence-one.json`. A `livery` with a slash
(`"DAL/connection"`) points at another airline's folder. An entry with a `to` date is history, not what it wears
now.

**2. If not, use the airline's default.** The callsign's first three letters are the ICAO airline code (`SWA`).
If it's in `operators.json`, use the scheme it `wears` (a regional in its mainline's paint). Otherwise the
airline's default: its current `standard`-kind scheme marked `commonest`, else `liveries/SWA/standard.json`.
`index.json` has that already worked out (`"default": true`).

**3. Read the scheme.** The top of `liveries/SWA/standard.json`:

```json
{ "id": "standard", "airline": "SWA", "name": "Heart (2014)", "kind": "standard", "confidence": "high", "from": "2014-09" }
```

Then the parts. Colors are named in the scheme's `palette` (`"blue": { "hex": "#304CB2" }`) and used by name. A
fuselage area:

```json
{ "name": "white pinstripe ahead of the yellow", "color": "white",
  "points": [[0.592, -1], [0.604, -1.0], [0.698, -0.758], [0.751, -0.015], [0.779, 0.406], [0.789, 1], [1, 1], [1, -1]] }
```

x runs 0 at the nose to 1 at the tail; y from −1 at the belly's centerline to 1 at the crown, round the side (y 0
is about the bottom of the windows). In a side view, y is drawn at `r · sin(y · 90°)` above the centerline. Full
rules: [COORDINATES.md](COORDINATES.md).

A title:

```json
{ "text": "Southwest", "place": "fuselage", "at": [0.174, 0.13], "height": 0.679, "color": "white",
  "type": { "similar": ["Avenir Next Bold", "Gotham Bold"], "weight": 700 } }
```

`at` is the left end of the baseline as seen from the left; `height` is the cap height in the same y units (the
fuselage's full height counts as 2). On the right side the title covers the same stretch and reads normally.

A logo:

```json
{ "mark": "SWA/heart", "place": "fuselage", "at": [0.155, 0.485], "height": 0.131,
  "colors": ["blue", "red", "yellow"], "reference": "https://commons.wikimedia.org/wiki/File:Southwest_Airlines_logo_2014.svg" }
```

`at` is its center. The artwork isn't included: draw the mark yourself (README › Logos) or show a placeholder.

**4. Draw it, in this order:** the base color; the areas as listed; the radome; titles; logos; then the windows,
which are glass and show through any paint (COORDINATES.md › Paint order). The renderer (`renderer/`) does
exactly this, if you'd rather read code, or use it: `renderSide(scheme)` returns the SVG.

## Part 2: add a special scheme

Say a jet has just been painted in a new special scheme, and there are dated photos of it on Wikimedia Commons.

**1. Gather evidence.** `.venv/bin/python -I tools/photos.py N123AB` fetches the airframe's Commons photos to
`build/photos/N123AB/`, newest first, with each one's date, author and license (`tools/photos.py "File:…"` fetches
one named Commons file the same way). Prefer side-on photos of both sides, recent, in daylight. The airline's press release usually gives the name and the date it was unveiled.

**2. Write the scheme.** Copy a similar scheme as a starting point (`liveries/SWA/colorado-one.json` for a fuselage
wrap) to `liveries/<ICAO>/<id>.json`, where `<id>` is a short slug of the name. Set `id`, `name`, `kind:
"special"`, `from`, `description` (a paragraph a person could paint from) and `sources` (each photo and the press
release, with `accessed` dates). Then measure from the photos: areas as polygons in fuselage space, the fin's
areas in fin space, titles and logos with their positions and heights. Give each part `sourceRefs` (indexes into
`sources`) and a `confidence` (`high` when photos agree, `medium` from a couple, `low` from one).

   **Curves and corners.** Look at each paint edge on the photo before measuring it:
   - **It curves** (a sweep, a swoosh, a band that bends up to the crown): put points along it, about one every
     meter or two of the aircraft and closer where it bends, and give the area `"smooth": true`. The curve is drawn
     through the points, so they must be on the edge: a few points roughing in the shape make blobs when smoothed.
   - **It's straight with real corners** (a window band, flag stripes, a chevron): leave the area as it is; straight
     lines between points are the default.
   - **Both:** a smooth area with a real corner inside it marks that point `[x, y, 1]`. Points on the part's edge
     (x 0 or 1, the crown or the belly) are sharp already.
   - **It continues onto another part** (a swoop running up the fin, a band round the engine): measure where it
     meets that part's edge on both parts, so the two line up (the fin's band starts at the fin's root where the
     fuselage's reaches the crown).

   **Art liveries** (a painted character, formline art covering the fuselage): the areas capture the major colour
   fields, where each colour covers the aircraft at the scale of the big masses (about half a meter and up), so the
   scheme reads right in its colours. The artwork's linework and detail stay a logo: described and placed
   ([LOGOS.md](LOGOS.md)), not reproduced. `tools/photo_trace.py fields` reads those fields off a photo.

**3. Tag the airframe.** In `airframes/<ICAO>.json`:

```json
{ "registration": "N123AB", "hex": "a0b1c2", "livery": "my-new-special", "from": "2026-11", "confidence": "high",
  "sources": [{ "url": "https://commons.wikimedia.org/wiki/File:…", "accessed": "2026-11-14" }] }
```

A US registration's address is a calculation (`tools/nnumber.py`); `validate.py` checks it.

**4. Check it.**

```sh
.venv/bin/python -I tools/validate.py              # must say ok
.venv/bin/python -I tools/preview.py <ICAO>/<id>   # build/preview/index.html: side and below, next to your photos
.venv/bin/python -I tools/sheet.py <ICAO>/<id> PHOTO   # build/sheets/<ICAO>-<id>.png: renders before and after, by the photo
.venv/bin/python -I tools/stats.py --write         # the README's numbers
.venv/bin/python -I tools/index.py                 # the viewer's index
```

Look at the preview next to the photos and adjust until the shapes land where the paint does. Then commit.

**5. If the scheme retires.** Don't delete anything: give the scheme and its airframe entries a `to` date.

## Where next

- [COORDINATES.md](COORDINATES.md): every rule for positions, sizes, sides and paint order.
- [UPDATING.md](UPDATING.md): where each kind of fact comes from and how it's kept current.
- [CONTRIBUTING.md](../CONTRIBUTING.md): the sourcing rules and the checks a change has to pass.
