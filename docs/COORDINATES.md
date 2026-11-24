# Coordinates

Every position is a share of the part it's on, so one livery fits any type. A cheatline at y = −0.2 sits at the same
place on a 737 and a 777. Polygons are lists of `[x, y]` points.

## Fuselage

The fuselage unrolled from the belly's centerline around one side to the crown's centerline:

- **x:** 0 at the nose tip → 1 at the end of the tail cone.
- **y:** −1 the belly's centerline → 0 halfway up the side (about the window line's bottom on most
  airliners) → 1 the crown's centerline.

On a type with an upper deck above its main tube (a 747's hump) y is the main tube's. The hump wears the crown's paint
carried up (docs/SHAPES.md), so a cheatline or title is placed as on any type.

In a side view a point at `y` is drawn at height `r · sin(y · 90°)` from the centerline, so `y = ±0.5` is 70% of the way
up or down. An area's edge between two points runs straight as seen from the side, because paint lines are laid out on
the side elevation. So a stripe or a diagonal needs only its corners. In `y` that edge is a gentle curve. A renderer
draws it through side-view heights (`sin(y · 90°)`) and turns the points back. Areas apply to both sides unless `side`
says one. An asymmetric design (a wrap with different artwork on each side) uses `left` and `right` areas.

Some useful landmarks on a typical narrow-body follow. All are approximate. The cockpit windows are around x 0.06–0.09
and y 0.2–0.45. The cabin windows are at y 0.05–0.2. The wing root is at x 0.38–0.52. The fin's leading edge meets the
fuselage at about x 0.8.

`below`/`above` lines are shorthands for the commonest shapes. `below: [[0, -0.3], [1, -0.1]]` paints everything under a
line that rises from −0.3 at the nose to −0.1 at the tail (a swept belly split). A line paints only over its own
x-range, so a band that starts behind the nose starts there. With both you get the band between them (a cheatline).
`below` is its upper edge (paint under it) and `above` is its lower edge.

Points may run a little outside 0–1 for a shape that runs off the edge of the part. Clip to the part's outline.

## Curved outlines

An area's points are joined by straight lines unless the area says `"smooth": true`. Then its points lie along a smooth
curve (a paint line that sweeps, as most do on a fuselage). The outline is drawn as that curve, a centripetal
Catmull-Rom spline through the points. It's kept sharp where:

- **The point is on the part's edge or past it:** x 0 or 1, or y at the part's lowest or highest (±1 on the fuselage and
  engines, 0 and 1 on the fin, wings and winglets). That's where paint meets the outline.
- **The point is marked a corner:** `[x, y, 1]` instead of `[x, y]` for a real corner inside the part (the point
  of a chevron, a stripe's square end).

Between two sharp points the curve runs through the points in between. Two sharp points in a row are joined straight. A
`below` or `above` line in a smooth area is a curve the same way, with its two ends sharp. Straight is the default
because most areas here were measured as polygons with real corners (window bands, flag stripes, facets).
`tools/smoothing_review.py` lists areas whose points look like a sampled curve, to check against photos. The reference
renderer and `tools/common.py` (`area_polygon`) draw the same curve. `tools/export_compact.py` writes it out already
curved.

## Fin

The left face as seen from the left. **x** is 0 at the leading edge → 1 at the trailing edge, measured at each height,
so the swept leading edge is always x = 0. **y** is 0 at the root → 1 at the tip. The rudder is roughly x 0.7–1 (0.7 if
a renderer needs a number). With `mirrored: true` (the default) the right face carries the design at the same
coordinates, so it sweeps the same way relative to the direction of flight. With `false` the right face shows the left's
picture unreversed. A point (x, y) on the left is (1 − x, y) on the right, for areas and logos alike.

A T-tail has the tailplane on top of the fin (the 717, CRJ, MD-80). There the fin still runs from its root to its top,
including the tailplane's fairing. The tailplane crosses its upper part (the 717's at y 0.8) and is drawn over it as on
the aircraft. So a design meant to show stays below that.

Fin space is sheared (x is a share of the chord at each height), so it isn't a true picture of angles or proportions. A
logo's `height` and a title's `rotationDeg` are meant as on the fin as built. A logo stands upright and undistorted,
centered on its `at`.

## Wings, tailplane, winglets

**x** is 0 at the leading edge → 1 at the trailing edge. **y** is 0 at the root → 1 at the tip. Winglets use the outer
face. `wingUnder` (logos under the wings) is the wing's underside in the same coordinates, seen from below.

## Engines

The nacelle's outboard face. **x** is 0 at the inlet lip → 1 at the exhaust. **y** is −1 at the bottom → 1 at the top.
The same goes for an engine on the rear fuselage (the 717's, an MD-80's). Its outboard face is the one seen from the
side, over the fuselage. `pylon` colors the pylon. Left out, a pylon under a wing takes the cowling's paint. A stub
pylon on the fuselage (faired into the body) takes the fuselage's paint where the pylon meets the body.

A turboprop's propeller (the Dash 8's, ATR's) isn't in engine space and isn't painted by a scheme. Its blades are dark
(a renderer's own, `#2b2f36` in the reference renderer) and drawn as a faint disc where they turn. Its spinner wears
`engines.cowling`, else the renderer's neutral engine gray. Spinners are often another color than the cowling (a white
spinner on a colored nacelle, a colored one on a white). A scheme can't say so yet.

An engine on the tail's centerline isn't in engine space. That's the MD-11's through the fin's base and the 727's S-duct
intake on the crown ahead of the fin. It wears the fin's paint carried down. The fin's space is carried on below its
root (its leading and trailing edges continued straight down) and out past its edges. The fin's base is under it and the
fin's areas carry on across it. An area's points on the fin's foot go on down and those on its leading or trailing edge
go on out. So a stripe that runs off the fin's foot runs on across the nacelle. The fin's own space is unchanged (its
root is the leading edge's foot, on the nacelle), so fin art measured on any type maps as before. The rudder's color
stays on the rudder. The engine's inlet lip takes `engines.inletLip` and its exhaust is bare metal. Engine areas, titles
and logos are for the other engines.

## Belly

Titles and logos under the fuselage (`place: belly`) use the fuselage's x. Their y is the line across the belly that
their middle runs on. A y of −1 is the centerline (where nearly all are) and −0.8 is a little toward the left side. For
a belly title this replaces the baseline rule. `at` is where the text starts along x, on that middle line. Seen from
below with the nose to your left, text reads nose to tail. `rotationDeg: 180` turns it to read tail to nose over the
same stretch. It then starts at the aft end, as a title does on the right side. Their `height` counts the fuselage's
full height as 2, as on the sides. Areas painted on the belly are ordinary fuselage areas (y near −1).

## Logos and titles

- **Where:** a logo's `at` is its center. A title's is the left end of its baseline as seen from the left side. Both are
  in the space of their `place`.
- **Size:** `height` is a share of the part's height, which is the span of y in the part's own units. That's 1 for the
  fin, wings and winglets and 2 for the fuselage, engines and belly. A title's height is its cap height (the capitals'
  tops at y + height). A logo's width follows the artwork, which isn't here (docs/LOGOS.md). A placeholder can be
  square.
- **Length and turn:** a title's `length` spreads it to run that far, as a share of the part's x. On the fin that's the
  chord at its height. A turned title's length runs along the text, so a turned fin title can run past 1. `rotationDeg`
  turns it about `at` counter-clockwise seen from the left. It's a true angle on the part as built (0 along the
  fuselage).
- **Right side:** a title covers the same stretch of the part and reads normally from that side, starting at its aft
  end. A turned title takes the mirrored line, so one that reads upward toward the tail on the left reads downward on
  the right. Check a photo of the right side where one exists. A logo sits at the same place, as the artwork appears
  from that side. Most marks are painted facing forward on both.
- **Two colors, one name:** a name lettered in more than one color (FedEx, Atlas Air, United Express) is one title with
  `parts`. The parts are runs that spell its `text`, each with its color. Set at its natural width it's one run of text.
  Spread to a `length`, each part is its own run spread to its share by its letters. WebKit (Safari and the app's web
  views) ignores a spread run's length when it holds parts, and FedEx's tail read "FedE". Either way the parts can't
  overlap and read in order from either side. Two titles in different lettering (EVA AIR's "Cargo") stay two titles.
  Where they read as one line, give each side its own pair (`side`) placed as that side shows them.
- **One side only:** `side: left` or `right` on an area, title or logo.

## Paint order

Bottom to top: the part's base color, the rudder color, areas in the order listed (later over earlier), the radome and
the paint around the glass (a cockpit mask, a dark window band), titles, logos, then the windows and cockpit windows
themselves. Glass is never painted. A title across the window line shows the windows through its letters, as on the
aircraft. A logo can repeat a shape the areas already paint (Delta's widget). A renderer with the artwork draws it over
them. One without lets the areas stand.

## Finish

`finish` says what the paint is like, not where it is. `metallic` and `bareMetal` (polished aluminum, a silver paint
meant to look like it) shine. A renderer drawing a side view can show the reflections that photos of it show. That's the
sky's light along the upper side, a darker line of the horizon just below the middle and the ground's dull light on the
belly. They go over the fuselage's base only, and paint over it stays solid. So a scheme that's mostly bare metal names
the metal as its base, not as an area over white. A texture for a 3D view leaves them out because its lighting does
that.

## Bare metal

An engine's core and nozzle behind its fan cowl (a measured shape's `engines[].cowlEnd`) are bare metal on every
airliner, whatever the scheme paints. A renderer draws them in exhaust gray over the cowling's paint and areas. It does
so from the side, from below and on a 3D nacelle's texture, as it does a tail engine's bare exhaust. A scheme describes
the paint. The metal isn't its to describe. Lettering and logos on an engine stay on its cowl. A title that would run
past the cowl's end is made smaller from its start (about its middle up the nacelle) so it ends just ahead of it. A logo
is moved forward. Southwest's "Southwest.com" was measured to 80% of a 737's nacelle and ran onto the metal.

On a winglet a logo stays inside the winglet. It's about as wide as it's tall and clear of the winglet's edges. It's
moved toward the middle and made smaller if it must be (Sun Country's sun ran off its winglet). A 3D model's winglet
wears its outer face's paint, areas and logos from a picture of the winglet cropped to it
(`renderTexture(scheme, 'winglet')`, mapped through `wingletBox`). That's how its fin wears the fin's. The inner face
stays its plain paint.

## What isn't described

A part a scheme leaves out (no `engines`, `wings` or `winglets`) isn't known yet. Draw it in the renderer's own neutral,
not as the base color. Skyarium's are light gray engines and gray wings.

## The airline's default scheme

An app that shows one scheme per airline (when an airframe isn't listed in `airframes/`) uses the airline's current
`standard`-kind scheme marked `commonest`, else the one whose id is `standard`. Other `standard`-kind schemes are
variants (freighters, a regional brand such as `UAL/express`, an older scheme still flying). A scheme described in words
only (no `fuselage`) falls back to that default to be drawn.

## The fillet

A dorsal fillet is the curved fairing ahead of the fin's root on types that have one. It belongs to the body. A renderer
paints it with the fuselage's paint on the crown under it, carried up along the slant of the body's stripes there. So a
stripe flowing from the body into the tail passes through it unbroken. `fin.fillet` gives it one color instead where the
photos show that (easyJet's white). The fin's own areas stop at its leading edge.

## Doors

Doors belong to the aircraft, not the scheme. A renderer draws them from the shape. A measured type's doors are drawn
exactly and a built-in shape's door positions at a standard height. They're thin seams a little darker than the paint
they cross, with a main door's small window, drawn over the paint and the windows.

## Lettering

A title's `type` block says how its lettering looks, measured off photos. It gives typefaces that come close, weight,
slant, width, strokes, case and `xHeight`. That's the lowercase letters' height as a share of the capitals'. A renderer
without the airline's own typeface sets the title in a stand-in. It keeps the measured cap height, except that a mostly
lowercase wordmark is sized so its lowercase matches `xHeight` (the capitals then come out a little tall). A title
spread to its measured `length` wider than the stand-in sets it is drawn heavier, not letter-spaced.

A title marked `registration` is the aircraft's own number, like the Coast Guard's serials lettered below the flight
deck. Its `text` is the number on the photo it was measured from. An app that knows the aircraft's registration letters
that instead, in the same place, size and lettering (the compact export's `reg`). A renderer without one draws the
measured number.

## The type it was measured on

`drawnOn` names the aircraft type (ICAO designator) a scheme's geometry was measured on. Titles, logos and the fin's art
are fixed in meters on the real aircraft. So as shares of the parts they fit that type exactly and others approximately.
The body's paint and the fin's meet where they do on the real aircraft only on that type's outline. A renderer with that
type's measured shape (`shapes/`) should draw on it by default. Where another type is painted differently and not just
placed approximately (a title between an A380's decks), the scheme says so per type. See below.

## Landmarks: drawing on another type

Aircraft don't stretch evenly. A longer variant grows mostly in the cabin while its nose, cockpit and tail stay about
the same. A widebody's deck sits differently in its section. So on another type the fuselage's shares are read through
both types' landmarks rather than as shares of the whole. This is the renderer's `drawnOn` option, given the measured
shape for the scheme's `drawnOn` (`renderer/src/landmarks.ts`).

- **Along the body:** the nose, the cockpit windows' end, the first cabin window, the wing root's leading and trailing
  edges, the last cabin window, the fin root's leading edge and the tail. A position is "this far between these two" on
  the measured type and goes the same way between them on the other, straight between landmarks. A landmark that one of
  them doesn't have (a windowless freighter's cabin windows) or that's out of order on either is left out. For paint but
  not lettering, a flight deck well above the main deck's windows isn't a landmark. A 747's is like that, on its hump
  with the main deck's windows running on forward under it. So a stripe begun at a 737's cockpit covers a 747's first
  windows. A title just behind a 737's cockpit still goes just behind a 747's.
- **Up the side:** the belly, the main deck's windows and the crown, in meters at each point's place along the body. The
  windows are a row at one height, so their band in y moves where the body tapers. Paint near the windows (within half
  the cabin's radius of them) keeps its distance from them, grown with the body. A stripe along them follows them to the
  nose and tail and stays the stripe it is. It runs off the nose where it did on the measured type. Farther off, paint
  keeps its share of the way to the belly or the crown (a 747's main tube's, under its hump). A point on the crown or
  the belly stays on it where that's still beyond the windows. At the very tip and tail, where the body is a point, it
  stays as written. Long straight edges are divided as they're drawn (straight in side-view heights) before they're
  fitted, so each part goes where it is. A smooth area's edges are curves through its points and aren't divided. A type
  without windows can say where they'd be (`cabin.windows.wouldBe`). On a freighter that's its passenger version's first
  and last, with `z` their heights. It's then fitted as if it had them, along the body and up the side, for paint drawn
  beside windows. A type that doesn't (the 727F, the C-17) and paint drawn on a type without windows have nothing to be
  placed by. Both stay as written. Titles and logos are placed by the band at their run (below).
- **An upper deck** on the main tube, where it runs. That's the A380's whole length and a 747's front under its hump.
  Its windows' band counts for titles and logos that run under it.
- **Titles and logos** go by their middles and grow with the body. They keep the same share of its height, as airlines
  letter a widebody bigger. One clear of the windows where it was measured stays clear of them. One above the windows
  sits between the main deck's band and the crown, made smaller only if that gap is too small. On an A380 it's centered
  between the decks and at most about 60% of the gap's height, as the A380s measured are lettered. One under them stays
  under. One across them (glass through its letters, like Southwest's and airBaltic's) keeps the band as far up its
  letters as it was. Under a second deck the decks size it, from a little under the main deck's windows up to just under
  the upper deck's (Emirates'). A title keeps its proportions in meters. Its length follows its height, so it isn't
  stretched on a short body or squeezed on a long one. A title that followed another on its row keeps the gap between
  them (grown with the body). It's moved aft if the first grew into it. A title on one painted area where it was
  measured stays on it (Sun Country's white name on its orange). Where the fitted area is shorter or slants away sooner,
  the title is made smaller about its start until it fits, to half its size at most. One on the bare body keeps clear of
  the paint by at least half as far as it was (in meters, grown with the body). It's moved away from the nearer paint
  (up to just under an upper deck's windows), then made smaller (American's red name over the tri-color's stripes,
  between an A380's decks). A title clear of the wing's root from the side where it was measured stays clear of it. It's
  moved forward (not past the cockpit's end), then made smaller if it must be (Asiana's on a 747 and an A380).
- **On the fin,** in its own space, lettering and logos keep clear of its edges as where they were measured. They keep
  at least three quarters of their clearance from the leading edge, trailing edge and tip, in meters grown with the fin.
  A logo counts as a disc of its height and a title as its box along its turn. A fin swept or proportioned otherwise
  puts the same shares nearer an edge. Spirit's diagonal name was clear on its A320 but crowded a 747's leading edge.
  Such a mark is moved the least it takes, never down onto the body, then made smaller, to 30% of its size at most. A
  727's fin under its T-tail is half an A320's height. One running off an edge on purpose (United's globe) is left as it
  is. The tailplane drawn across the fin from the side (a T-tail's, over its top) counts as an edge too. Spirit's name
  was clear of a 717's fin edges but came within 7 cm of its tailplane.
- **Not fitted:** the fin's areas, wings, tailplane, winglets and engines (their spaces are their own parts'), the
  belly's
  positions across, and paint carried past the nose or tail or over the crown. On the measured type itself or with
  no `drawnOn` shape, shares are drawn as written. Paint for one type (below) is measured on that type and laid over
  the fitted scheme as it is.

## Paint for one type

Some schemes are painted differently on one type. Delta's 717s have white nacelles where its Airbuses' are navy. The
A380s carry their titles between the decks. A scheme says so in `types`, keyed by the id of a shape in `shapes/`. For
the types measured there that's the ICAO designator (`"B712"`, `"A388"`). Each entry is a part of a scheme measured on
that shape. It's laid over the scheme's own paint when it's drawn there:

```json
"types": {
  "B712": {
    "note": "White nacelles with a polished lip (N953AT, 2023).",
    "confidence": "high",
    "sourceRefs": [3, 4],
    "engines": { "cowling": "white", "inletLip": "lip", "confidence": "high", "sourceRefs": [3, 4] }
  }
}
```

- **What an entry can hold:** `palette`, `fuselage`, `fin`, `stabilizer`, `wings`, `winglets`, `engines`, `titles` and
  `logos`. About itself it holds a `note` (what differs and from which photos), `confidence` and `sourceRefs` (into the
  scheme's `sources`).
- **How it applies:** a part given replaces the keys it names in the scheme's part and keeps the rest.
  `"fuselage": { "areas": [...] }` replaces the fuselage's areas (all of them) and keeps its base color, radome and
  windows. `titles` and `logos` replace the scheme's lists whole, so an entry that moves one title lists all of them
  (the belly's too). Palette colors are added to the scheme's or replace those of the same name. Nothing merges
  deeper than that. Arrays are never merged item by item.
- **Where it applies:** on a measured shape whose id is the key, else one whose `types` include it. An entry keyed
  `B744` covers both 747-400 shapes. One keyed `B744-passenger` covers only that one. A shape's own entry wins over its
  type's. One entry applies at a time. Built-in shapes (narrowbody, widebody, regional) get none.
- **Measured there:** everything in an entry is in that shape's coordinates and measured on photos of that type. So
  `drawnOn` (the type the rest was measured on) stays the airline's commonest type.

The reference renderer applies it in every view and texture. `schemeOn(scheme, shape)` gives the scheme as painted on a
shape, and `tools/common.py` has `paint_for` for the tools. `tools/export_compact.py` carries it as each scheme's
`types`. Per key that's only the compact keys that differ once the entry is laid over the scheme (`paint_for`). So an
app drawing on a measured shape (`tools/export_shapes.py`) takes the shape id's entry, else its designator's, over the
scheme's own keys. On a built-in shape it takes none.
