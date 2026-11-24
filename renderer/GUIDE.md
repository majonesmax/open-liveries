# Using the renderer

A guide for developers putting Open Liveries schemes on screen with the TypeScript renderer, in a page, a build
step, a server or a 3D scene. [README.md](README.md) is the reference: every function, the shape format, the
texture layouts. This is the way in.

## What you get

A scheme file (`liveries/<airline>/<id>.json`) goes in and SVG markup comes out, as a string:

```ts
import { renderSide } from './renderer/dist/index.js';
const svg: string = renderSide(scheme); // the left side, on the built-in narrowbody
```

- **No dependencies, no DOM.** It's plain string building, so the same call works in a browser, in Node, in a
  worker or at build time.
- **Typed.** `dist/` ships `.d.ts` files: `Livery` (a scheme), `AircraftShape`, the options, the logo painter.
- **Deterministic.** The same scheme and shape always give the same markup, so pictures can be cached or
  rendered ahead.

## Getting it

There's no npm package yet. The compiled library is committed in `renderer/dist/` (ES modules plus types),
so either:

- serve or vendor that folder and import `renderer/dist/index.js`, or
- build it yourself from a clone: `npm install`, then `npm run build`.

It needs an ES2022 runtime: any current browser, or Node 20 or later.

The data comes the same way: `liveries/`, `airframes/`, `operators.json` and `index.json` from the repository
(CC0). The renderer doesn't fetch anything. You load the scheme and hand it over.

## A first picture

In a page (serve the repository root, so the module and the data are reachable):

```html
<div id="plane" style="max-width: 800px"></div>
<script type="module">
  import { renderSide } from './renderer/dist/index.js';

  const scheme = await (await fetch('./liveries/SWA/colorado-one.json')).json();
  document.querySelector('#plane').innerHTML = renderSide(scheme);
</script>
```

The SVG has a `viewBox` and no fixed size, so it fills its container's width. Every picture is 1000 units wide
with the fuselage across 900 of them. Its height depends on the shape (about 260 for the narrowbody), so set
`width` in CSS and let the height follow.

In Node, writing files:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { renderBelow, renderSide, SHAPES } from './renderer/dist/index.js';
import type { Livery } from './renderer/dist/index.js';

const scheme = JSON.parse(readFileSync('liveries/BAW/standard.json', 'utf8')) as Livery;
writeFileSync('baw-left.svg', renderSide(scheme));
writeFileSync('baw-right.svg', renderSide(scheme, { side: 'right', shape: SHAPES.widebody }));
writeFileSync('baw-below.svg', renderBelow(scheme, { shape: SHAPES.widebody }));
```

The command line does the same without code: `node renderer/dist/cli.js liveries/BAW/standard.json --view
right > baw.svg` (`node renderer/dist/cli.js --help` lists the rest).

## Recipes

### Which scheme is that plane wearing?

The renderer draws a scheme you choose. Choosing it for a real aircraft is the dataset's job, and `index.json`
has the answers worked out:

- `registrations` maps every tagged registration to its scheme.
- Each airline's everyday scheme is marked `default`.
- `operators` covers regionals flying in a mainline's paint.
- `alsoFlies` lists, per airline, other airlines' schemes its tagged jets wear, with how many (Sun Country:
  `ATN/prime-air-blue`, 8).

A US registration's ICAO address is fixed by calculation (`tools/nnumber.py`); others are in `airframes/*.json`
as `hex`.

```ts
interface Index {
  schemes: { id: string; airline: string; default: boolean; drawn: boolean }[];
  operators: Record<string, { wears: string }>;
  registrations: Record<string, string>;
}

/** The scheme id for an aircraft: its own if it's tagged, else its operator's paint, else the airline's default. */
function schemeFor(index: Index, registration: string | undefined, callsign: string): string | undefined {
  const tagged = registration && index.registrations[registration.toUpperCase()];
  if (tagged) return tagged;
  const airline = callsign.slice(0, 3).toUpperCase(); // the ICAO airline code: "SWA1776" → "SWA"
  return index.operators[airline]?.wears ?? index.schemes.find((s) => s.airline === airline && s.default)?.id;
}

const index = (await (await fetch('./index.json')).json()) as Index;
const id = schemeFor(index, 'N8690A', 'SWA2201'); // "SWA/colorado-one"; an untagged Southwest jet: "SWA/standard"
```

Then fetch `liveries/${id}.json` and render it. A scheme described only in words, with no `fuselage` (the
index's `drawn: false`), draws as a plain unpainted plane. Show the airline's default instead.

### Draw it on the right kind of aircraft

`SHAPES` has `narrowbody` (737, A320), `widebody` (787, A350) and `regional` (E175). Pick by ICAO type designator
if you have one:

```ts
import { SHAPES } from './renderer/dist/index.js';
import type { AircraftShape } from './renderer/dist/index.js';

const WIDEBODIES = /^(B74|B76|B77|B78|A3[3-5]|A38)/;
const REGIONALS = /^(E1[79]|E7|E29|CRJ|DH8|AT7)/;
const shapeFor = (type = ''): AircraftShape =>
  WIDEBODIES.test(type) ? SHAPES.widebody : REGIONALS.test(type) ? SHAPES.regional : SHAPES.narrowbody;
```

`shapeNamed('widebody')` looks one up by a name from elsewhere (a URL, a setting) and returns `undefined` for an
unknown name.

For the real outline, use the measured type when there is one: `shapes/<ICAO type>.json` (an A320, a 737-800, a
787-9…). Pass the scheme's own measured type as `drawnOn` too (the scheme's `drawnOn` names it), and the paint is
fitted from that type to yours by their landmarks rather than placed by its shares as written:

```ts
const a321 = JSON.parse(readFileSync('shapes/A321.json', 'utf8'));
const a320 = JSON.parse(readFileSync(`shapes/${scheme.drawnOn}.json`, 'utf8'));
renderSide(scheme, { shape: a321, drawnOn: a320 });
```

### Your own aircraft

A shape is about a dozen measurements in meters. Start from the closest built-in one and change what differs:

```sh
node renderer/dist/cli.js --print-shape widebody > a330.json      # then edit it
node renderer/dist/cli.js liveries/AFR/standard.json --shape a330.json > check.svg
```

Measure off a side view and a plan view: a three-view drawing, the manufacturer's airport planning document, or
your 3D model.

- **Along the aircraft:** meters back from the nose.
- **Heights:** meters up from the cabin's centerline.
- **Lateral:** meters out from the centerline.

The fields are in [README.md › Your own shape](README.md#your-own-shape), and `renderer/examples/quad.json` is a
worked four-engined one.

In code, check a shape before using it, especially one a user supplies:

```ts
import { renderSide, shapeProblems } from './renderer/dist/index.js';
import type { AircraftShape } from './renderer/dist/index.js';

const candidate: unknown = JSON.parse(text);
const problems = shapeProblems(candidate); // e.g. ["wing.span must be a number", "fin: tipLeading must be ahead of tipTrailing"]
if (problems.length === 0) {
  const svg = renderSide(scheme, { shape: candidate as AircraftShape });
}
```

`renderSide` and the others throw with the same messages if given a broken shape. A shape is laid out once and
cached (by object identity), so drawing a whole list on one shape is cheap.

### Logos

The dataset places and describes each logo but doesn't include the artwork. That belongs to the airline (see
`docs/LOGOS.md`). Without help, the renderer draws a labeled placeholder in the logo's place and size. Pass a
painter to draw your own:

```ts
import type { LogoPainter } from './renderer/dist/index.js';

// Your own drawings, keyed by the dataset's mark ids ("SWA/heart", "DAL/widget", ...).
const MARKS: Record<string, string> = { 'SWA/heart': '/marks/swa-heart.svg' };

const logo: LogoPainter = (mark, box, view) => {
  const href = MARKS[mark.mark];
  if (!href) return undefined; // the placeholder
  // Many fins show a mark facing forward on both sides (Lufthansa's crane, Qantas's kangaroo), so on the right
  // it's the left's artwork reversed. Leave this out for marks painted the same way round on both sides.
  const flip =
    view === 'right' && mark.place === 'fin' ? ` transform="translate(${2 * box.x + box.width} 0) scale(-1 1)"` : '';
  return `<image href="${href}" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}"${flip}/>`;
};

renderSide(scheme, { logo });
```

`box` is the logo's place in the picture's units, upright and square to the logo's height. A wide mark can
extend past it. Return any SVG markup: an `<image>`, inline paths, a `<use>`. It's inserted as is, so don't
pass in markup you haven't checked.

### Many pictures on one page

Each picture defines clip paths with ids made from a hash of the picture itself, so a page drawing hundreds of
cards is fine, wherever each was rendered, and the same picture always comes out the same. Two copies of one
picture share ids, but their clip paths are the same too. Give `idPrefix` to keep the ids apart from your page's
own.

For long lists, render as cards scroll into view (the viewer, `examples/svg-viewer/src/ui/list.ts`, does this
with an `IntersectionObserver`), or render ahead of time with the command line's `--all`.

### Rendering ahead of time

For a static site or an app bundle, render once at build time:

```sh
node renderer/dist/cli.js --all public/planes    # public/planes/<shape>/<airline>/<id>-<left|right|below>.svg
```

Then the app needs no JavaScript to show a plane: `<img src="planes/narrowbody/SWA/colorado-one-left.svg">`.
Titles use the scheme's suggested typefaces with common fallbacks (Helvetica Neue, Arial), so a picture shown as
an `<img>` uses the fonts on the viewer's machine.

### In 3D

`renderTexture(scheme, 'fuselage', { shape })`, `renderTexture(scheme, 'fin', { shape, side })` and
`renderTexture(scheme, 'engine', { shape })` paint textures for a model. `fuselageProfile`, `sideProjection` and `colorOf` give the outline, the fin's texture coordinates
and the colors of everything else. Read those colors from `schemeOn(scheme, shape)`: on a measured type it carries the
scheme's paint for that type (`types`), which the pictures and textures already use. The layouts are in [README.md › In 3D](README.md#in-3d). The worked example is
`examples/svg-viewer/src/three/`: `model.ts` builds an aircraft on a built-in shape and `measured-model.ts` on a
measured type, sharing airfoil wings, textured nacelles and pylons from `parts.ts`. On a rear-engined type (the 717) it builds the nacelles beside the tail on their stub pylons, colored by `stubPylonColor`, and the tailplane on
top of the fin. A tail engine (the MD-11's, the 727's) is a nacelle or intake round its side-view outline wearing
the fin's textures through `sideProjection`, as the fin does. A turboprop's (the Dash 8-400's) nacelle is as wide as its
plan (`halfWidth`), holds the wing (no pylon), and has a propeller: a spinner in `spinnerPaint`'s colour, still blades in
`PROPELLER.blades` and a faint disc.

To turn an SVG string into a texture in a browser, draw it into a canvas:

```ts
async function svgToCanvas(svg: string, width: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const image = new Image();
  image.src = url;
  await image.decode();
  URL.revokeObjectURL(url);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round((width * image.naturalHeight) / image.naturalWidth);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas; // new THREE.CanvasTexture(canvas), with colorSpace = THREE.SRGBColorSpace
}
```

## Types you'll use

| Type             | What it is                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Livery`         | A scheme file, as parsed JSON (modeled on `schema/livery.schema.json`).                                            |
| `AircraftShape`  | A shape in meters; `NARROWBODY`, `WIDEBODY`, `REGIONAL`, or yours.                                                 |
| `MeasuredShape`  | A measured type read from `shapes/<type>.json`.                                                                    |
| `Shape`          | Either of the two.                                                                                                 |
| `RenderOptions`  | `{ shape?, logo?, idPrefix?, drawnOn? }`, plus `side?` for `renderSide` and `renderTexture`.                       |
| `LogoPainter`    | `(logo, box, view) => string \| undefined`.                                                                        |
| `LogoBox`        | `{ x, y, width, height, fitWidth? }` in the picture's units; `fitWidth` stretches a title's wordmark to its width. |
| `SideProjection` | `sideProjection`'s result: `{ width, height, uv(meters, height) }`.                                                |

The renderer trusts a scheme to match the schema; `tools/validate.py` checks every file in the repository. If
you hand it schemes from elsewhere, validate them against `schema/livery.schema.json` first.

## What it doesn't do (yet)

- **Belly titles and logos:** these appear in the below view only, not in the fuselage texture.
- **Fonts:** the titles are set in a typeface like the airline's, not its own lettering. The scheme names its
  look-alikes (`type.similar`).
- **Choosing the scheme:** the renderer doesn't pick one for a registration or address. That's the dataset (the
  first recipe).

## Questions and changes

The rules the renderer follows are [docs/COORDINATES.md](../docs/COORDINATES.md). When a picture looks wrong, the
scheme's numbers, the spec and the renderer are the three suspects. To change the renderer: its sources are in
`src/`, and `npm run lint` and `npm run check` (everything rendered, nothing broken) must pass. Commit the
rebuilt `dist/` with it.
