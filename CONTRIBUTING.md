# Contributing

Fixes and new schemes are welcome. A wrong color, a title in the wrong place, a special that's missing or a jet
tagged with the wrong scheme are all good first changes.

## What to work on

- **Fix a scheme.** Compare a render with a dated photo and change what's off. `tools/sheet.py` puts the before and
  after renders next to your photos.
- **Draw a special.** `leads.tsv` lists specials seen on public lists that nobody has researched yet. A lead becomes a
  scheme once a dated source shows it on that airframe.
- **Tag an airframe.** Say which jet wears which scheme in `airframes/<airline>.json`, with a source.
- **Add a shape.** `tools/trace/` measures a type from its manufacturer's airport-planning drawings
  ([docs/SHAPES.md](docs/SHAPES.md)).

[docs/TUTORIAL.md](docs/TUTORIAL.md) walks through reading a plane's paint and adding a scheme.
[docs/COORDINATES.md](docs/COORDINATES.md) has every rule for where things go.

## Where facts can come from

Every scheme and airframe lists its sources, each with the date it was read.

- **To measure from** (a part's `sourceRefs`): openly licensed photos (Wikimedia Commons), the airline's own press
  images and brand pages, or photos you took yourself.
- **Evidence only:** spotter sites (JetPhotos, Airliners.net, Planespotters and the like), social media and Flickr
  photos that aren't openly licensed. They can show that a jet wears a scheme, but nothing is copied or measured from
  them. `tools/validate.py` fails a part measured from one.
- **Logos and artwork** are described, never copied ([docs/LOGOS.md](docs/LOGOS.md)). Licensed characters on a special
  (a film's or a team's) are described in words only.
- **People:** no names of private individuals. A photographer's credit on an openly licensed photo is fine and is
  what its license asks for.

`notes`, `history` and `status` are public remarks for a reader. Say how something was drawn and what's uncertain.

## Before you open a pull request

```sh
python3 -m venv .venv && .venv/bin/pip install "jsonschema>=4.18"
.venv/bin/python -I tools/validate.py        # must pass
.venv/bin/python -I tools/preview.py BAW     # look at what you changed (build/preview/index.html)
```

If you changed the tools:

```sh
.venv/bin/pip install ruff mypy types-jsonschema
.venv/bin/ruff check && .venv/bin/ruff format --check && .venv/bin/mypy
```

If you changed the renderer or the viewer (Node 20 or later):

```sh
npm install
npm run lint && npm run format:check && npm test
npm run build   # and commit renderer/dist and examples/svg-viewer/js with your change
```

CI runs the same checks on every pull request.

Files are written the way `tools/common.py` writes them. That's JSON indented by two spaces, UTF-8 as is and a
newline at the end. Keep a scheme's ids stable once they're in, since airframes and apps refer to them.

## License

The data is CC0 and the code is MIT ([README.md](README.md#license)). By contributing you agree your contribution is
released under the same terms. Airline names, logos and liveries are their owners' trademarks. This project describes
them so they can be recognized and claims nothing over them.
