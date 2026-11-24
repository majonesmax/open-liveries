# Shapes

_Status: new (2026-11-15). Sixty-eight shapes: `A319`, `A320`, `A20N`, `A321`, `A21N`, `A332`, `A333`, `A338`, `A339`, `A343` (the A340-300), `AT46` (the ATR 42-600, and -500), `AT76` (the ATR 72-600, and -500), `A346` (the A340-600), `A388` (the A380-800),
`A359`, `A35K`, `A35K-freighter` (the A350F), `BCS1` (the A220-100), `BCS3` (the A220-300), `B733`, `B734`, `B735` (the 737 Classics), `B736`, `B737`, `B738`, `B739`, `B37M`, `B38M`, `B39M`, `B3XM`, `B752` (the 757-200), `B77L` (the 777F),
`B77W`, `B778` (the 777-8), `B779` (the 777-9), `B712` (the 717-200), `B722` (the 727-200F), `C17` (the C-17A Globemaster III), `C30J` (the C-130J Hercules), `CN35` (the CN-235: the HC-144), `B744` (the 747-400F), `B744-passenger` (the 747-400), `B748` (the 747-8F), `B748-passenger` (the 747-8 Intercontinental), `B763` (the 767-300F), `B763-passenger` (the 767-300ER), `B788`, `B789`, `B78X`, `CRJ2` (the CRJ200), `CRJ7` (the CRJ700), `CRJ9` (the CRJ900), `DH8D` (the Dash 8-400), `E135` (the ERJ-135), `E135-erj140` (the ERJ-140), `E145` (the ERJ-145), `E45X` (the ERJ-145XR), `E170`, `E75L`, `E275` (the E175-E2), `E190`, `E195`, `E290` (the E190-E2), `E295` (the E195-E2), `MD82` (the MD-80: MD-81, -82, -83, -88), `MD90` (the MD-90-30), `MD11` (the MD-11F), `MD11-passenger` (the MD-11). The renderer draws on them (`--shape shapes/A320.json`, or the parsed file
as `shape`): renderer/README.md, "A measured type"._

The A350F has no designator of its own in what we can read of ICAO Doc 8643 (the 777-8F shares `B778`), so its shape is
`A35K-freighter`, serving `A35K` for schemes whose `drawnOn` names it.

A scheme says where the paint goes as shares of each part ([COORDINATES.md](COORDINATES.md)). A shape says what
the parts are on a real type: its outline in meters, measured from the manufacturer's dimensioned drawings. With
both, a renderer can draw any scheme on any type, from the side, from below or in 3D.

`shapes/<id>.json`, checked by `schema/shape.schema.json`. The id is the ICAO type designator it's for (`A320`),
with a variant after a hyphen where one designator covers different outlines (`B738-winglets`); `types` lists the
designators a shape serves. CC0 like the rest of the data.

Two shapes serve `B763`: `B763`, the 767-300F (no cabin windows; the freighter schemes' `drawnOn` names it by its id),
and `B763-passenger`, the 767-300 and -300ER. A designator's own shape is the one whose id it is (`B763`, `B744`, `B748`,
`MD11`: the freighters, as every scheme measured on them is a freighter's; `A35K`, the passenger A350-1000); the
other is picked by its id (the viewer's type list, a renderer's `--shape`).

## Where the numbers come from

Each shape is read off its type's airport-planning document (Airbus "Aircraft Characteristics", Boeing
"Airplane Characteristics for Airport Planning"), whose general-dimensions pages have a dimensioned side, plan and
front view. The outlines are traced along the drawing's lines between a few points placed by hand, then thinned to
the points needed to stay within 1 cm (5 mm for small parts); the figures are the aircraft's measurements, not a
copy of the drawing. `tools/trace/` has the tools, the placed points for each type, and how to
rebuild a shape from its document.

`checks` lists the document's printed dimensions against the shape's own. They're within 1% for the Airbus types and
the 737 MAXs (1.5%); a larger gap is a reason to look again. Boeing's 757 and 767 side views draw the fuselage taller
than they print it, between their own dimension arrows (the 757-200's 4.5%, the 767-300's 2.4%), and the 737 Classic
sheets 1.9% shorter (the A340-600's 1.6%, the A380's 1.2%), while their plans and front views match the printed width and height. The shapes are fit to the
printed height (`tools/trace/fit_height.py`): the crown, belly and what sits on the tube scaled about the
centerline by the printed height over the tube's least drawn height across its middle third where crown and belly run
level (a 737's belly starts its sweep up to the tail inside that third), the fin carried with the crown. In the same
spirit, where a document prints the engine inlet's distance from the nose and the drawing's inlet is more than 1.5% off
it, `build.py` moves the whole nacelle (its x, cowl end, top and bottom lines) along x to the printed figure, the wing
staying where the plan draws it; the check then reads the fitted value and the source's note gives the drawing's.
The 737 Classic sheets draw the side view's nacelle 0.4-0.7 m ahead of their printed figures (and 0.69 m ahead of their
own plans), the 737-600's 0.24 m behind. Boeing's vector sheets draw the aircraft in thick lines
and print widths to the lines' inner edges, so a fuselage width by line centres reads up to 2.4% wide there (the
737-900ER, 777F); the 767-300F's drawing is up to 2.4% off its own figures, so its confidence is medium. One scale serves every view (the printed length over the drawing's nose-to-tail
distance), so a drawing that isn't quite to scale in one direction shows up here instead of being hidden: the
A320's span is 0.7% short. Where one sheet's figure disagrees with its own drawing and with a sibling's (the 787-8
and 787-10 sheets print the engine 0.2 m nearer the centerline than they draw it, and than the 787-9 sheet prints
for the same wing; the A350 plans draw the tailplane 2-3% wider than printed; the A340-300's front view and plan
both draw the outboard engines 0.2-0.4 m further out than its printed 38.54 m apart), the shape keeps the drawing's and
the source's note says so. The 737 Classics' confidence is medium for their views' disagreement on the nacelle (above).

Some sheets aren't drawn to one scale both ways, or at level: each view is evened out from its own printed figures
before tracing (`layers.py --xscale`: the E175, E190 and A319 sheets; the A340-600's plan, 2.6% wide across; the A330-200 and A330-800, drawn 1% and 1.4% short of their printed lengths), turned level from the aircraft's
ground attitude (`--rotate`: the A330s; the CRJs, at about 2°), or rendered to the side view's scale where it's on its own page (the A350,
A330 plans) or drawn larger (the E195-E2's front view, 1.17 times the side's, from its printed span; the CRJ900's, 1.35 times).

A traced fuselage line can pick up parts drawn over it: a wingtip or a fin edge crossing the crown (scanned as a run
of points jumping between two lines), or the nose gear's doors under the nose. Two rules clean these up, for every
shape:

- **The nose's underside is convex.** From the tip to where the belly reaches the cabin's level, the belly keeps only
  its outer hull. This took notches and steps of up to 0.3 m out of the A350s' and 787s' noses (and the scan's
  pixel staircase with them); the other types moved by 0.1 m or less.
- **No notches.** `tools/validate.py` flags any point on the crown or belly that sits more than 5 cm inside the line
  both ahead and behind it within 1.5 m (the tail cone's last 8% excepted, where the line closes). Where one turns
  up, drop the points of the part traced into the line, so the line runs straight across. Wingtips had been traced
  into the crown of the A350s, A319, A220-300 and E175, a fin edge into the A319's and the E190's.
- **The lines are smooth.** A scan's pixels come out as short stairs and straight runs, which show when a shape is
  drawn large and become ridges on a 3D model. `tools/trace/smooth.py` eases the crown and belly as one
  line round the nose tip (a Gaussian over 0.12 m; 0.8 m under the nose and 0.4 m under the tail cone) and every
  other line (the plan's width, the fin's, wings', tailplane's, wingtip's and engines') over 0.12 m with its ends
  held, then thins them back to 5 mm. No line moved more than 10 cm past the nose tip's first meter; the tip itself
  is now round, where the drawings had it flat.
- **A wingtip device starts on the wing's tip.** The wing ends where the front view shows the device leaving it;
  the plan's edges beyond that are the device's own, seen from above, and are cut there. The device's side-view
  edges start on the wing's tip edges at the wing's height and follow the side drawing above their lowest quarter,
  where it shows the device itself (below that the drawing's lines are the wing's outline running into the device).
  So wing and device meet by construction, in every view (`tools/trace/tipmeet.py`, after `smooth.py`).
- **The wing starts at its root.** The wing's middle height (`wing.z`) is first traced where both its front-view
  lines are, often well out along the span: the fairing, gear and engines hide the underside inboard (the A380's
  from 18 m, the A330s' and 787s' from 11.6 m), and a renderer holds that first height level inboard, so the wing
  met the fuselage up to 1.6 m too high (the A380's above mid-body). `wing.z` now starts at the root, where the
  drawing shows the wing meeting the fuselage: the front view's upper line where it leaves the section, less half
  the wing's thickness where both lines are first traced (else the side view's `wing.root`). The root moved down by
  0.16 to 1.57 m on 23 shapes (by under 0.15 m on the rest, left as they were).
- **The tail cone only falls.** Behind the fin's trailing edge the crown doesn't climb again: `tools/validate.py`
  flags it. On the 787s the tailplane's tips reach behind the tail cone and the printed overall length (62.81 m on
  the 787-9) is to them; the tracing had followed the tailplane's top edge out to its tip as the crown. The 787s'
  fuselages now end at the tail cone (the APU exhaust, 0.84 m short of the overall length) as their drawings show.
- **A fin's edges start straight.** A trace can curl at a fin edge's root, where it meets the fillet or the tail
  cone; the renderer carries the edge down to the crown from its first stretch, so a curl bends the fin's paint off
  along the fuselage (the first CRJ renders). `tools/validate.py` flags a first stretch whose slope is more than 1 m
  per meter off the edge's first half meter, and the edge starts on its straight run (seven shapes lost a point or
  two). The renderer also takes the half meter's slope where the first stretch is such a hook.
  The A330-200 had a tailplane traced into its tail cone's end too, and has the A330-300's (the same cone).

The 717's sheet prints no heights on the aircraft itself; its ground clearances (2.3) give the fin's top, the
tailplane's tip, the nacelle's middle and the crown above the ground, each as a range over the aircraft's attitudes
and loads. Their middles, less the crown's, are the checks for its tail and engine heights: good to about 0.15 m,
and within that (the fin's tip 4.09 m above the crown against 4.25, the tailplane's tip 2.95 against 3.15, the
nacelle's middle 1.73 below it against 1.65). Its plan prints the engine 3.30 m from the centerline (10 ft 10 in) where
both its plan and its front view draw the nacelle's middle at 2.87 m, with the nacelle as wide as printed (1.94 m
against 1.93) and a 0.25 m gap to the fuselage; the shape keeps the drawing's (−13%: see the source's note).

Boeing's MD-90 sheets draw the aircraft nose down at its ground attitude (turned level, 0.84°) and the tube 3.6%
taller than printed (fit to the printed height). The MD-80's document is a 1989 scan over a printed grid as thick as
its outlines; laid over it, the MD-90's lines less its plug land on its own within a line's width, except at the tail
cone, where the scan draws the underside up to 0.35 m higher and the fin 0.3 m further forward: the `MD82` shape keeps
the vector drawing's tail (confidence medium).

Two shapes serve `E135`, which covers both the ERJ-135 and the longer ERJ-140: `E135`, the ERJ-135, and `E135-erj140`. Embraer's
ERJ-140 figure isn't drawn to one scale (its side and plan short lengthwise against their spans, the side nose down) and evened out
still misplaces its doors, and its door figure prints the ERJ-135's 12.79 m to the overwing exit; so `E135-erj140` is the ERJ-145's
measured lines less the two plugs its manual's lengths give (0.91 m ahead of the wing, from the nose-to-main-gear figure; 0.51 m behind),
which two side-on photos bear out (10 windows ahead of the exit and 5 behind, the exit about 13.9 m back); confidence medium. The
ERJ-145XR (`E45X`) is the ERJ-145's lines on its own figure (the same airframe, with winglets). `E275`, the E175-E2, hasn't entered
service: Embraer's E2 manual draws it, and it's the E190-E2's lines less two plugs, snapped to that figure.

Two shapes serve `MD11`: `MD11`, the MD-11F (no cabin windows, the main-deck cargo door forward on the left: nearly
every MD-11 still flying is a freighter), and `MD11-passenger`, from the same sheet's windows and doors. Boeing's MD-11
sheet is a picture of about 26 px a meter, not quite to one scale: its plan draws the tailplane 4% short and the
wing's root and tip up to 0.9 m forward of their printed distances, its side view the tube 1.7% tall (fit to the
printed 6.02 m) and its front view the fuselage's circle 5% large (tied to the side by the circle's centre); confidence
medium. The 727-200F's sheet (`B722`) is a 1978 scan on graph paper: the grid's lines run through the drawing, and
where an outline runs along one (the nose's crown) it's placed point by point. Its front view draws what stands above
and beside the fuselage 0.25-0.5 m low against the fuselage's circle, so the tailplane takes the side view's height
(the recipe's `stabilizerZ`). Its main-deck cargo door is the 727-100C's from Boeing's door table (727-200F
conversions fit the same size just aft of the entry door); confidence medium.

The Dash 8-400's (`DH8D`) sheet (Figure 2-2 of Bombardier's Series 400 planning manual) draws the side view at the
ground attitude (turned level, 1.26°) and the plan turned 31.92° and 0.896 times the side's size (rendered to its
scale from the printed span and tailplane span). Its side view draws the fuselage 2.55 m tall, as the ground
clearances (Figure 2-4: the crown 3.44 m up, the belly 0.87 m) and the front view (2.59 m) do; the cross section
prints the width, 2.69 m, which the plan and front view draw, so the shape keeps the drawn height. The nacelle hides
15 cabin windows from the side: placed on the drawn ones' pitch (photos show the row unbroken behind the propeller).
Its long dorsal fin runs from the wing's root fairing to the fin (its `fillet`, 10.5 m long). Each door's side is its
own clearance figure's: the airstair door, aft passenger door and aft baggage door on the left, the forward baggage
door (a Type I exit in the extra-capacity cabin) and the aft service door on the right.

The ATR 72-600 (`AT76`) is read off ATR's own dimensioned three views of the 72-500 (the ATR family brochure's
72-500 page, on atr-aircraft.com): ATR's airport planning manuals are on its customer portal only, and the 72-600's
fact sheet draws the same views, with the same figures, as a picture. The 72-600 is the 72-500's airframe (the same
length, span, 568F propellers); ATR 72-200s (AT72) have four-bladed propellers and aren't served. The drawing is an
illustration (shaded, its lines from black to pale grey: `layers.py --mode lines`) and its plan is turned 45°; it's
consistent within about 1% (its plan draws the nacelles 4.4% further out than its front view and the printed
propeller spacing: the shape keeps the front view's). Door sides from Commons photos of each side: the cargo door
forward on the left only, the forward exit and the aft door on both. Confidence medium. The ATR 42-600 (`AT46`) is
read the same way off the 42-500's page (its front view drawn 2.1% smaller than its side, rendered to its scale; its
propeller disc 1.8% under the printed 3.93 m, kept), its doors' sides as the ATR 72's (a Commons photo of a 42-600's
left side agrees).

The C-17A Globemaster III (`C17`) has no airport-planning document in the open: it's read off the three views in the
USAF's C-17A flight manual (TO 1C-17A-1, 2001, page 1-16), a public-domain scan on Wikimedia Commons of about 26 px a
meter (`layers.py` reads the PNG itself, `--mode image`). It's an illustration with its own figures in feet and
inches, scaled by its printed 174 ft overall length (to the fin-top fairing's tip; the tail cone is 48.35 m back), the
plan and front view at that scale within 0.2% (the front view rendered to it by the printed 169 ft 10 in span). Within
that scale it doesn't quite draw its own figures: the outboard engine's inlet 0.66 m ahead of its printed 47 ft 10 in
(moved to it, as on every shape; the inboard one's is within 0.8%), the engines' places across 1.7% in (kept), the
tailplane 1.2% short, and the fin's top 9.78 m above the crown in both side and front views where its printed heights
(55 ft 1 in to the fin, 24 ft 1 in to the crown, above the ground at some unstated load) differ by 9.45 m (kept: a
side-on Commons photo lands on the drawn outline). Its 30 ft 2 in to the crown at the fin fits nothing it draws.
The fuselage is drawn 6.31 m tall and 6.8-6.9 m wide (Boeing's "22.5 ft diameter" is the width; the side view, the
front view and the photo agree on the height, so it isn't fit to it). The high wing's root is the front view's, its
middle about 1 m under the crown at the fuselage's side with the fairing over the top; the T-tail's tailplane sits on
the fin, its fairing the fin's top; the main gear's sponsons are left out of the belly (the gear doors under them
bridged); the inboard nacelle's aft end, hidden behind the outboard one, is the outboard's profile. Doors as drawn
(the crew door, left; the paratroop doors behind the sponsons), no cabin windows. The side view draws the front
windshield pane's post 0.1-0.25 m under the outline; the pane is carried forward to the post on the crown from the
front view (above, Cockpit), so the two meet across the nose as a front-quarter photo shows. Confidence medium.
The C-130J Hercules (`C30J`, also serving `C130`: the HC-130J and every air force's C-130s, short-bodied) has no
airport-planning document in the open either: it's read off the three views in the USAF technical order T.O.
1C-130A-2-2 (page 1-3, the late C-130A with the radome nose), a public-domain scan on Wikimedia Commons of about 39 px
a meter. The C-130J keeps the C-130's 97 ft 9 in fuselage, wing, tail and nacelle outlines; its six-bladed Dowty R391
propellers are 4.115 m across (EASA's type certificate data sheet P.087), where the drawing's discs are the C-130A's
15 ft 1 in, so the recipe gives the propeller's `diameter` and the drawing places it. Scaled by the printed 97 ft 9 in
to the tail cone; the printed wheelbase is drawn within 0.1%, the span within 0.2% in plan and front view (the plan,
drawn 3.1% short lengthwise, evened out). The side view draws the propellers' plane 0.21 m behind the printed 29 ft
11 in from the nose, which the plan draws: every nacelle and propeller is moved to it (`build.py`, as for a printed
inlet). The scan draws the fuselage 0.08-0.13 m off the wing's middle in plan and front view: each view's centerline is
halfway between. It draws the crown 4.40 m above its ground line where it prints 15 ft (4.57 m); the drawn fuselage
height (3.88 m, the front view 3.84 m) is kept, as a side-on photo of an HC-130J bears out. The high wing's upper
surface runs over the fuselage (its centre section); the tailplane, drawn in the front view along the wing's upper
line, takes the side view's height (`stabilizerZ`, 0.31 m under the crown). Four turboprops: each nacelle's
propeller (`propeller`, `propeller2`: hub and disc) and width from the plan (`nacelle`, `nacelle2`); the inboard
nacelle's top, behind the outboard one, is placed under it by the dihedral. Main gear sponsons and the HC-130J's
external tanks are left out; the crew door (left) and paratroop doors as drawn; the C-130A's forward cargo door and
round windows aren't the C-130J's and are left out. Tailplane +1.5% (as drawn), fuselage width +1.6% against
Lockheed Martin's 14 ft 2 in (line centres). The flight deck's glass is the C-130J's (2026-11-22: the
front windows needed work, the middle over the nose was missing), from HC-130J photos placed against the drawing's
panes: the front pane each side carried forward to its center post on the crown from the front view (0.86-1.32 m up
at the centerline), three side panes under three eyebrows (the C-130A's fourth, forward eyebrow isn't the J's), a
chin window under the front pane and the tall side window by the number (not the C-130A's two small ones). The
outline's nose (radome, forehead, chin) lands on the Juneau photo within about 0.05 m, so it's kept. The stretched
C-130J-30 isn't drawn yet. Confidence medium.
The CN-235 (`CN35`: the Coast Guard's HC-144 Ocean Sentry, a CN-235-300 MP) has no airport-planning document in the
open either: it's read off the "Three View Drawing" in EADS-CASA's CN-235-300 Technical Review, as published in the
BLM's 2002 evaluation of the type (nifc.gov), the manufacturer's own dimensioned three-view: three embedded pictures on
one page at one scale, about 28 px a meter, shaded with black outlines (`layers.py --mode lines`). Scaled by its printed
21.40 m; its span drawn within 0.4% of the printed 25.81 m, its plan drawn 1.3% long lengthwise (evened out). The sheet
doesn't draw all its own figures: its tailplane is drawn 11.16 m across in plan (about 11.0 m in front) against the
printed 10.20 m, so the printed span is taken (`stabilizerSpan: "printed"`, build.py: narrowed outboard of its root);
the front view draws the propellers 7.31 m apart (the plan 7.05 m) against the printed 7.0 m, which places them
(`propeller.apart`); its discs are about 3.4 m across where the same document's text gives the 14RF-37's 3.66 m
(`propeller.diameter`); and its "6.20 m" wheelbase is drawn 7.25 m (the USACE's TSC 13-2: 6.92 m). The front view's
crown is hidden under the wing: it's tied to the side view by the fin's tip, the propeller hubs and the wing's root
height, which agree within 0.07 m. The fin's and tailplane's leading edges are drawn as thick black de-icing boots:
their outer edges are placed. No cabin windows: the transport's row of 12 is plugged on the HC-144 but for two or three
portholes a side (a short row would also tie the cabin's end, a landmark, to mid-body ahead of the ramp); the sponsons, and the HC-144's radar radome under the forward fuselage and its sensor
turret, are left out. A side-on photo of HC-144B 2311 lands on the outline within about 0.1 m. Confidence medium.

## Axes

Meters, for one side of the aircraft (the other mirrors it):

- **x:** back from the nose tip.
- **y:** out from the centerline.
- **z:** up from the fuselage's centerline: halfway between the crown and the belly where the fuselage is a
  constant tube.

Every line is a list of points joined by straight lines; they're dense enough that no smoothing is needed. A
line runs from root to tip, or from nose to tail.

## Parts

**Fuselage.** `length` (nose tip to tail cone); `crown` and `belly` from the side, as [x, z]; `halfWidth` from
above, as [x, y]; `widest`, the z of the cross-section's widest line. A cross-section at x is two quarter-ellipses
each side: from the widest line up to the crown and down to the belly, half-width `halfWidth` at x.

An upper deck standing above the main tube (a 747's) is `hump`: its `crown` from the side, [x, z], from where it
leaves the main tube's crown to where it rejoins it, and its `width` from the front where it rises from the main
tube; optionally its `section`, the front view's outline [y, z] where it stands highest, from its top down to where it
meets the main tube. The fuselage's `crown` is then the main tube's own, run level beneath the hump, so the fuselage's paint space
is the main tube's on every type and a scheme measured on it is placed as measured. Through the hump, the deck adds
to the tube's section what its drawn `section` has over the tube, scaled along the fuselage by the hump's height
over the main crown (so its silhouette is the hump's crown from the nose) and across by the fuselage's width. Glass and doors whose
middle is above the main crown are the hump's (on the 747 the upper deck's windows and the flight deck lie below
it, on the main tube's side).

Two shapes serve `B744` as two serve `B763`: `B744`, the 747-400F (the freighter schemes' `drawnOn` names it by its
id), and `B744-passenger`, the 747-400. Likewise `B748`, the 747-8F, the shape for the designator, and `B748-passenger`,
the 747-8 Intercontinental, which passenger schemes name in their `drawnOn`.

Two shapes are built from a measured sibling where the manufacturer has published no clean drawing of their own.
**`B778`** (the 777-8, which hasn't flown) is the 777-9's traced lines (`b779/`) with the 777-8's two plugs taken out
by `plug.py`, from Boeing's own figures: 5.867 m in all (232 ft 6 in overall against the 777-9's 251 ft 9 in, the same
tail), 3.734 m of it ahead of the main gear (the two wheelbases, 93 ft 10 in and 106 ft 1 in) and 2.133 m behind (7
and 4 of the 777's 21 in frames); the 777-8F brochure's door 1, forward and aft cargo doors agree. Where in those
stretches the plugs go, and so where doors 2 to 4 are, Boeing hasn't published for the 777-8: they follow the 2015
777X brochure's 777-8X servicing plan (door 2 at its passenger bridge, door tabs at door 3, the optional exit and door
4 of a 777-9 with its plugs out), so its confidence is low. As on `B779` (rebuilt so), its door 3 is the 777-9 door table's (the 777-9 sheet hides it behind the flaps) and its
cockpit panes are the 777-300ER's (the 777X keeps the 777's flight deck; the 777-9 sheet draws its windshield too small
and low to meet its twin over the nose). **`B748-passenger`** is the 747-400's measured shape with the 747-8F's plugs, wing and
GEnx nacelles (`b748/derive.py`'s), and the -8I's upper deck: 4.10 m longer (the forward plug lies under it), its
fairing running out about 1 m further aft, as both of the 747-8 document's scanned side views and the photos draw it.
Its upper deck's windows and door are measured on two side-on Commons photos of Lufthansa 747-8Is (9 windows, the door,
15, a gap, 2; Korean Air's alike), the scans being too coarse to count them.

**Fin.** From the side, as [x, z]: `leading` and `trailing` edges from the root to the tip, the `rudder`'s hinge
line, and a dorsal `fillet`'s curve where there is one. The leading edge's root is where its straight run, carried
down, meets the crown: the fillet ahead of it isn't part of the fin's space.

**Wing and tailplane** (`wing`, `stabilizer`). From above, `leading` and `trailing` edges as [y, x] from the root
(at the fuselage's side) to the tip; from the front, `z`: the surface's middle height along the span, as [y, z].
Seen from the side, a surface is the band between its edges at their heights. The wing stops where a wingtip
device rises from it.

**Flap track fairings** (`wing.fairings`, left out where none are drawn): the canoes hanging under a wing's
trailing edge, which make a side view read as an airliner. Each is its middle's distance out from the centerline
(`y`, from the front view's bumps under the wing), its front and aft ends (`x`, from the side view: from ahead of the
trailing edge to behind it) and how far it hangs below the wing's lower surface (`depth`). The side view draws the
near wing's as canoes from its underside, deepest a little aft of their middle and rising to a point at the aft end,
in the wing's underside color, the wing's edge over their tops. Measured from the manufacturers' drawings, never from
anyone's artwork.

**A high wing** (the Dash 8's, ATR's) is a wing like any other whose root is on the crown: its plan's edges still
start at the fuselage's side, and its `z` there is the front view's, at or above the crown (the Dash 8-400's middle
at the crown's height, its centre section passing through the top of the fuselage). No flag says so: from the side
the near wing is a band along the top of the fuselage, drawn over it as a low wing's is; in 3D the root's section is
carried in to the centerline as on every type, so the two wings meet over the cabin. The wing root rule below
(`wing.z` starts at the root) holds as it is: the front view's upper line leaves the fuselage at the wing's root.

**Wingtip** (left out for a plain tip). `kind`; its `leading` and `trailing` edges from the side, as [x, z]; its
`front`, the device's middle line seen from the front, as [y, z].

**Engines.** One side's, inboard first. `x`: the inlet lip and the exhaust (the nozzle's end, not a plug's tip);
`cowlEnd`, where the fan cowl ends; `y`, the nacelle's center out from the centerline; its `top` and `bottom`
from the side, as [x, z]; its `inlet` from the front (center height, width and height). A four-engined type lists
two. From the side the outboard nacelle is the nearer, and can hide the inboard one's aft end (the A340's nozzle):
the inboard one's lines end where they go behind it, and a renderer draws it first, with its titles and logos, so
the nearer nacelle covers both. `mount`: under the wing
(`wing`, the default), or on the rear fuselage (`fuselage`: the 717, CRJs, ERJs, MD-80 and MD-90), where
it hangs on a stub `pylon` from the fuselage's side: its plan view's `leading` and `trailing` edges as [y, x] from its
root (at the fuselage) to its tip (at the nacelle), its middle height from the front as `z`, [y, z], and its
`thickness` there (the front view's top to bottom). A type whose engines are all on the fuselage has none on the
wing; a wing doesn't need one.

**A turboprop's engine** is a wing engine with a `propeller`: the disc's plane `x` (back from the nose), the hub's
height `z`, its `diameter` and number of `blades`, and its `spinner` from the side (`x`: tip and base, where it
meets the nacelle; its `diameter` there). The nacelle (`x`, `top`, `bottom`) starts behind the spinner and holds the
wing: its top runs over the wing (the Dash 8-400's), so it has no pylon, and its `y` is the propeller's (the documents
print the propellers' spacing). Its `inlet` is the intake under the spinner. A nacelle that isn't round from the
front (a turboprop's, deep and narrow) has its plan's `halfWidth`, [x, y] from its own middle, as a tail engine has.
Drawn: from the side and from below the disc is seen edge on, a faint lens a twelfth of its diameter thick (the
blades turning), with the spinner in front of it; in 3D, the spinner, still blades (tapered, pitched) and a faint
disc. Seen edge on, still blades would be a line: the side and below views draw the disc, 3D both.

**A tail engine** (the MD-11's, the 727's): `mount: "tail"`, on the centerline (`y` 0), listed first. `duct` says
how it's fed:

- **`straight`** (the default; the MD-11, DC-10): the nacelle runs through the fin's base, the fin standing on its
  top. `top` and `bottom` are its outline from the side where it stands clear of the fuselage: the top from the inlet
  lip along the nacelle under the fin (the fin is drawn behind it and its root, the leading edge's foot, sits on that
  line), then up the rudder's foot to the fairing over the nozzle and down its back; the bottom along the nacelle to
  the cowl's end, the nozzle, and up under the fairing. `strut`, [x, x], is where a strut joins the nacelle's bottom
  to the crown below it (the MD-11's, 0.6 m tall).
- **`s`** (the 727, L-1011): the engine is in the tail cone, fed by an S-duct from an intake on the crown ahead of
  the fin. `top` and `bottom` are the intake's fairing from the side: its top from the lip back to where it runs into
  the fin's leading edge (the fin's root sits on it), its bottom the crown.

Either way `x` is the inlet lip (the intake's) and the exhaust (the nozzle's end); `halfWidth`, [x, y], the nacelle's
or intake's side from above; `inlet` its opening from the front; `nozzle` (`top`, `bottom`) the bare exhaust where it
shows (the MD-11's under its fairing, a plug's cone included; the 727's at the tail cone's end); `cowlEnd` where the
fan cowl ends. One format serves both: what differs is how the outline meets the fin and fuselage (a pod under the
fin on a strut, or a fairing on the crown), which the 3D model reads from `duct`.

**A T-tail.** `stabilizer.mount: "fin"`: the tailplane sits on the fin (the 717, CRJ, ERJ, MD-80), its root at the fin's
side (a few tenths of a meter out) and its `z` there the fin's height where it crosses, near the fin's top, instead of on the
fuselage. The fin's `leading` and `trailing` edges run up to its top, the tailplane's fairing on it included (the
717's rises 0.8 m above the tailplane's root); the tailplane is drawn across it, nearer, from the side.

**Cabin.** `windows`: their `z` (bottom, top), `width`, and each one's center `x`; a double-deck cabin's upper row is
`upperWindows`, the same way. `doors`: doors and emergency
exits as boxes, `x` (forward, aft) and `z` (bottom, top). The left side's; the right side mirrors them, which is
close but not exact on most types. A door on one side only has `side`: the lower deck's forward and aft cargo doors
are on the right (as Boeing's 757 and 787 door tables say, and on every type here but the CRJs and ERJs, whose door figures put theirs on the left); a
freighter's main-deck door is on the left. The bulk cargo door's side is each type's own document's: on the right on
the 777s (the 777-9's door table 2.7.1, D6-58329-2's cargo-door figures 2.7.5 and 2.7.6, right side views) and the 747s
(D6-58326-1's bulk-door figure 2.7.8, a right side view; the 747-8's door figure 2.7.1 draws it dashed, on the far side
of a left side view); on the left on the 787s (D6-58333's table) and the 767s (D6-58328's bulk-door figure 2.7.6, a left
side view); on the MD-11s where their sheet draws it (left). Where the drawing doesn't show the windows (Boeing's), they're placed at the
type's frame pitch and `windows.note` says so. The A220s' document draws none and their spacing isn't regular round
the overwing exit, so theirs are measured on openly licensed Wikimedia Commons photos of the left side, two a type
that agree, scaled between the doors (only the measurements are taken; each photo is in the shape's `sources`). Those
photos showed the A220-300's general-dimensions sheets distorted along the body: they draw the doors up to 1 m from
where their own door-distance figure puts them (the photos' 7 more windows than the A220-100's, 3.7 m of plugs, back
the figure), and the engine inlet 1.05 m forward of the 12.17 m they print. So `BCS3` is the A220-100's measured
outlines with the two plugs added back (`plug.py`), checked against the A220-300's printed figures (within 0.5%), with
the figure's doors.

**Cockpit.** `windows`: each pane's outline from the side, as [x, z].

## Painting a shape

The part spaces are [COORDINATES.md](COORDINATES.md)'s; on a shape they sit like this:

- **Fuselage:** x is the share of `length`. At that x, the center is halfway between crown and belly and the
  radius half their gap; from the side, a point at y is drawn `r · sin(y · 90°)` from that center. Round the
  fuselage (3D), y is the angle up from the belly, `acos(−y)`, on the cross-section above.
- **Upper deck** (`fuselage.hump`): no space of its own. It wears the fuselage's paint at the crown (y 0.985),
  carried straight up at each x, as the fin's fillet does; in 3D the deck is part of the fuselage's section, textured by
  height on its sides, so the fuselage's paint and windows run on over it unstretched.
- **Fin:** y is the share of the height from the leading edge's root to the tip; x the share of the chord between
  `leading` and `trailing` at that height. The rudder is aft of `rudder`. Aft of the leading edge's root the crown
  falls away, so the fin's lowest strip there is a little below y = 0: paint it as y = 0. A `fillet` takes the
  paint at the fin's root leading edge (x 0, y 0).
- **Wing and tailplane:** y is the share of the span from the root to the tip; x the share of the chord between
  `leading` and `trailing` at that y.
- **Wingtip:** y is the share of its height from where it leaves the wing to its tip; x the share of the chord
  between `leading` and `trailing` at that height. The side view draws the wing's trailing edge a little below its leading edge (the
  wing's drawn thickness), so the device's trailing root drops the same, easing back over its lower 40%.
- **Cockpit:** each pane where it's measured, by height. The windshield (the pane reaching nearest the outline's
  top: not always the foremost, the C-17's chin window is further forward) meets its twin along a center post on the
  nose's centerline, which from the side is the crown's outline: its forward edge's points within 12 cm of the crown
  sit on it (drawings place the panes only roughly up there, Boeing's up to 20 cm low), so round the fuselage the two
  windshields meet in the middle. Over an upper deck the outline's top is the hump's crown. `build.py` applies this
  (`windshieldTolerance` in a recipe widens it: the 747 sheet draws its windshield up to 18 cm low), and
  `tools/trace/windshield.py`, after `smooth.py`, finishes it where the glass still stops short of the
  crown: the post (the pane's edge rising steeply from its foremost point, to where its top edge levels off) goes onto
  the outline, its points up to 25 cm under it lifted (the 737 Classic sheets draw it 0.16-0.23 m low), with the
  outline's own points between so it follows the curve. `tools/validate.py` checks that the glass reaches the crown
  (within 0.02 of the fuselage texture's height): 27 shapes fell short of it until 2026-11-18. A point further under
  than 25 cm isn't on the post (the ATRs' drawn front edge runs down the nose's side): it stays, and there the two
  windshields meet at the post's top only.
  A pane's edges are straight from the side: the renderer steps along each one in meters (5 cm at most) before
  taking it into fuselage space, whose mapping bends an edge drawn between two corners near the crown (the
  C-130J's windshield's bottom edge, from its post on the crown back to its aft corner, bowed up to 0.16 m).
  A windshield facing forward on a blunt nose (the C-17's) lies along the outline from the side, where a side
  drawing can't show where it reaches: its post is placed from the front view, on the crown at the x where the crown
  is at the heights the front view draws the pane's bottom and top at the centerline.
- **Engines:** x is the share from the inlet lip to the exhaust; y the share between `bottom` (−1) and `top` (1)
  at that x. The same on a rear-mounted nacelle: its outboard face is the one seen from that side.
- **A tail engine** (`mount: "tail"`) wears the fin's paint carried down below its root, not the engines': the fin's
  base, and its areas carried on across it, each area's points on the fin's foot (y 0 or below) going on down and
  those on its leading or trailing edge on out, so a stripe running off the fin's foot runs on across the nacelle
  (Western Global's MD-11s), and the fin's own art stays where it is in fin space (the fin's root is the leading
  edge's foot on the nacelle, so fin shares measured on any type still fit). Not the rudder, a separate surface. Its
  inlet lip is the scheme's `engines.inletLip`, its `nozzle` bare metal; the scheme's engine areas, titles and logos
  are the other engines'. Photos agree on the fin's paint: UPS's brown, Lufthansa Cargo's blue, KLM's white and
  FedEx's purple nacelles (FedEx's fan cowl is white, which a scheme can't say yet), the 727's intake under FedEx's
  purple tail.
- **A propeller:** its blades dark and never painted, its spinner the scheme's `engines.cowling` (COORDINATES.md).
- **A stub pylon** (on the fuselage) takes the scheme's `engines.pylon`, else the fuselage's paint where it meets the
  fuselage (it's faired into the body).
- **A T-tail's fin:** its space runs from the root to its top as on any fin, the fairing on top included; the
  tailplane crosses its top tenth or two (the 717's root at y 0.8), as on the aircraft. Delta's widget (up to y 0.74)
  stays clear of it.

## For apps: the compact export

`tools/export_shapes.py OUT.json` writes every shape in one file for an app that builds its own model (Skyarium's
paper models): each line thinned to stay within 2 cm (1 cm on spinners, inlets, wingtip devices, pylons and cockpit
panes), every number in whole centimeters, lines flattened to `[a0, b0, a1, b1, ...]` in the shape's own axes, and
`types` mapping each designator to the shapes serving it, its own first. Sources, checks and notes stay here. 146 KB
(55 KB compressed) for the 65 shapes, against 788 KB as measured. With it, `export_compact.py` gives each scheme its
`on` (the shape it was drawn on: a freighter's scheme is drawn on a shape without cabin windows, so an app can take
the freighter of a type with two) and its paint for one type (`types`, docs/COORDINATES.md).

## Not yet

- **More types.** Next, in order (busiest in Skyarium's skies first; "plugs" means built from a measured sibling by
  its fuselage plugs, as the 787-8 and 787-10 were):
  1. **777-8** (B778): done from the 777-9 by plugs (above); redo on its own sheet once Boeing adds the 777-8 to
     D6-86073 (its 2.2 and door table would settle doors 2 to 4).
  2. **The hard cases,** each needing the shape model or the trace tools extended first: the **747-8I**
     (B748-passenger) is done (above), **the T-tails with engines on the fuselage:** the **717** (B712)
     is done, so the shape model, `build.py` and the renderer handle the layout (`engines[].mount`, the stub `pylon`,
     `stabilizer.mount`), and so are the **CRJ200, CRJ700 and CRJ900** (CRJ2, CRJ7, CRJ9, from Bombardier's own planning manuals), the **ERJ-135, -140, -145 and -145XR** (above), the **MD-90** (MD90) and the **MD-80**
     (MD82, serving MD81, MD82, MD83 and MD88: the MD-90's measured airframe less its 1.45 m plug, with its own JT8D
     nacelle, doors and windows from its document, a gridded 1989 scan); the **Dash 8-400** (DH8D: propellers, a high wing, from Bombardier's planning manual) is done, and the **ATR 72-600** (AT76, serving AT75 too: from ATR's own dimensioned drawing; its planning manual isn't public); and the **ATR 42-600** (AT46, serving AT45, the same way); next the Dash 8-100/200/300 (DH8A-C, whose planning manuals are on Bombardier's page too). The center engine is done (the
     **MD-11**, `MD11` and `MD11-passenger`; the **727-200F**, `B722`): the **DC-10** (DC10) and **L-1011** (L101: an
     S-duct like the 727's) would use it.
     The A319 is drawn with sharklets; many fly with wingtip fences, which would be a variant. The 757-200 and
     767-300ER are drawn with plain wingtips, as Boeing's documents draw them; most US ones fly with blended winglets
     (Aviation Partners Boeing's), which would be variants from a non-Boeing source.
- **Shapes for the hard cases** above: done. (Propellers and a high wing: the Dash 8-400; engines on the fuselage and T-tails: done, the 717; a 747's upper deck: done, `fuselage.hump`; a center engine: done, `engines[].mount: "tail"`, the MD-11 and 727.) A label on the upper deck itself (a title on the hump) has no space yet: titles stay on the main tube. The 717's
  tailplane-and-fin fairing (the "bullet") is the fin's outline from the side but isn't modelled round in 3D.
- **The fuselage's real cross-section.** Two quarter-ellipses are close on the A320 (3.97 m wide, 4.15 m tall);
  the front view has the true one, partly hidden by the wing and gear.
- **The wing-to-body fairing, pylons, flap-track fairings, landing gear:** in the drawings, not yet in the
  shapes.
- **In the renderer:** smooth curves through a scheme's area points; a pylon where a
  nacelle sits as high as the wing (the A320's gets none); the 3D example built from a measured shape.
