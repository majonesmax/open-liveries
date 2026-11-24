# How it's built and kept up to date

Every number in the README's stats comes from the files (`tools/stats.py --write`); this is where those files
come from, and what to rerun to keep them true. Airlines repaint, lease jets out and move regional jets between
partners, so the airframe tags age: each kind of fact below says how it goes stale and how it's refreshed.

## Schemes (`liveries/`)

- **Drawn from dated photos.** Each scheme's areas, titles and logo places are measured off openly licensed,
  dated photos on Wikimedia Commons or, where Commons has none, off the airline's own press or newsroom images of
  the scheme (cited as `airline press photo`; measured only, nothing copied) (`tools/photos.py REG` fetches an airframe's, with date, author and license;
  `tools/photos.py "File:…"` one a scheme cites), checked side and below against `tools/preview.py`. Curved paint edges are measured as points along the curve
  and marked `"smooth": true` (TUTORIAL.md, step 2); `tools/smoothing_review.py` lists existing areas that look
  like sampled curves, to recheck against their photos. `tools/photo_trace.py` measures off a photo instead of by eye:
  it fits the photo to the type's measured shape (`shapes/`), camera angle included, follows a paint edge between a
  few points, says where any pixel is on the fuselage or fin (`probe`: a title's ends, a logo's middle, a band's
  edge), reads an art livery's major colour fields, and draws a scheme back over the photo to check it, either side
  (`overlay --side right` on a flipped right-side photo). `tools/sheet.py ICAO/id PHOTO --shape shapes/<TYPE>.json`
  puts a change's renders, before (as committed) and after, left and right, beside the photos in one PNG. What
  validating it on specials showed (2026-11-15):
  - **Pin the camera with the doors** (`door-fwd`, `door-aft`) and say `camera=above` or `below`: outlines alone
    can't tell how far off level the camera is, near level, nor which way, and a wrong angle shifts every paint edge
    up or down the fuselage (a level photo came out 35° off without them).
  - **`fields` is for art liveries only** (the fuselage covered in artwork, where the current areas are a rough
    guess). On stripes and cheatlines it does worse than careful measuring: it copies the photo's noise (title
    letters, windows, shadow) and loses thin lines. Refine those with `trace` (one edge between a few points), or
    leave them be.
  - **Judge on a photo the version wasn't traced from, and look at the render.** `score` catches big errors (an
    art livery at 52% agreement against 85% traced) but can't rank close versions: a few points either way is noise,
    and a version that copies the photo's noise can score higher than a better one. Never replace a scheme's areas on
    the score alone.
  - **Check each photo's date against the scheme's:** an airframe's Commons category mixes in its earlier liveries,
    and misfiled photos (the Salmon's sources cite a Delta 757). The airline's own brand pages and press releases settle
  colors and dates where they exist. Photo sites' images are copyrighted: evidence that a scheme exists, never
  copied.
- **Confidence** says how sure: `high` when an official source or several recent photos agree, `medium` from a
  couple of photos, `low` from one, `approximate` from memory (the first standard schemes came in that way and have since all been
  redrawn from photos). Colors are
  by eye unless a source gives them (`official: false`).
- **Specials** start as **leads** (`leads.tsv`: a registration and a name seen on a public list). A lead becomes a
  scheme once a dated source shows that livery on that airframe: `tools/import_research.py` brings a research file
  in as schemes described in words, then they're drawn like any other.
- **Goes stale when** an airline rebrands or a special is painted over: `to` closes the scheme (and its airframes);
  nothing is deleted.

## Airframes (`airframes/`)

Which registration wears which scheme, with its ICAO 24-bit address (what ADS-B receivers see). The airline's
everyday scheme isn't listed: an airframe only appears when it wears something else (a special, a freighter
scheme, a partner's paint, its own tail art). Tagged in these ways, strongest first:

| How | Confidence | Tools |
|---|---|---|
| A dated photo of that airframe in that scheme (Commons) | high / medium by date | `tools/photos.py` |
| The airline's own page for the jet (Frontier's plane tails) | high with a photo, else medium | |
| Wikipedia fleet lists, aviation press | medium | |
| The FAA registry: the US owner for an N-number (a regional's partner, a freighter operator) | medium | |
| A partner's own jet in a registration block whose tagged jets all wear its scheme, one by a photo | medium | below |
| An aircraft database's operator name (adsbdb) where its flying agrees | medium | below |
| Who it flies for: two weeks of adsb.lol flight history, every week under one partner's flight numbers (or at its hubs alone) | low | below |
| A spotter fleet list (names only, never images) | low | |

- **Addresses:** a US N-number's address is a calculation (`tools/nnumber.py`; `validate.py` checks every one),
  others come from the registry or an aircraft database. `tools/seen.py` asks adsb.lol which tagged jets are flying
  now, confirms the address and sets `lastSeen`: evidence the airframe exists and flies, not of its paint.
- **Per-jet art** (`art`: Frontier's animals, each jet's own) comes from the airline's pages and the name painted
  on the nose in Commons photos; where the two disagree, the dated photo wins.

### Regional partners (SkyWest, Republic)

They fly for several mainlines under their own callsign prefix, so the prefix can't say whose paint a jet wears.
Four passes, in order; the last three are inferences and say so in their sources:

1. **Registry and photos:** the FAA registry's owner and dated Commons photos (high/medium).
2. **The registration block** (medium, `tools/regional_blocks.py`, since 2026-11-16): a partner buys its regional
   jets in batches, registers each batch in a block of N-numbers (Delta's N6xxCZ E175s, United's N6xxUX) and has
   one regional fly them in its paint. An untagged jet is given its block's scheme when the FAA registry names the
   partner itself as owner, at least 3 of its block (same owner, N-number length, first digit and letters) are
   tagged and every one wears that partner's same scheme, one of them seen in it in a dated photo (which settles
   United's 2019 or 2010 scheme), and neither its own flying nor adsbdb puts it with another partner. A jet the
   last check stops is listed, not tagged.
3. **The operator name** an aircraft database (adsbdb) gives ("United Express", "Delta Connection"), added only
   where the jet's flying (4) doesn't disagree (medium where a week decided, left out where nothing did).
4. **Who it flies for** (low): from adsb.lol's daily history dumps (ODbL), each jet's flights week by week, read
   two ways:
   - **its flight numbers** (since 2026-11-16): the number after SKW or RPA is the partner's marketing flight
     number (SKW3953 flies as DL3953), and each partner has its own ranges (SkyWest's 3000s Alaska, 3500–4499
     Delta, most of 4600–6099 United, 4900s and 6200s–6500s American; Republic's 3300–3799 United, 4300–4899
     American, 5500–5999 Delta, roughly, as of 2026-11). The ranges are learned each run, by hundred, from the
     jets tagged high or medium (a hundred counts with 20 of their flights in it, 95% one partner's). A week
     decides with at least 3 flights in known ranges, 90% one partner's. Checked against the photo-tagged jets: 200 of 201 agree
     (the other, N738EV, in an American Eagle photo, now flies United's numbers); against every tag before
     2026-11-16's additions, 558 of 563.
   - **where it flies**, for a week the flight numbers don't decide: its landings and departures at hubs that
     belong to one partner alone (Delta's ATL DTW MSP SLC, United's DEN IAH SFO EWR IAD, American's DFW CLT PHX MIA
     PHL DCA, Alaska's PDX ANC), at least 4 and 90% at one partner's. Noisier (a partner's spoke flights land at
     the others' hubs): 44 of 48 agreed (92%), one week alone 81%.

   A jet is tagged only when **each of two weeks on its own** decides the same partner, and adsbdb doesn't name
   another. Either way it says who the jet flies for now, not what it's painted: a jet moved between partners keeps
   its old paint for a while, so these stay low until a photo.

The tools for 2 to 4 are `tools/regional_blocks.py`, `regional_brands.py`, `regional_partners.py` and
`regional_merge.py`. They're for the maintainer: a contributor doesn't need them to add or change a scheme. `regional_partners.py
--days N` downloads adsb.lol's daily dumps (3 GB each, one at a time, with the GitHub CLI `gh`), keeps each SKW/RPA
jet's landings and departures at the hubs (with their callsigns) in a small CSV a day and deletes the dump; the
CSVs, and `regional_brands.py`'s adsbdb lookups (`adsbdb.json`), aren't committed (`--store`, default
`build/regionals/`). Landings and departures are matched to runways in `tools/runways.py`,
from `tools/hub_runways.json`: the hubs' runways from OurAirports (public domain;
`tools/runways.py --extract runways.csv airports.csv` rebuilds it from their data if the hubs change). `regional_blocks.py`, `regional_brands.py` and
`regional_merge.py` need the FAA registry's `MASTER.txt` (in the releasable aircraft database, public domain) for
N-numbers by address and owners.

## Keeping it current

| What | How often | Run |
|---|---|---|
| Regional partners (jets move between partners; paint lags) | monthly | `tools/regional_partners.py --days 14`; then, each first without `--write` to check what it lists, `tools/regional_blocks.py MASTER.txt --write`, `tools/regional_brands.py MASTER.txt --write` (its adsbdb lookups are kept a week in the store, for the next step), `tools/regional_partners.py --report OUT.json --weeks 2` and `tools/regional_merge.py OUT.json MASTER.txt --write` (FAA `MASTER.txt` from the releasable database) |
| Is each tagged jet still flying | monthly | `tools/seen.py --write` |
| New specials | as lists and press releases announce them | add to `leads.tsv`; research; `import_research.py` |
| New jets with their own art (Frontier) | when the airline adds them | add to `airframes/FFT.json` from its pages and photos |
| Disagreements to settle with a photo | after each regional run | opened as issues |

After any change: `tools/validate.py` (schemas and cross-references; must pass), `tools/stats.py --write` (the
README's numbers), and `tools/preview.py` to look. Apps that bundle the data (Skyarium) re-export with
`tools/export_compact.py`, and after a change to `shapes/` with `tools/export_shapes.py`.

After a change to the tools themselves: `ruff check`, `ruff format --check` and `mypy` (README, Developing), and
`tools/validate.py`.

## Past airlines

An airline that no longer flies gets `ceased` in airlines.json (Northwest, 2010; Republic, 1986; Western, 1987). Its schemes are
history, drawn for Skyarium's ghost flights: `export_render.py` exports them by ref only, never as an airline's
default, so no live plane is ever matched to one. An airline that closed before ICAO's three-letter codes (1987) is
keyed by its IATA code and founding year (Republic: `RC1979`, Western: `WA1926`). Measure them from Commons photos like any other.
