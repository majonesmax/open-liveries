# Open Liveries

An open description of airline paint schemes that's precise enough to reproduce. It says which colors go where on
the fuselage, fin, wings, winglets and engines, what the titles are and where the logos sit. It also says which
airframe wears which scheme and when. For apps, flight sims, modelers and spotters.

Started for [Skyarium](https://skyarium.app), which draws the real planes overhead in their colors.

**Browse it:** [majonesmax.github.io/open-liveries](https://majonesmax.github.io/open-liveries/). Every scheme from
both sides, from below and in 3D.

## What's here

- `liveries/<ICAO airline>/<id>.json`: one scheme each (`schema/livery.schema.json`). Standard schemes,
  specials, retros and alliance schemes, with when they were introduced and retired. Where one type wears it
  differently the scheme says so in `types`, like Delta's 717 nacelles or the A380s' titles between the decks
  ([docs/COORDINATES.md › Paint for one type](docs/COORDINATES.md#paint-for-one-type)).
- `airframes/<ICAO airline>.json`: which registration (and ICAO 24-bit address) wears which scheme from
  when to when (`schema/airframes.schema.json`). Not listed: the airline's current standard scheme.
- `airlines.json`: the airlines with schemes or tagged jets here by ICAO code, with name and country.
- `operators.json`: operators that fly in another airline's paint (regionals in their mainline's).
- `docs/ARCHITECTURE.md`: how it all fits together. `docs/TUTORIAL.md` is a hands-on start that reads a plane's
  paint and adds a scheme.
- `docs/COORDINATES.md`: where things are. Every position is a share of its part, so one scheme fits any type.
- `shapes/<ICAO type>.json`: real types' outlines in meters, measured from the manufacturers' airport-planning
  drawings (`schema/shape.schema.json`, `docs/SHAPES.md`). They show what a scheme's parts are on an A320 or a 737-800.
- `docs/LOGOS.md`: how logos are described (and why the artwork isn't here).
- `docs/UPDATING.md`: where the data comes from and how it's kept current. `CONTRIBUTING.md` covers how to add or fix
  a scheme and the sourcing rules.
- `renderer/`: draws a scheme as SVG from either side or below. It draws on a built-in narrowbody, widebody or
  regional jet, or on your own aircraft described in a few measurements. It has no dependencies and runs in a
  browser, Node or a build step. It also paints textures for 3D models. `renderer/GUIDE.md` is the developer's guide
  with recipes. Its README is the reference for the API and shape format.
- `examples/svg-viewer/`: a browser of the whole dataset. It has search and filters and shows each scheme in 3D
  (three.js) and from both sides and below, on any of the renderer's shapes or your own, with its sources and
  airframes. It's TypeScript compiled to static files with no runtime dependencies. The compiled `js/` is committed
  so it hosts as is. Its README says how to build and lint. Its drawing was first written from these docs alone as a
  test that they're enough. Run `tools/index.py`, then `python3 -m http.server` and open `/examples/svg-viewer/`.

## What's in it

<!-- stats:start -->
*Counted by `tools/stats.py` on 2026-11-24.*

- **340 schemes** from **178 airlines**: 233 standard, 79 special, 23 retro, 5 alliance.
- **292 drawn** with colored areas you can reproduce. The other 48 are described in words only so far. 316 have their titles set out, 299 their logos placed.
- **178 airlines' everyday schemes** (233 with freighter and older variants), plus **92 operators** that fly in another airline's paint (regionals in their mainline's).
- **1448 airframes tagged** (registration, usually its ICAO address, and the scheme it wears): 1438 current and 10 past. 191 have their own tail art.
- **89 leads**: special schemes seen on public lists, not yet researched.

| Scheme confidence | Schemes |
|---|--:|
| medium | 229 |
| high | 83 |
| low | 28 |

| Airframe confidence | Airframes |
|---|--:|
| medium | 721 |
| high | 385 |
| low | 342 |

Evidence behind each airframe's tag, by its first source (most have more than one):

| Evidence | Airframes |
|---|--:|
| dated photo (Wikimedia Commons) | 562 |
| aircraft database (adsbdb) | 250 |
| where it flies (adsb.lol flight history) | 238 |
| the airline or its press release | 161 |
| Wikipedia | 76 |
| FAA aircraft registry | 63 |
| aviation press and other | 59 |
| spotter fleet list (names only) | 31 |
| aircraft database (hexdb) | 8 |

Sources cited by the schemes:

| Source | Citations |
|---|--:|
| dated photo (Wikimedia Commons) | 1182 |
| aviation press and other | 164 |
| Wikipedia | 140 |
| the airline or its press release | 57 |

| Most airframes tagged (airline) | Airframes |
|---|--:|
| SKW | 531 |
| RPA | 204 |
| FFT | 193 |
| CFR | 50 |
| GTI | 39 |
| CFG | 37 |
| QTR | 28 |
| ASA | 25 |
| KAL | 23 |
| UAE | 21 |
<!-- stats:end -->

How these are gathered and what to rerun to keep them current: [docs/UPDATING.md](docs/UPDATING.md).

## Logos

The logos themselves aren't here. Each one is its airline's artwork and is protected by copyright and trademark. A
CC0 dataset can't give away what isn't ours. Instead every logo on a scheme says which mark it is (`mark`), where it
sits (`place`, `at` its center), how big it is (`height`), its colors (`colors`), what it looks like in words
(`description`) and where to see it (`reference`). A `mark` is an id like `DAL/widget` that's shared by every
scheme that carries it. More in [docs/LOGOS.md](docs/LOGOS.md).

**Drawing your own.** Draw each mark once as a few simple shapes, keyed by its `mark` id. Aim for a simplification
that reads at the size it's seen, not a trace of the artwork. Here's a format that works. It's what Skyarium uses
for its hundred or so marks.

```json
"DAL/widget": {
  "aspect": 1.1,
  "mirror": true,
  "shapes": [
    { "c": 0, "p": [[0, 0], [1.1, 0], [0.55, 1]] },
    { "c": 1, "p": [[0.55, 0], [1.1, 0], [0.55, 1]] }
  ]
}
```

- Shapes sit in a box `aspect` wide and 1 tall. In it y points up and x points toward the tail as seen from the
  left side, with the nose to the left.
- `c` is a hex color or a slot in the logo's `colors` (0, 1, …). With slots one mark serves every scheme that
  colors it differently.
- `mirror: true` flips it on the right side so it faces forward on both sides. That's how flags are painted.
- `"smooth": true` on a shape draws it as a curve through its points, the same as for a scheme's areas
  ([docs/COORDINATES.md](docs/COORDINATES.md) › Curved outlines). It's sharp only at points written `[x, y, 1]`
  because a mark's box has no part edges to stay sharp at. Most artwork is curves, like a formline ovoid or a swoosh.
  Drawn as straight polygons it looks faceted at any size.
- To place it, center it on `at` and scale it so it's `height` times the part's height
  ([docs/COORDINATES.md](docs/COORDINATES.md) › Logos and titles). On the fin it stays upright and undistorted.
- Check it against the `reference` and a photo, at the size it will be seen.

An app that uses an airline's real artwork instead gets it from the airline and makes its own call. Most
flight trackers do that for airline logos.

## Every fact has a source and a confidence

Each scheme lists its sources, and parts can say which source they rest on. Confidence is `high`, `medium`, `low`
or `approximate`. `high` means an official source or recent photos agree. `approximate` means drawn from memory of
photos and still to be checked. The first standard schemes came in as `approximate` and have all been redrawn from
photos since.

Good sources are the airline's own press releases and brand pages, Wikipedia and Wikimedia Commons' registration
categories of dated, openly licensed photos. The airline's own press and newsroom images of a scheme count too,
since it published them to show the livery. They're measured from but never copied or shipped, and they're cited in
the scheme's sources as an airline press photo. Photo sites' and spotters' images are copyrighted. They can be
evidence that a scheme exists, but nothing is copied or measured from them.

## Tools

Python 3.11 or later. `tools/validate.py` needs `jsonschema` and the rest only the standard library. Each tool's
`--help` says what it takes.

```sh
python3 -m venv .venv && .venv/bin/pip install jsonschema
.venv/bin/python -I tools/validate.py          # schemas, palette names, sources, airframe references
.venv/bin/python -I tools/preview.py [BAW ...]  # build/preview/index.html: each scheme from the side and below
.venv/bin/python -I tools/stats.py --write      # the stats above, recounted
.venv/bin/python -I tools/index.py              # index.json: every scheme, defaults, registrations, alsoFlies (for the viewer)
.venv/bin/python -I tools/export_compact.py OUT.json   # one compact file for apps: drawn schemes, by address
.venv/bin/python -I tools/export_shapes.py OUT.json    # the measured shapes, compact (whole cm, thinned): ~146 KB
```

Gathering: `tools/photos.py` (Commons photos of an airframe), `tools/seen.py` (is each tagged jet flying),
`tools/import_research.py` (researched specials in) and the regional-partner tools. Those are
`tools/regional_partners.py`, `regional_blocks.py`, `regional_brands.py` and `regional_merge.py`, which work out
whose paint a SkyWest or Republic jet wears ([docs/UPDATING.md](docs/UPDATING.md)).
Measuring and checking a scheme: `tools/photo_trace.py` (fit a photo to a measured shape, probe and trace paint
edges, overlay a scheme), `tools/smoothing_review.py` (areas that look like sampled curves) and `tools/sheet.py`
(before and after renders beside photos).
Shared by them: `tools/common.py` (paths, reading and writing in the repo's format, colors), `tools/shapes.py`
(the files' shapes, for type checking), `tools/runways.py` with `tools/hub_runways.json` (runways at the
partners' hubs, from OurAirports, public domain).

### Developing

The tools are checked with [ruff](https://docs.astral.sh/ruff/) (lint and format) and
[mypy](https://mypy-lang.org/) (strict), set up in `pyproject.toml`. Before committing a change to `tools/`:

```sh
.venv/bin/pip install --group dev   # ruff, mypy, types-jsonschema
.venv/bin/ruff check && .venv/bin/ruff format --check && .venv/bin/mypy
.venv/bin/python -I tools/validate.py
```

The renderer and the viewer are TypeScript and need Node 20 or later. Run `npm install`, then `npm run build`,
`npm run lint` and `npm run check`. The check renders every scheme on every shape and fails on a broken picture.
Their compiled output (`renderer/dist/`, `examples/svg-viewer/js/`) is committed, so rebuild it with each change.

`ruff format` (without `--check`) formats in place. A change to a tool shouldn't change what it writes unless
that's the point. Compare its output (`index.json`, `export_compact.py`'s file, `build/preview/`) before and after.

## License

The data (`liveries/`, `airframes/`, `shapes/`, `operators.json`) is [CC0](LICENSE-DATA). Use it for anything. The
tools are MIT (`LICENSE`). Airline names, logos and liveries are their owners' trademarks. This dataset
describes them so they can be recognized and claims nothing over them.

## Leads

`leads.tsv`: special liveries seen on public lists (registration and name only), not yet researched. A lead
becomes an entry once a dated source shows the scheme on that airframe. Until then it's only a lead.
