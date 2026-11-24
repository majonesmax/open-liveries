# How Open Liveries fits together

A map of the repository for someone opening it for the first time: what the data is, how the files relate, where
the tools sit, and who reads the result. For a hands-on start, see [TUTORIAL.md](TUTORIAL.md).

## The idea in one paragraph

A plane's paint is described as data, not as a picture: which colors go where on each part (fuselage, fin, wings,
winglets, engines), where the titles and logos sit, how big, in what lettering. Positions are shares of each part
(0 at the nose, 1 at the tail), so one description fits any aircraft type. Separately, the dataset records which
real airframe wears which scheme. With the two, an app that knows a plane's ICAO address or registration (from
ADS-B, say) can paint it correctly: the special on that one jet, or else its airline's everyday scheme.

## The data

```
airlines.json             ICAO code → name and country (the airlines with schemes or tagged jets here)
liveries/<ICAO>/<id>.json  one paint scheme each: standard, special, retro, alliance
airframes/<ICAO>.json      which registration (and ICAO address) wears which scheme, and since when
operators.json             operators flying in another airline's paint (regionals in their mainline's)
leads.tsv                  specials seen on public lists, not yet researched
schema/*.schema.json       JSON Schema for each kind of file
```

How they connect:

```
          airlines.json
               │ names every airline below
               ▼
 liveries/BAW/standard.json ◄──────── airframes/BAW.json ("livery": "landor-retro" → liveries/BAW/landor-retro.json)
 liveries/BAW/landor-retro.json        airframes/SKW.json ("livery": "DAL/connection" → another airline's scheme)
               ▲
               │ "wears": "AAL/eagle"
          operators.json (ENY, Envoy)
```

- **A scheme** (`liveries/`) is the unit of paint. Its parts: a `palette` of named colors; `fuselage` and `fin`
  with a base color and `areas` (polygons, or the `below`/`above` line shorthands); `wings`, `winglets`,
  `engines`, `stabilizer` colors; `titles` (text, position, cap height, lettering) and `logos` (which mark, where,
  how big, which colors, described in words). Every part cites `sources` and has a `confidence`.
- **An airframe entry** (`airframes/`) ties a registration to a scheme over a span of time, with its ICAO 24-bit
  address and the evidence. An airline's everyday scheme isn't listed per airframe: an airframe appears only when
  it wears something else (a special, a freighter scheme, a partner's paint, its own tail art).
- **The default scheme** of an airline is its current `standard`-kind scheme marked `commonest`, else the one with
  id `standard` (docs/COORDINATES.md › The airline's default scheme).
- **Coordinates** are the core convention: [COORDINATES.md](COORDINATES.md). Logos are described, never included:
  [LOGOS.md](LOGOS.md).

## The tools

All in `tools/`, Python 3.11+, standard library plus `jsonschema`; typed (mypy strict) and linted (ruff).

```
            research ──────────────► photos.py (Commons photos of a registration, dated and licensed)
               │                                     │
   import_research.py (a research file → schemes      │ measured by hand or by an agent
    described in words + airframe tags)               ▼
               └──────────► liveries/, airframes/ ◄── drawing: areas, titles, logos
                                     │
              validate.py ◄──────────┤ schemas, palette names, source references, airframes → schemes,
                                     │ N-number addresses, no registration current twice
              preview.py ◄───────────┤ build/preview/: every scheme from the side and below, to check by eye
              stats.py ◄─────────────┤ the README's numbers
              index.py ◄─────────────┤ index.json, for the viewer
              export_compact.py ◄────┘ one compact file for apps (Skyarium bundles it)

  shapes/ ──► export_shapes.py: the measured shapes, compact, for apps that build their own models
```

Keeping airframe tags current (all write `airframes/`; how often is in [UPDATING.md](UPDATING.md)):

- `seen.py`: which tagged jets are flying now (adsb.lol), confirming addresses.
- `regional_partners.py` (logs), then `regional_blocks.py` → `regional_brands.py` → `regional_merge.py`: whose paint
  a SkyWest or Republic jet wears, from its registration block (FAA registry), adsbdb, and who it flies for (adsb.lol
  history: its flight numbers, else where it flies, `runways.py` + `hub_runways.json`).
- `nnumber.py`: a US registration's ICAO address, by calculation.

Shared code: `common.py` (paths, reading and writing JSON in the repository's format, colors, area polygons) and
`shapes.py` (the files' shapes as typed dictionaries).

## Who reads it

- **The renderer** (`renderer/`): the reference drawing of the spec, in TypeScript with no dependencies. A
  scheme in, SVG out, from either side or below, on a built-in shape (narrowbody, widebody, regional) or one
  described in meters (fuselage length and radius, fin, wing, tailplane and engine positions). Logos come from
  a painter the caller passes, else a placeholder. It also paints textures for a 3D model: the fuselage unrolled
  in its own coordinates, the fin as seen from each side.
- **The viewer's 3D view** (`examples/svg-viewer/src/three/`): a three.js aircraft built from a shape, wearing
  those textures.
- **Skyarium** (the app it was started for) bundles `export_compact.py`'s output and draws planes in their paint,
  with its own simplified logo shapes; and `export_shapes.py`'s, to build its paper models of the measured types
  (a prototype, 2026-11-16).
- **The viewer** (`examples/svg-viewer/`): a static site in TypeScript that draws every scheme from both sides and
  below with the renderer, on any of its shapes, with its sources and airframes. Its drawing was first written
  from these docs alone, as a test that they're enough.
- **Anyone else**: the files are plain JSON under CC0, validated by their schemas.

## Principles

- **Every fact has a source** (`sources`, with `sourceRefs` on each part) and a `confidence`. Inferences (where a
  jet flies) say so and rank below photos.
- **Photos as evidence, never as content.** Openly licensed Commons photos are measured; copyrighted photo sites
  can show a scheme exists but nothing is copied from them.
- **No artwork.** Logos are described and placed; drawing them is up to the app.
- **Nothing is deleted.** A retired scheme or a repainted jet gets a `to` date.
