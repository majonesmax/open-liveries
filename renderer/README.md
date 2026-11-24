# Open Liveries renderer

Draws a scheme from this dataset as SVG from the left, the right or below. It paints on one of three built-in
aircraft shapes or on yours, described in a few measurements in meters. [GUIDE.md](GUIDE.md) is the way in for
developers, with recipes. This is the reference. It's also the reference drawing of
[docs/COORDINATES.md](../docs/COORDINATES.md). When the spec and a picture disagree, one of them has a bug.

- **No dependencies.** It returns SVG markup as a string, so it runs in a browser, in Node or in a build step.
- **Any shape.** A scheme places everything as shares of each part, so the same scheme fits a 737, a 787 or a
  plane you made up.
- **Logos are yours to draw.** The dataset describes and places logos but doesn't include them
  ([docs/LOGOS.md](../docs/LOGOS.md)). The renderer draws a labeled placeholder unless you pass a painter.

## Use it

In a page as an ES module. `dist/` is committed, so it can be served as is:

```html
<div id="plane"></div>
<script type="module">
  import { renderSide, SHAPES } from './renderer/dist/index.js';
  const scheme = await (await fetch('./liveries/SWA/colorado-one.json')).json();
  document.querySelector('#plane').innerHTML = renderSide(scheme, { shape: SHAPES.narrowbody });
</script>
```

In Node or a build step:

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { renderBelow, renderSide, SHAPES } from './renderer/dist/index.js';

const scheme = JSON.parse(readFileSync('liveries/BAW/standard.json', 'utf8'));
writeFileSync('baw-right.svg', renderSide(scheme, { shape: SHAPES.widebody, side: 'right' }));
writeFileSync('baw-below.svg', renderBelow(scheme, { shape: SHAPES.widebody }));
```

From the command line at the repository root, after `npm run build`:

```sh
node renderer/dist/cli.js liveries/SWA/colorado-one.json > colorado-one.svg            # left side, narrowbody
node renderer/dist/cli.js liveries/BAW/standard.json --shape widebody --view right > baw.svg
node renderer/dist/cli.js liveries/DLH/standard.json --shape renderer/examples/quad.json --view below > dlh.svg
node renderer/dist/cli.js liveries/JBU/standard.json --shape shapes/A320.json > jbu-a320.svg   # a measured type
node renderer/dist/cli.js --print-shape regional > my-plane.json                        # a shape to start from
node renderer/dist/cli.js --all build/render          # every drawn scheme, every shape (and shapes/*.json), every view
```

## API

```ts
renderSide(scheme, { shape?, side?: 'left' | 'right', logo?, idPrefix?, drawnOn? }): string
renderBelow(scheme, { shape?, logo?, idPrefix?, drawnOn? }): string
belowLabelCount(scheme): number           // belly and under-wing titles and logos: is the below view worth showing
SHAPES                                    // { narrowbody, widebody, regional }
shapeNamed(name): AircraftShape | undefined  // a built-in shape by a name from elsewhere (a URL, a setting)
NARROWBODY, WIDEBODY, REGIONAL            // the same shapes, by name
shapeProblems(shape): string[]            // what's wrong with a shape (e.g. one read from JSON); empty if nothing
isMeasuredShape(json): boolean            // a measured type (shapes/<type>.json) rather than your own numbers
measuredShapeProblems(json): string[]     // what a measured shape lacks for drawing
schemeOn(scheme, shape): Livery          // the scheme as painted on that shape: its `types` entry laid over it

// For 3D (below)
renderTexture(scheme, 'fuselage' | 'fin' | 'engine' | 'winglet', { shape?, side?, logo?, drawnOn? }): string
sideProjection(shape): SideProjection      // { width, height, uv(meters, height) }
wingletBox(shape): [u0, v0, u1, v1] | undefined  // where the winglet texture lies in sideProjection's u and v
fuselageProfile(shape): (x) => { crown, belly }
colorOf(scheme, name, fallback): string    // a palette name (or hex) to a hex
stubPylonColor(scheme, shape, engine, side?): string | undefined  // a rear engine's stub pylon (3D)
spinnerPaint(scheme): string | undefined   // a propeller's spinner: the engines' cowling (3D: colorOf it)
NEUTRAL, PROPELLER, UNPAINTED_FUSELAGE     // the colors for parts a scheme leaves out; a propeller's blades
```

- `scheme` is a file from `liveries/` as parsed JSON. A scheme described only in words (no `fuselage`) draws
  as a plain unpainted aircraft. Show the airline's default scheme instead. `index.json` says which.
- `shape` (a `Shape`) is a built-in shape, your own numbers (`AircraftShape`) or a measured type read from
  `shapes/` (`MeasuredShape`). It defaults to the narrowbody. Pictures are 1000 wide with nose to tail cone in 900 of
  it. A measured type whose tailplane reaches well behind the tail cone (the 717) gets a little less so it fits. Their
  height follows the shape, so a tall fin or long wings make a taller picture.
- **Paint for one type:** on a measured shape every function here draws the scheme's entry for that type over its
  own paint. That entry is its `types` (docs/COORDINATES.md › Paint for one type), like Delta's white 717 nacelles or
  the A380s' titles between the decks. `schemeOn(scheme, shape)` gives that scheme for colors you read yourself,
  such as a 3D model's wings and cowlings. Give `renderTexture(scheme, 'engine', { shape })` the shape too, or pass
  it `schemeOn`'s scheme.
- `drawnOn` is the shape the scheme was measured on (`shapes/` for its `drawnOn`). Give it when drawing on another
  type and the fuselage's paint, titles and logos are fitted by the two types' landmarks
  ([docs/COORDINATES.md](../docs/COORDINATES.md), Landmarks). Without it they're placed by their shares as written.
- `idPrefix` starts the ids of each picture's clip paths. The ids are a hash of the picture, so the same picture
  always gives the same markup and different pictures don't collide. Set it to keep them apart from your page's own.
- `logo(logo, box, view)` draws a logo. `logo` is the scheme's entry (its `mark`, `colors`, `description`). `box`
  is its place in the picture's pixels (`x`, `y`, `width`, `height`, upright). `view` is `'left'`, `'right'` or
  `'below'`. Return SVG markup or `undefined` for the placeholder:

```js
const marks = {
  'SWA/heart': (b) =>
    `<image href="marks/swa-heart.svg" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}"/>`,
};
renderSide(scheme, { logo: (logo, box) => marks[logo.mark]?.(box) });
```

## In 3D

The same drawing as textures for a model. The viewer's 3D view
([`examples/svg-viewer/src/three/`](../examples/svg-viewer/src/three/)) builds a three.js aircraft from any shape
and paints it with these. Its `model.ts` is about 200 lines.

- **Fuselage:** `renderTexture(scheme, 'fuselage', { shape })` is its paint unrolled. It's 2048 wide with the nose
  at the left edge and the tail at the right.
  - **Rows:** they go once round. They start at the belly's centerline at the bottom and go up the left side to the
    crown at mid-height, then down the right side.
  - **Texture coordinates:** a mesh round the fuselage takes u = how far along (0 to 1) and v = the angle from
    the belly up the left side over 2π (three.js's default `flipY`).
  - **Proportions:** its height makes a pixel as tall as it is wide on the cabin, so lettering keeps its
    proportions.
  - **Matching outline:** `fuselageProfile(shape)` gives the crown and belly heights the pictures use, so a loft
    on it lines up.
- **Fin:** `renderTexture(scheme, 'fin', { shape, side })` is the fin alone as seen from that side in the side
  view's frame. A flat fin's vertices take `sideProjection(shape).uv(x, height)` as texture coordinates on the left
  face. The right face takes (1 − u, v) with the right side's picture.
- **Upper deck:** a measured shape's `fuselage.hump` (a 747's) is part of the fuselage's section in the 3D
  example. Over the upper half the section is the larger of the main tube's height and the deck's, joined smoothly.
  So the fuselage texture runs on over it. The side view draws the hump over the fuselage wearing the crown's paint
  carried up. The below view doesn't show it because it's narrower than the tube.
- **Engines:** `renderTexture(scheme, 'engine', { shape })` is a nacelle's paint (its cowling and areas) at 1024 by 512. The inlet is at the left and the exhaust at the right. Rows run from the bottom up the side seen from the left
  to the top at mid-height, then down the side seen from the right. Rows are even in the engine's height, not the
  angle round it. At angle a from the bottom, v = (1 − cos a) / 4 up the left side and 1 − (1 − cos a) / 4 down the
  right. One texture serves every engine.
- **Rear engines:** a measured shape's fuselage-mounted engine (`mount: 'fuselage'`) has a stub `pylon` from the
  fuselage's side to the nacelle. `stubPylonColor(scheme, shape, engine, side)` is its color seen from that side.
  A T-tail's tailplane (`stabilizer.mount: 'fin'`) is a surface like any other, at its height on the fin.
- **Tail engines:** a measured shape's engine on the tail's centerline (`mount: 'tail'`, like the MD-11's or the
  727's) wears the fin's paint carried down. So the fin's pictures (`renderTexture(scheme, 'fin', { shape, side })`)
  paint it too. A nacelle or an S-duct's intake round its side-view outline takes `sideProjection(shape).uv` on each
  side as the fin does. Its inlet lip is the scheme's `engines.inletLip`. Its bare exhaust (`nozzle`) is metal.
- **Propellers:** a measured shape's engine with a `propeller` (a turboprop's) has a spinner in the engines' cowling
  (`spinnerPaint`) and dark blades (`PROPELLER.blades`) that are never painted. The 3D example draws the blades still
  with a faint disc where they turn. It draws the nacelle as wide as its plan (`halfWidth`) with no inlet, fan or
  pylon.
- **Everything else:** wings, tailplane and winglets are flat colors. The scheme names them (`wings.top`,
  `winglets.outer` and so on) and `colorOf` resolves the names. Belly titles and logos aren't in any texture yet.

## A measured type

`shapes/<ICAO type>.json` is a real type's outline read off its manufacturer's dimensioned drawings
([docs/SHAPES.md](../docs/SHAPES.md)). It has the fuselage's curves, the fin with its dorsal fillet and rudder
hinge, the wing's and tailplane's plan and each nacelle's profile. It also has every cabin window (both decks' rows
on the A380), door and cockpit pane. Pass it parsed as `shape` anywhere a shape is taken. `src/measured.ts` lays it
out as the same `Geometry` the parametric shapes give, so every view and texture draws on it. The views use its
measured outlines where they'd otherwise guess. A scheme's paint reaches forward over a fin's fillet from the
leading edge (x 0). Its rudder color starts at the hinge line.

A type with a T-tail and its engines on the rear fuselage (`shapes/B712.json`, the 717) draws the same way:

- **Side:** the near tailplane across the fin's top in front of it, and the near nacelle over the fuselage with the
  scheme's engine paint and titles. Behind it the stub pylon shows as the fairing aft of the nozzle. The far
  tailplane and engine are hidden behind their near twins.
- **Below:** the nacelles beside the tail on their stub pylons and the tailplane beyond them. The fuselage hides its
  middle.
- **Pylon color:** a stub pylon is the scheme's `engines.pylon`, else the fuselage's paint where it meets the body.
  `stubPylonColor` gives it for a 3D model.

A high-winged turboprop (`shapes/DH8D.json`, the Dash 8-400) draws the same way too. Its wing's root is on the crown
(`wing.z` there at the crown's height). So from the side the near wing is a band along the top of the fuselage. The
nacelle holds the wing and hangs from it with no pylon.

- **Side:** the nacelle over the wing and the fuselage, and ahead of it the propeller. That's a faint disc seen edge
  on (a lens a twelfth of its diameter thick, the blades turning) and the spinner as a rounded cone in the engines'
  cowling.
- **Below:** the nacelle as wide as its plan (`halfWidth`) with the disc and spinner ahead of it.

A third engine on the tail's centerline is `engines[].mount: 'tail'`. That's `shapes/MD11.json` for the MD-11F and
`shapes/B722.json` for the 727-200F.

- **Side:** drawn over the fuselage and the fin's foot. The MD-11's nacelle goes through the fin's base on its strut,
  with the fairing over its nozzle. The 727's S-duct intake sits on the crown ahead of the fin, and its exhaust at the
  tail cone's end. It wears the fin's paint carried down below the fin's root. That's the base and the areas that
  reach the root, which run on across it, but not the rudder. It has the scheme's inlet lip and a bare metal nozzle.
  The scheme's engine areas and engine titles are the other engines' (docs/COORDINATES.md).
- **Below:** a straight duct's nacelle where it shows past the fuselage, in the fin's base color. An S-duct's intake
  is out of sight on top.

## Your own shape

A shape is a JSON object (or a TypeScript `AircraftShape`) in meters:

- **Along the aircraft:** meters back from the nose.
- **Heights:** meters up from the fuselage's centerline (negative is below it).
- **Lateral:** meters out from the centerline.

Measure them off a side view and a plan view of the aircraft, or off your model.

```jsonc
{
  "name": "narrowbody",
  "fuselage": {
    "length": 39.5, // nose to tail cone
    "radius": 2.0, // the cabin's radius
    "nose": { "crown": 5.5, "belly": 3.2, "tip": -0.2 }, // where crown and belly reach full height; tip height (radii)
    "tail": { "crownFrom": 33.2, "crownEnd": 0.72, "bellyFrom": 27.6, "bellyEnd": 0.42 }, // where the tail cone starts; its end (radii)
  },
  "cabin": { "from": 4.5, "to": 31.6, "pitch": 0.49, "doors": [[4.55, 5.1]] }, // window run, spacing, door gaps
  "cockpit": { "from": 2.3, "to": 3.6 },
  "fin": { "rootLeading": 31.6, "rootTrailing": 38.9, "tipLeading": 36.9, "tipTrailing": 40.3, "height": 4.9 },
  "stabilizer": {
    "rootLeading": 34.2,
    "rootTrailing": 39.1,
    "tipLeading": 37.1,
    "tipTrailing": 39.5,
    "span": 7.2,
    "height": 0.25,
    "dihedralDeg": 4,
  }, // span is one side's, from the centerline
  "wing": {
    "rootLeading": 14.6,
    "rootTrailing": 20.9,
    "tipLeading": 23.7,
    "tipTrailing": 26.3,
    "span": 17.9,
    "height": -1.1,
    "dihedralDeg": 3,
  },
  "winglet": { "height": 2.2, "sweep": 1.4, "tipChord": 0.6 }, // leave out for plain or raked tips
  "engines": [{ "front": 11.6, "back": 17.0, "radius": 0.83, "height": -2.7, "out": 4.9 }], // one side's; mirrored
}
```

- The fin's root chord is where it meets the crown. `height` is from there to its tip.
- Engines are listed for one side. Four-engined aircraft list two, and `renderer/examples/quad.json` is one. An
  engine below the wing gets a pylon up into it. One above or beside the fuselage (a tail-mounted engine) doesn't.
  In the side view the outboard engine is the nearer. Each one behind it is drawn first with its titles and logos,
  so the nearer nacelle covers them.
- `shapeProblems` and the command line report a missing number or an impossible one, like a leading edge behind
  its trailing edge or a nose longer than half the fuselage.

A shape can't change the spec's own conventions. Those are the scheme's parts and their spaces
([COORDINATES.md](../docs/COORDINATES.md)). For instance a rear-engined jet's engine paint is drawn on its nacelles
wherever the shape puts them.

## Layout

- `src/index.ts`: the API above.
- `src/shape.ts`: the shape type, the built-in shapes and `shapeProblems`.
- `src/measured.ts`: a measured type (`shapes/`) laid out as a `Geometry`.
- `src/geometry.ts`: a shape laid out in pixels, and where each part's coordinates land on it.
- `src/landmarks.ts`, `src/fit-labels.ts`: a scheme fitted from the type it was measured on to another, and its
  titles and logos kept clear of what they were clear of.
- `src/svg.ts`: SVG as text, areas as polygons, the picture's colors and clip paths.
- `src/colors.ts`: the renderer's own colors (neutral parts, glass, bare metal, outlines) and palette lookup.
- `src/labels.ts`: titles and logos (yours, or the placeholder).
- `src/side.ts`, `src/below.ts`: the views, in the spec's paint order. `src/side-parts.ts` maps the side view's parts
  into the picture. `src/side-labels.ts` places its titles and logos.
- `src/paint.ts`: a part's paint through any mapping, shared by the views and the textures (`src/texture.ts`).
- `src/scheme.ts`: a scheme's types, modeled on `schema/livery.schema.json`.
- `src/cli.ts`: the command line.

TypeScript compiled to ES modules in `dist/`. Like the viewer's `js/` it's committed, with `.d.ts` types. Build and
lint from the repository root with `npm run build`, `npm run lint` and `npm run check`. The last one renders
everything and fails on a broken picture.
