# Shapes

_Status: new (2026-11-15). Eighty-three shapes: `A30B` (the A300B4), `A306` (the A300-600F), `L101` (the L-1011-1 TriStar), `L101-500` (the L-1011-500), `B462` (the BAe 146-200), `A319`, `A320`, `A20N`, `A321`, `A21N`, `A332`, `A333`, `A338`, `A339`, `A343` (the A340-300), `AT46` (the ATR 42-600, and -500), `AT76` (the ATR 72-600, and -500), `A346` (the A340-600), `A388` (the A380-800),
`A359`, `A35K`, `A35K-freighter` (the A350F), `BCS1` (the A220-100), `BCS3` (the A220-300), `B733`, `B734`, `B735` (the 737 Classics), `B736`, `B737`, `B738`, `B739`, `B37M`, `B38M`, `B39M`, `B3XM`, `B752` (the 757-200), `B753` (the 757-300), `B772` (the 777-200ER), `B77L` (the 777F),
`B77W`, `B778` (the 777-8), `B779` (the 777-9), `B712` (the 717-200), `B722` (the 727-200F), `B722-passenger` (the 727-200), `C17` (the C-17A Globemaster III), `C30J` (the C-130J Hercules), `CN35` (the CN-235: the HC-144), `CVLT` (the Convair 580), `B74S` (the 747SP), `B742` (the 747-100 and -200), `B744` (the 747-400F), `B744-passenger` (the 747-400), `B748` (the 747-8F), `B748-passenger` (the 747-8 Intercontinental), `B763` (the 767-300F), `B763-passenger` (the 767-300ER), `B788`, `B789`, `B78X`, `CRJ2` (the CRJ200), `CRJ7` (the CRJ700), `CRJ9` (the CRJ900), `DH8D` (the Dash 8-400), `E135` (the ERJ-135), `E135-erj140` (the ERJ-140), `E145` (the ERJ-145), `E45X` (the ERJ-145XR), `E170`, `E75L`, `E275` (the E175-E2), `E190`, `E195`, `E290` (the E190-E2), `E295` (the E195-E2), `DC91` (the DC-9-10), `DC93` (the DC-9-30), `DC95` (the DC-9-50), `DC10` (the DC-10-30, serving the -10 and -40), `MD82` (the MD-80: MD-81, -82, -83, -88), `MD90` (the MD-90-30), `MD11` (the MD-11F), `MD11-passenger` (the MD-11). The renderer draws on them (`--shape shapes/A320.json`, or the parsed file
as `shape`). See renderer/README.md, "A measured type"._

The A350F has no designator of its own in what we can read of ICAO Doc 8643 (the 777-8F shares `B778`), so its shape is
`A35K-freighter`, serving `A35K` for schemes whose `drawnOn` names it.

A scheme says where the paint goes as shares of each part ([COORDINATES.md](COORDINATES.md)). A shape says what the
parts are on a real type. It's the type's outline in meters, measured from the manufacturer's dimensioned drawings. With
both a renderer can draw any scheme on any type, from the side, from below or in 3D.

`shapes/<id>.json`, checked by `schema/shape.schema.json`. The id is the ICAO type designator it's for (`A320`), with a
variant after a hyphen where one designator covers different outlines (`B738-winglets`). `types` lists the designators a
shape serves. CC0 like the rest of the data.

Two shapes serve `B763`. `B763` is the 767-300F. It has no cabin windows, and the freighter schemes' `drawnOn` names it
by its id. `B763-passenger` is the 767-300 and -300ER. A designator's own shape is the one whose id it is. For `B763`,
`B744`, `B748`, `MD11`, `B722` and `A306` that's the freighters, as every scheme measured on them is a freighter's. For `A35K` it's the
passenger A350-1000. The other is picked by its id (the viewer's type list, a renderer's `--shape`).

## Where the numbers come from

Three shapes of the 1980s are measured from other kinds of document, each stated in its sources. The A300B4 (`A30B`) is
from Airbus's own A300 airport-planning document, its B2/B4 pages (a 1980 scan). The L-1011-1 (`L101`) is from
Lockheed's L-1011 Maintenance Manual, chapter 6 (Dimensions and Areas), as scanned on the Internet Archive: no
airport-planning document for it is openly available, and only its figures are taken. The BAe 146-200 (`B462`) has
no openly available manufacturer's drawing at all (BAE's planning manual is on its customer portal), so it's measured
from an enthusiast's dimensioned schematic on Wikimedia Commons ("File:BAe 146 v1.0.png", Julien.scavini, CC BY-SA
3.0), its length and span evened out to EASA's type certificate (TCDS EASA.A.182); its confidence is low and its
checks are in `tools/trace/b462/README.md`. The A300 and L-1011 scans zigzag at a few centimeters over half a meter, too
long a wave for `smooth.py`, so their straight runs are fitted straight (`tools/trace/a30b/straighten.py`,
`tools/trace/l101/straighten.py`). The 727's tail, traced across the 1978 sheet's grid, is set to lines and fitted curves
through the scan the same way (`tools/trace/b722/straighten.py`).

Each shape is read off its type's airport-planning document (Airbus "Aircraft Characteristics", Boeing "Airplane
Characteristics for Airport Planning"). Its general-dimensions pages have a dimensioned side, plan and front view. The
outlines are traced along the drawing's lines between a few points placed by hand, then thinned to the points needed to
stay within 1 cm (5 mm for small parts). The figures are the aircraft's measurements, not a copy of the drawing.
`tools/trace/` has the tools, the placed points for each type and how to rebuild a shape from its document.

`checks` lists the document's printed dimensions against the shape's own. They're within 1% for the Airbus types and
1.5% for the 737 MAXs. A larger gap is a reason to look again. Boeing's 757 and 767 side views draw the fuselage taller
than they print it, between their own dimension arrows (the 757-200's 4.5%, the 767-300's 2.4%). The 737 Classic sheets
draw it 1.9% shorter (the A340-600's 1.6%, the A380's 1.2%). Their plans and front views match the printed width and
height. The shapes are fit to the printed height (`tools/trace/fit_height.py`). The crown, belly and what sits on the
tube are scaled about the centerline by the printed height over the tube's least drawn height. That's taken across its
middle third where crown and belly run level (a 737's belly starts its sweep up to the tail inside that third). The fin
is carried with the crown. In the same spirit a document may print the engine inlet's distance from the nose. Where the
drawing's inlet is more than 1.5% off it, `build.py` moves the whole nacelle (its x, cowl end, top and bottom lines)
along x to the printed figure. The wing stays where the plan draws it. The check then reads the fitted value and the
source's note gives the drawing's. The 737 Classic sheets draw the side view's nacelle 0.4-0.7 m ahead of their printed
figures (and 0.69 m ahead of their own plans). The 737-600's draws it 0.24 m behind. Boeing's vector sheets draw the
aircraft in thick lines and print widths to the lines' inner edges. So a fuselage width by line centers reads up to 2.4%
wide there (the 737-900ER, 777F). The 767-300F's drawing is up to 2.4% off its own figures, so its confidence is medium.
One scale serves every view (the printed length over the drawing's nose-to-tail distance). So a drawing that isn't quite
to scale in one direction shows up here instead of being hidden. The A320's span is 0.7% short. Sometimes one sheet's
figure disagrees with its own drawing and with a sibling's. There the shape keeps the drawing's and the source's note
says so. The 787-8 and 787-10 sheets print the engine 0.2 m nearer the centerline than they draw it, and than the 787-9
sheet prints for the same wing. The A350 plans draw the tailplane 2-3% wider than printed. The A340-300's front view and
plan both draw the outboard engines 0.2-0.4 m further out than its printed 38.54 m apart. The 737 Classics' confidence
is medium for their views' disagreement on the nacelle (above).

Some sheets aren't drawn to one scale both ways or at level. A view may be evened out from its own printed figures
before tracing (`layers.py --xscale`). That covers the E175, E190 and A319 sheets, the A340-600's plan (2.6% wide
across), and the A330-200 and A330-800 (drawn 1% and 1.4% short of their printed lengths). A view may be turned level
from the aircraft's ground attitude (`--rotate`), as on the A330s and the CRJs (at about 2°). Or it's rendered to the
side view's scale where it's on its own page (the A350 and A330 plans) or drawn larger. The E195-E2's front view is
drawn 1.17 times the side's (from its printed span) and the CRJ900's 1.35 times.

A traced fuselage line can pick up parts drawn over it. That can be a wingtip or a fin edge crossing the crown (scanned
as a run of points jumping between two lines) or the nose gear's doors under the nose. Two rules clean these up for
every shape:

- **The nose's underside is convex.** From the tip to where the belly reaches the cabin's level, the belly keeps only
  its outer hull. This took notches and steps of up to 0.3 m out of the A350s' and 787s' noses (and the scan's pixel
  staircase with them). The other types moved by 0.1 m or less.
- **No notches.** `tools/validate.py` flags any point on the crown or belly that sits more than 5 cm inside the line
  both ahead and behind it within 1.5 m. The tail cone's last 8% is excepted, where the line closes. Where one turns up,
  drop the points of the part traced into the line so the line runs straight across. Wingtips had been traced into the
  crown of the A350s, A319, A220-300 and E175. A fin edge had been traced into the A319's and the E190's.
- **The lines are smooth.** A scan's pixels come out as short stairs and straight runs. They show when a shape is drawn
  large and become ridges on a 3D model. `tools/trace/smooth.py` eases the crown and belly as one line around the nose
  tip (a Gaussian over 0.12 m, 0.8 m under the nose and 0.4 m under the tail cone). It eases every other line over 0.12
  m with its ends held (the plan's width, the fin's, wings', tailplane's, wingtip's and engines'). Then it thins them
  back to 5 mm. No line moved more than 10 cm past the nose tip's first meter. The tip itself is now round where the
  drawings had it flat.
- **A wingtip device starts on the wing's tip.** The wing ends where the front view shows the device leaving it. The
  plan's edges beyond that are the device's own, seen from above, and are cut there. The device's side-view edges start
  on the wing's tip edges at the wing's height and follow the side drawing above their lowest quarter, where it shows
  the device itself (below that the drawing's lines are the wing's outline running into the device). So wing and device
  meet by construction in every view (`tools/trace/tipmeet.py`, after `smooth.py`).
- **The wing starts at its root.** The wing's middle height (`wing.z`) is first traced where both its front-view lines
  are. That's often well out along the span, because the fairing, gear and engines hide the underside inboard (the
  A380's from 18 m, the A330s' and 787s' from 11.6 m). A renderer holds that first height level inboard, so the wing met
  the fuselage up to 1.6 m too high (the A380's above mid-body). `wing.z` now starts at the root, where the drawing
  shows the wing meeting the fuselage. That's the front view's upper line where it leaves the section, less half the
  wing's thickness where both lines are first traced (else the side view's `wing.root`). The root moved down by 0.16 to
  1.57 m on 23 shapes (by under 0.15 m on the rest, left as they were).
- **The tail cone only falls.** Behind the fin's trailing edge the crown doesn't climb again. `tools/validate.py` flags
  it. On the 787s the tailplane's tips reach behind the tail cone and the printed overall length (62.81 m on the 787-9)
  is to them. The tracing had followed the tailplane's top edge out to its tip as the crown. The 787s' fuselages now end
  at the tail cone (the APU exhaust, 0.84 m short of the overall length) as their drawings show.
- **A fin's edges start straight.** A trace can curl at a fin edge's root, where it meets the fillet or the tail cone.
  The renderer carries the edge down to the crown from its first stretch, so a curl bends the fin's paint off along the
  fuselage (the first CRJ renders). `tools/validate.py` flags a first stretch whose slope is more than 1 m per meter off
  the edge's first half meter. The edge starts on its straight run, and seven shapes lost a point or two. The renderer
  also takes the half meter's slope where the first stretch is such a hook.
  The A330-200 had a tailplane traced into its tail cone's end too, and has the A330-300's (the same cone).

The 717's sheet prints no heights on the aircraft itself. Its ground clearances (2.3) give the fin's top, the
tailplane's tip, the nacelle's middle and the crown above the ground. Each is a range over the aircraft's attitudes and
loads. Their middles less the crown's are the checks for its tail and engine heights. They're good to about 0.15 m, and
the shape is within that. The fin's tip is 4.09 m above the crown against 4.25, the tailplane's tip 2.95 against 3.15
and the nacelle's middle 1.73 below it against 1.65. Its plan prints the engine 3.30 m from the centerline (10 ft 10
in). Both its plan and its front view draw the nacelle's middle at 2.87 m, with the nacelle as wide as printed (1.94 m
against 1.93) and a 0.25 m gap to the fuselage. The shape keeps the drawing's (−13%, see the source's note).

Boeing's MD-90 sheets draw the aircraft nose down at its ground attitude (turned level, 0.84°) and the tube 3.6% taller
than printed (fit to the printed height). The MD-80's document is a 1989 scan over a printed grid as thick as its
outlines. Laid over it, the MD-90's lines less its plug land on its own within a line's width. The exception is the tail
cone, where the scan draws the underside up to 0.35 m higher and the fin 0.3 m further forward. The `MD82` shape keeps
the vector drawing's tail (confidence medium).

The DC-9s come from Douglas's DC-9 document (June 1984, Rev F 5/84), on boeing.com as DC9.pdf. Its 2.2 sheets are 1-bit
scans on graph paper like the MD-80's, each drawn a little off level (turned level). `DC93` is traced on the DC-9-32
sheet. `DC91` and `DC95` are its points moved by the plugs the sheets' printed lengths give, snapped onto the DC-9-15
and DC-9-51 sheets. The DC-9-10's wing (no slats) and the DC-9-50's JT8D-17 nacelle are their own sheets'. The windows'
height and width and the cockpit panes are the MD-80's (the same nose and cabin section). The DC-9-15 and DC-9-51
sheets draw the tube 3% short of the printed 3.61 m (fit to it). Their plans draw the wing short of its printed span:
the DC-9-10's by 3.1% (the front view agrees with the print). The DC-9-51 sheet draws the cockpit's roof about 0.15 m
fuller than the DC-9-32's (confidence medium for all three).

The DC-10 (`DC10`) comes from McDonnell Douglas's DC/MD-10 document (DAC-67803A, Revision A April 2004), on boeing.com
as DC10.pdf. Its DC-10-30 sheet is a gridded scan like the DC-9s'. The shape starts from the MD-11's points less its
plugs, snapped onto the sheet, with its own wing, tailplane, CF6-50 nacelles, tail engine and fin. The sheet's printed
51.97 m runs to the tail cone's end under the tail engine. Its plan is drawn 1.2% narrow and its front view's circle
2% small. The tailplane is widened to the printed span (its plan draws it 3.2% short, its front view as printed). One
shape serves the -10, -30 and -40: the -10's wing is 3 m shorter, the -40's nacelles are JT9Ds, and the -30's and
-40's center gear isn't modeled (confidence medium).

The 777-200 and -200ER (`B772`) are on their own sheet, D6-58329 Rev E's 2.2.1, a vector sheet like the 777F's. It's
the 777F's points (`b77l/`, the same fuselage, fin and tailplane) moved onto it and snapped, with the wing's plain tip
re-placed where the sheet ends it (60.93 m, where the 777F's raked tip begins). The sheet draws the windows. Door 3 is
behind the flaps and is placed by its corners that show (36.45 m against the door table's 36.33 m). The nacelle is the
GE90's the sheet draws. The Trent and PW4000 nacelles of most 777-200ERs are shorter and aren't drawn.

The 757-300 (`B753`) is on D6-58327's 2.2.2, drawn 3.6% larger than the 757-200's sheet. It's the 757-200's points
moved by the plugs the door table and wheelbases give (4.064 m between door 2 and the wing, 3.048 m behind the wing)
and snapped onto it. Its doors land within 0.1 m of the table. Like the 757-200's it draws the tube tall (4.22 m) and is
fit to 2.2.1's printed 4.01 m. It has the PW2000 nacelle and plain tips, as the sheet draws. United's and Delta's fly
with blended winglets.

The A300-600F (`A306`) is from Airbus's A300F4-600 document (Dec 01/09), its 2.2 page 2, a 1994 scan without a grid.
Every A300-600 scheme here is a freighter's (FedEx, UPS), so the freighter is the designator's shape, with no cabin
windows and the main-deck cargo door forward on the left. It's the A300B4's points moved onto the scan and snapped.
The side view is drawn 6.9% taller than long (the tube 6.03 m against its printed 5.64 m and the fin 8.88 m against
8.30 m), so it's evened out (`layers.py --xscale`). The front view is rendered to its scale. Page 1's plan is on graph
paper and not to one scale, so the plan is the B4's with the -600's 0.47 m in the aft fuselage (`a306/plan.py`). The
side view bears that out, as its fin lands on the B4's moved 0.47 m aft. The tail cone and the CF6-80C2 nacelle are the
scan's. The tailplane is drawn as the B4's and narrowed to the printed 16.26 m. The nacelles are placed at the printed
15.88 m apart (the scan draws them 16.5 m). The wingtip fences aren't drawn on the sheet and aren't in the shape
(confidence medium).

The 747SP (`B74S`) is in Boeing's 747-100/-200/-300/SP document (D6-58326, the May 1984 edition on boeing.com as
747_123sp.pdf). Its SP pages are scans: the 2.2.2 sheet (August 1975) draws lines about 0.35 m thick over a 5 ft grid,
too coarse to trace. So, as the 747-8 is, it's the 747-400's measured outlines taken apart where the SP's own figures
say (`b74s/derive.py`). Its door table (doors at 9.50, 16.41, 31.60 and 41.35 m) and cargo-door tables against the
747-100's give plugs of 2.39 m between the forward cargo door and door 2, 2.69 m between door 2 and the wing and
4.06 m behind the wing (the 747's door 3 is gone). The cabin loses 4.65 m more behind the aft cargo door. The body
behind that door is the 747's taper squeezed lengthwise into the SP's to the printed 53.87 m tail cone, which the
scan's belly follows within its line. The upper deck is the 747-100's short one (the 747-400F's), not moved: it reaches
back over the wing box as the scan draws it. Its ten windows a side are from Pan Am photos. The fin is the 747-400's,
0.68 m taller to 2.3.3's fin tip 10.76 m above the crown, its trailing edge brought to the printed 56.31 m overall length.
The tailplane is read off the scan's plan, set to the printed 25.22 m span and 55.85 m to its tip. The wing is the
747-400's without its tip extensions, cut at the printed 59.64 m. The engines sit where the 747-400's do (11.97 m and
21.18 m out against a printed 11.94 m and 21.18 m). Its nacelles are the 747-400's RB211s standing in for the SP's
JT9Ds, which the scan can't tell apart. Confidence medium.

The 747-100 and -200 (`B742`, serving `B741` and `B742`) are in the same document's 2.2.1 (747-100B, -200, -300), a
scan as coarse as the SP's. Its figures and 2.7.1's door table (9.50, 18.80, 30.61, 40.74 and 55.14 m) are the
747-400's but for the span, so it's the 747-400's measured outlines with what's the -100/-200's own (`b742/derive.py`):
the 747-400F's short upper deck, 2.7.6's 0.61 by 1.22 m upper deck exit door at 8.00 m, and the wing cut at the printed
59.64 m with no winglets. Its upper deck has three windows a side, 1.52 m apart, as most 1983-86 photos of Pan Am's
747-121s, TWA's 747-131s, People Express's 747-143 and Braniff's 747-127 and 747-230B show (placed on TWA's and People
Express's by doors 1 and 2, 12.45-15.5 m). Pan Am's 747-212Bs and People Express's and Braniff's 747-227Bs had ten; they
aren't drawn. Its plan prints the inboard engine 12.1 m out (-1.2%); its front view draws it 11.9 m out, as the
747-400's is. The nacelles are the 747-400's RB211s standing in for the JT9Ds, which the scan can't tell apart (an
overlay puts the inlets within 0.5 m). Confidence medium.

The L-1011-500 (`L101-500`, serving `L101`) has no openly available drawing at all. The maintenance manual's chapter 6
that `L101` is read from covers the standard-body aircraft only. So it's the -1's measured outlines with the -500's
published differences (`l101-500/derive.py`): a fuselage 4.11 m (13 ft 6 in) shorter and a span 9 ft longer (164 ft
4 in, the extended tips carried out along the -1's planform). Where the plugs go isn't published in the open. They're
placed 2.54 m between doors 1 and 2 and 1.57 m behind the wing, where the -1's door 3 was. The -500's three Type A
doors a side are the -1's doors 1 and 2 and one at its Type I door 4. Two side-on photos of N514PA put its door 2
within 0.5 m and its aft door within 0.9 m of that. The tail, nacelles and lower deck's doors are the -1's. Its length
is 0.5% over the published 164 ft 2.5 in, as the -1's maintenance manual figure is over its own published length.
Confidence low.

`E135` covers both the ERJ-135 and the longer ERJ-140, and two shapes serve it. `E135` is the ERJ-135. The other is
`E135-erj140`. Embraer's ERJ-140 figure isn't drawn to one scale. Its side and plan are short lengthwise against their
spans and the side is nose down. Evened out, it still misplaces its doors. Its door figure prints the ERJ-135's 12.79 m
to the overwing exit. So `E135-erj140` is the ERJ-145's measured lines less the two plugs its manual's lengths give.
Those are 0.91 m ahead of the wing (from the nose-to-main-gear figure) and 0.51 m behind. Two side-on photos bear this
out (10 windows ahead of the exit and 5 behind, the exit about 13.9 m back). Confidence medium. The ERJ-145XR (`E45X`)
is the ERJ-145's lines on its own figure (the same airframe, with winglets). `E275`, the E175-E2, hasn't entered
service. Embraer's E2 manual draws it, and it's the E190-E2's lines less two plugs, snapped to that figure.

Two shapes serve `MD11`. `MD11` is the MD-11F, with no cabin windows and the main-deck cargo door forward on the left.
Nearly every MD-11 still flying is a freighter. `MD11-passenger` takes the same sheet's windows and doors. Boeing's
MD-11 sheet is a picture of about 26 px a meter, not quite to one scale. Its plan draws the tailplane 4% short and the
wing's root and tip up to 0.9 m forward of their printed distances. Its side view draws the tube 1.7% tall (fit to the
printed 6.02 m). Its front view draws the fuselage's circle 5% large (tied to the side by the circle's center).
Confidence medium. The 727-200F's sheet (`B722`) is a 1978 scan on graph paper. The grid's lines run through the
drawing. Where an outline runs along one (the nose's crown) it's placed point by point. Its front view draws what stands
above and beside the fuselage 0.25-0.5 m low against the fuselage's circle. So the tailplane takes the side view's
height (the recipe's `stabilizerZ`). Its main-deck cargo door is the 727-100C's from Boeing's door table (727-200F
conversions fit the same size just aft of the entry door). Confidence medium. `B722-passenger`, the 727-200, is that
shape with the passenger aircraft's windows and doors (`b722-passenger/derive.py`). The sheet draws the window row
but too coarsely to count, so two side-on Commons photos (Eastern's N819EA from the left, Piedmont's N555PS from the
right) count it: 26 windows behind the entry door, the two overwing exits with 2 between them, 15, the aft service
door, 2. The shape has one window row for both sides, the left's. On the right the galley door blanks the first five.
The aft service doors (both sides) are at 29.47 m, where N555PS puts them (2.7's table prints 29.6 m and 2.2 draws
29.25 m). Its crown, belly and width along the cabin are fitted straight (the scan steps 2-4 cm there). The sheet
draws the aircraft at its ground attitude, the cabin rising 0.44° aft. A window row is one height, so the passenger
shape is turned about the wing to bring its cabin level, the windows parallel to the crown as photos show them.

The Dash 8-400's sheet (`DH8D`, Figure 2-2 of Bombardier's Series 400 planning manual) draws the side view at the ground
attitude (turned level, 1.26°). It draws the plan turned 31.92° and 0.896 times the side's size (rendered to its scale
from the printed span and tailplane span). Its side view draws the fuselage 2.55 m tall, as the ground clearances
(Figure 2-4: the crown 3.44 m up, the belly 0.87 m) and the front view (2.59 m) do. The cross section prints the width
as 2.69 m, which the plan and front view draw. So the shape keeps the drawn height. The nacelle hides 15 cabin windows
from the side. They're placed on the drawn ones' pitch (photos show the row unbroken behind the propeller). Its long
dorsal fin runs from the wing's root fairing to the fin (its `fillet`, 10.5 m long). Each door's side comes from its own
clearance figure. The airstair door, aft passenger door and aft baggage door are on the left. The forward baggage door
(a Type I exit in the extra-capacity cabin) and the aft service door are on the right.

The ATR 72-600 (`AT76`) is read off ATR's own dimensioned three views of the 72-500, on the ATR family brochure's 72-500
page at atr-aircraft.com. ATR's airport planning manuals are on its customer portal only. The 72-600's fact sheet draws
the same views and figures as a picture. The 72-600 is the 72-500's airframe (the same length, span, 568F propellers).
ATR 72-200s (AT72) have four-bladed propellers and aren't served. The drawing is an illustration (shaded, its lines from
black to pale gray: `layers.py --mode lines`) and its plan is turned 45°. It's consistent within about 1%. Its plan
draws the nacelles 4.4% further out than its front view and the printed propeller spacing, and the shape keeps the front
view's. Door sides come from Commons photos of each side. The cargo door is forward on the left only, and the forward
exit and the aft door are on both. Confidence medium. The ATR 42-600 (`AT46`) is read the same way off the 42-500's
page. Its front view is drawn 2.1% smaller than its side and rendered to its scale. Its propeller disc is 1.8% under the
printed 3.93 m and is kept. Its doors' sides are the ATR 72's (a Commons photo of a 42-600's left side agrees).

The C-17A Globemaster III (`C17`) has no airport-planning document in the open. It's read off the three views in the
USAF's C-17A flight manual (TO 1C-17A-1, 2001, page 1-16). That's a public-domain scan on Wikimedia Commons of about 26
px a meter (`layers.py` reads the PNG itself, `--mode image`). It's an illustration with its own figures in feet and
inches. It's scaled by its printed 174 ft overall length, which runs to the fin-top fairing's tip. The tail cone is
48.35 m back. The plan and front view are at that scale within 0.2% (the front view rendered to it by the printed 169 ft
10 in span). Within that scale it doesn't quite draw its own figures. The outboard engine's inlet is 0.66 m ahead of its
printed 47 ft 10 in. It's moved to it, as on every shape, and the inboard one's is within 0.8%. The engines' places
across are 1.7% in (kept). The tailplane is 1.2% short. The fin's top is 9.78 m above the crown in both side and front
views, where its printed heights differ by 9.45 m (55 ft 1 in to the fin and 24 ft 1 in to the crown, above the ground
at some unstated load). That's kept because a side-on Commons photo lands on the drawn outline. Its 30 ft 2 in to the
crown at the fin fits nothing it draws. The fuselage is drawn 6.31 m tall and 6.8-6.9 m wide. Boeing's "22.5 ft
diameter" is the width. The side view, the front view and the photo agree on the height, so it isn't fit to it. The high
wing's root is the front view's. Its middle is about 1 m under the crown at the fuselage's side, with the fairing over
the top. The T-tail's tailplane sits on the fin and its fairing is the fin's top. The main gear's sponsons are left out
of the belly (the gear doors under them bridged). The inboard nacelle's aft end is hidden behind the outboard one and
takes the outboard's profile. Doors are as drawn (the crew door on the left, the paratroop doors behind the sponsons).
There are no cabin windows. The side view draws the front windshield pane's post 0.1-0.25 m under the outline. The pane
is carried forward to the post on the crown from the front view (Cockpit, below), so the two meet across the nose as a
front-quarter photo shows. Confidence medium.
The C-130J Hercules (`C30J`) also serves `C130`, which covers the HC-130J and every air force's short-bodied C-130s. It
has no airport-planning document in the open either. It's read off the three views in the USAF technical order T.O.
1C-130A-2-2 (page 1-3, the late C-130A with the radome nose). That's a public-domain scan on Wikimedia Commons of about
39 px a meter. The C-130J keeps the C-130's 97 ft 9 in fuselage, wing, tail and nacelle outlines. Its six-bladed Dowty
R391 propellers are 4.115 m across (EASA's type certificate data sheet P.087). The drawing's discs are the C-130A's 15
ft 1 in. So the recipe gives the propeller's `diameter` and the drawing places it. It's scaled by the printed 97 ft 9 in
to the tail cone. The printed wheelbase is drawn within 0.1% and the span within 0.2% in plan and front view. The plan
was drawn 3.1% short lengthwise and is evened out. The side view draws the propellers' plane 0.21 m behind the printed
29 ft 11 in from the nose, which the plan draws. Every nacelle and propeller is moved to it (`build.py`, as for a
printed inlet). The scan draws the fuselage 0.08-0.13 m off the wing's middle in plan and front view. Each view's
centerline is halfway between. It draws the crown 4.40 m above its ground line where it prints 15 ft (4.57 m). The drawn
fuselage height (3.88 m, the front view 3.84 m) is kept, as a side-on photo of an HC-130J bears out. The high wing's
upper surface runs over the fuselage (its center section). The tailplane is drawn in the front view along the wing's
upper line. It takes the side view's height (`stabilizerZ`, 0.31 m under the crown). It has four turboprops. Each
nacelle's propeller (`propeller`, `propeller2`: hub and disc) and width are from the plan (`nacelle`, `nacelle2`). The
inboard nacelle's top, behind the outboard one, is placed under it by the dihedral. Main gear sponsons and the HC-130J's
external tanks are left out. The crew door (left) and paratroop doors are as drawn. The C-130A's forward cargo door and
round windows aren't the C-130J's and are left out. Tailplane +1.5% (as drawn). Fuselage width +1.6% against Lockheed
Martin's 14 ft 2 in (line centers). The flight deck's glass is the C-130J's, from HC-130J photos placed against the
drawing's panes (2026-11-22: the front windows needed work and the middle over the nose was missing). The front pane
each side is carried forward to its center post on the crown from the front view (0.86-1.32 m up at the centerline).
There are three side panes under three eyebrows (the C-130A's fourth, forward eyebrow isn't the J's). There's a chin
window under the front pane and the tall side window by the number (not the C-130A's two small ones). The outline's nose
(radome, forehead, chin) lands on the Juneau photo within about 0.05 m, so it's kept. The stretched C-130J-30 isn't
drawn yet. Confidence medium.
The CN-235 shape (`CN35`) is for the Coast Guard's HC-144 Ocean Sentry, a CN-235-300 MP. It has no airport-planning
document in the open either. It's read off the "Three View Drawing" in EADS-CASA's CN-235-300 Technical Review, as
published in the BLM's 2002 evaluation of the type (nifc.gov). That's the manufacturer's own dimensioned three-view.
It's three embedded pictures on one page at one scale, about 28 px a meter, shaded with black outlines
(`layers.py --mode lines`). It's scaled by its printed 21.40 m. Its span is drawn within 0.4% of the printed 25.81 m.
Its plan is drawn 1.3% long lengthwise (evened out). The sheet doesn't draw all its own figures. Its tailplane is drawn
11.16 m across in plan (about 11.0 m in front) against the printed 10.20 m. So the printed span is taken
(`stabilizerSpan: "printed"`, build.py: narrowed outboard of its root). The front view draws the propellers 7.31 m apart
(the plan 7.05 m) against the printed 7.0 m, which places them (`propeller.apart`). Its discs are about 3.4 m across
where the same document's text gives the 14RF-37's 3.66 m (`propeller.diameter`). Its "6.20 m" wheelbase is drawn 7.25 m
(the USACE's TSC 13-2: 6.92 m). The front view's crown is hidden under the wing. It's tied to the side view by the fin's
tip, the propeller hubs and the wing's root height, which agree within 0.07 m. The fin's and tailplane's leading edges
are drawn as thick black de-icing boots. Their outer edges are placed. There are no cabin windows. The transport's row
of 12 is plugged on the HC-144 but for two or three portholes a side. A short row would also tie the cabin's end (a
landmark) to mid-body ahead of the ramp. The sponsons are left out, and so are the HC-144's radar radome under the
forward fuselage and its sensor turret. A side-on photo of HC-144B 2311 lands on the outline within about 0.1 m.
Confidence medium.

The Convair 580 (`CVLT`) has no airport-planning document in the open. It's a Convair 340 or 440 airframe with
Allison 501-D13 turboprops, an enlarged fin and a weather-radar nose. So it's built in two steps. The 340's airframe
is read off the three views in the USAF technical order T.O. 1C-131B-2-2 (page 2B, the C-131B Samaritan: a 340 with
R-2800 radials). That's a public-domain scan on Wikimedia Commons of about 47 px a meter, read like the C-130's.
It's scaled by its printed 79 ft 2 in. Its plan is drawn 5% short lengthwise (evened out) and its front view 0.7%
small. Its span is 0.5% short and its tailplane 0.4% wide. The fuselage is drawn 2.80 m wide by line centres against
the printed 9 ft 5 in (kept: −2.6%). Then `cvlt/derive.py` writes the 580's own parts over it from a side-on photo of
Air Chathams' ZK-CIE (CC BY 4.0, scaled by the published 81 ft 6 in). The extra 0.71 m is the nose: the photo puts it
ahead of the nose gear, so the 340's lines move aft by it and the photo's nose and flight deck take its place. The
fin and its dorsal fillet are the photo's (the tip 4.22 m above the crown against the C-131B's 3.59 m). So are the
nacelle from the side, the four-bladed propeller's plane and the windows and doors. The photo looks down about 5°,
so what stands out toward it (the nacelle, the near side's windows and doors) is put back up by that. The propeller's
hub then sits 0.51 m under the centerline, where the drawing has its own. The 580's tailplane isn't measured (the
340's is kept) and its nacelle's width from above is estimated. Its fin stands 8.67 m above the drawing's ground
line, against a published 29 ft 2 in (−2.4%; other tables give 28 ft 2 in). Confidence medium.

## Axes

Meters, for one side of the aircraft (the other mirrors it):

- **x:** back from the nose tip.
- **y:** out from the centerline.
- **z:** up from the fuselage's centerline. That's halfway between the crown and the belly where the fuselage is a
  constant tube.

Every line is a list of points joined by straight lines. They're dense enough that no smoothing is needed. A
line runs from root to tip, or from nose to tail.

## Parts

**Fuselage.** `length` (nose tip to tail cone), `crown` and `belly` from the side as [x, z], `halfWidth` from above as
[x, y] and `widest`, the z of the cross-section's widest line. A cross-section at x is two quarter-ellipses each side.
They run from the widest line up to the crown and down to the belly, with half-width `halfWidth` at x.

An upper deck standing above the main tube (a 747's) is `hump`. It has its `crown` from the side as [x, z], from where
it leaves the main tube's crown to where it rejoins it. It has its `width` from the front where it rises from the main
tube. Optionally it has its `section`, the front view's outline [y, z] where it stands highest, from its top down to
where it meets the main tube. The fuselage's `crown` is then the main tube's own, run level beneath the hump. So the
fuselage's paint space is the main tube's on every type, and a scheme measured on it is placed as measured. Through the
hump the deck adds to the tube's section what its drawn `section` has over the tube. That's scaled along the fuselage by
the hump's height over the main crown (so its silhouette is the hump's crown from the nose) and across by the fuselage's
width. Glass and doors whose middle is above the main crown are the hump's. On the 747 the upper deck's windows and the
flight deck lie below it, on the main tube's side.

Two shapes serve `B744` as two serve `B763`. `B744` is the 747-400F (the freighter schemes' `drawnOn` names it by its
id). `B744-passenger` is the 747-400. Likewise `B748`, the 747-8F, is the shape for the designator. `B748-passenger` is
the 747-8 Intercontinental, which passenger schemes name in their `drawnOn`.

Two shapes are built from a measured sibling where the manufacturer has published no clean drawing of their own.
**`B778`** (the 777-8, which hasn't flown) is the 777-9's traced lines (`b779/`) with the 777-8's two plugs taken out by
`plug.py`. The plugs come from Boeing's own figures. They're 5.867 m in all (232 ft 6 in overall against the 777-9's 251
ft 9 in, the same tail). Of that, 3.734 m is ahead of the main gear (the two wheelbases, 93 ft 10 in and 106 ft 1 in)
and 2.133 m behind (7 and 4 of the 777's 21 in frames). The 777-8F brochure's door 1, forward and aft cargo doors agree.
Boeing hasn't published where in those stretches the 777-8's plugs go, and so where doors 2 to 4 are. They follow the
2015 777X brochure's 777-8X servicing plan (door 2 at its passenger bridge, door tabs at door 3, the optional exit and
door 4 of a 777-9 with its plugs out). So its confidence is low. As on `B779` (rebuilt so), its door 3 is the 777-9 door
table's (the 777-9 sheet hides it behind the flaps) and its cockpit panes are the 777-300ER's. The 777X keeps the 777's
flight deck, and the 777-9 sheet draws its windshield too small and low to meet its twin over the nose.
**`B748-passenger`** is the 747-400's measured shape with the 747-8F's plugs, wing and GEnx nacelles
(`b748/derive.py`'s) and the -8I's upper deck. That deck is 4.10 m longer (the forward plug lies under it), with its
fairing running out about 1 m further aft. Both of the 747-8 document's scanned side views and the photos draw it so.
Its upper deck's windows and door are measured on two side-on Commons photos of Lufthansa 747-8Is, as the scans are too
coarse to count them. They run 9 windows, the door, 15, a gap, 2 (Korean Air's alike).

**Fin.** From the side, as [x, z]: `leading` and `trailing` edges from the root to the tip, the `rudder`'s hinge
line and a dorsal `fillet`'s curve where there is one. The leading edge's root is where its straight run, carried
down, meets the crown. The fillet ahead of it isn't part of the fin's space.

**Wing and tailplane** (`wing`, `stabilizer`). From above, `leading` and `trailing` edges as [y, x] from the root
(at the fuselage's side) to the tip. From the front, `z` is the surface's middle height along the span, as [y, z].
Seen from the side, a surface is the band between its edges at their heights. The wing stops where a wingtip
device rises from it.

**Flap track fairings** (`wing.fairings`, left out where none are drawn) are the canoes hanging under a wing's trailing
edge. They make a side view read as an airliner. Each is its middle's distance out from the centerline (`y`, from the
front view's bumps under the wing), its front and aft ends (`x`, from the side view, from ahead of the trailing edge to
behind it) and how far it hangs below the wing's lower surface (`depth`). The side view draws the near wing's as canoes
from its underside. They're deepest a little aft of their middle and rise to a point at the aft end, in the wing's
underside color, with the wing's edge over their tops. They're measured from the manufacturers' drawings, never from
anyone's artwork.

**A high wing** (the Dash 8's, ATR's) is a wing like any other whose root is on the crown. Its plan's edges still start
at the fuselage's side. Its `z` there is the front view's, at or above the crown. The Dash 8-400's middle is at the
crown's height, with its center section passing through the top of the fuselage. No flag says so. From the side the near
wing is a band along the top of the fuselage, drawn over it as a low wing's is. In 3D the root's section is carried in
to the centerline as on every type, so the two wings meet over the cabin. The wing root rule above (`wing.z` starts at
the root) holds as it is. The front view's upper line leaves the fuselage at the wing's root.

**Wingtip** (left out for a plain tip). `kind`, its `leading` and `trailing` edges from the side as [x, z], and its
`front` as [y, z]. The `front` is the device's middle line seen from the front.

**Engines.** One side's, inboard first. `x` is the inlet lip and the exhaust (the nozzle's end, not a plug's tip).
`cowlEnd` is where the fan cowl ends. `y` is the nacelle's center out from the centerline. Its `top` and `bottom` are
from the side as [x, z]. Its `inlet` is from the front (center height, width and height). A four-engined type lists two.
From the side the outboard nacelle is the nearer and can hide the inboard one's aft end (the A340's nozzle). The inboard
one's lines end where they go behind it. A renderer draws it first with its titles and logos, so the nearer nacelle
covers both. `mount` is under the wing (`wing`, the default) or on the rear fuselage (`fuselage`, for the 717, CRJs,
ERJs, MD-80 and MD-90). There it hangs on a stub `pylon` from the fuselage's side. The pylon has its plan view's
`leading` and `trailing` edges as [y, x] from its root (at the fuselage) to its tip (at the nacelle). It has its middle
height from the front as `z`, [y, z], and its `thickness` there (the front view's top to bottom). A type whose engines
are all on the fuselage has none on the wing. A wing doesn't need one.

**A turboprop's engine** is a wing engine with a `propeller`. That gives the disc's plane `x` (back from the nose), the
hub's height `z`, its `diameter` and number of `blades`, and its `spinner` from the side. The spinner's `x` is its tip
and base, where it meets the nacelle, and its `diameter` is taken there. The nacelle (`x`, `top`, `bottom`) starts
behind the spinner and holds the wing. Its top runs over the wing (the Dash 8-400's), so it has no pylon. Its `y` is the
propeller's, since the documents print the propellers' spacing. Its `inlet` is the intake under the spinner. A nacelle
that isn't round from the front (a turboprop's, deep and narrow) has its plan's `halfWidth`, [x, y] from its own middle,
as a tail engine has. From the side and from below the disc is drawn edge on, as a faint lens a twelfth of its diameter
thick (the blades turning) with the spinner in front of it. In 3D it's drawn as the spinner, still blades (tapered,
pitched) and a faint disc. Seen edge on, still blades would be a line. So the side and below views draw the disc and 3D
draws both.

**A tail engine** (the MD-11's, the 727's) has `mount: "tail"`. It sits on the centerline (`y` 0) and is listed first.
`duct` says how it's fed:

- **`straight`** (the default, for the MD-11 and DC-10): the nacelle runs through the fin's base, with the fin standing
  on its top. `top` and `bottom` are its outline from the side where it stands clear of the fuselage. The top runs from
  the inlet lip along the nacelle under the fin. The fin is drawn behind it, and its root (the leading edge's foot) sits
  on that line. Then the top goes up the rudder's foot to the fairing over the nozzle and down its back. The bottom runs
  along the nacelle to the cowl's end, the nozzle, and up under the fairing. `strut`, [x, x], is where a strut joins the
  nacelle's bottom to the crown below it (the MD-11's, 0.6 m tall).
- **`s`** (the 727, L-1011): the engine is in the tail cone, fed by an S-duct from an intake on the crown ahead of the
  fin. `top` and `bottom` are the intake's fairing from the side. Its top runs from the lip back to where it runs into
  the fin's leading edge (the fin's root sits on it). Its bottom is the crown. Under the fin the outline is bridged
  (hidden): the fairing and fin are one painted surface, so the renderer draws the outline only outside the fin.

Either way `x` is the inlet lip (the intake's) and the exhaust (the nozzle's end). `halfWidth`, [x, y], is the nacelle's
or intake's side from above. `inlet` is its opening from the front. `nozzle` (`top`, `bottom`) is the bare exhaust where
it shows. That's the MD-11's under its fairing with a plug's cone included, and the 727's at the tail cone's end.
`cowlEnd` is where the fan cowl ends. One format serves both. What differs is how the outline meets the fin and fuselage
(a pod under the fin on a strut, or a fairing on the crown). The 3D model reads that from `duct`.

**A T-tail.** With `stabilizer.mount: "fin"` the tailplane sits on the fin (the 717, CRJ, ERJ, MD-80) instead of on the
fuselage. Its root is at the fin's side (a few tenths of a meter out). Its `z` there is the fin's height where it
crosses, near the fin's top. The fin's `leading` and `trailing` edges run up to its top, including the tailplane's
fairing on it (the 717's rises 0.8 m above the tailplane's root). From the side the tailplane is drawn across it,
nearer.

**Cabin.** `windows`: their `z` (bottom, top), `width` and each one's center `x`. A double-deck cabin's upper row is
`upperWindows`, the same way. `doors`: doors and emergency exits as boxes, `x` (forward, aft) and `z` (bottom, top).
They're the left side's. The right side mirrors them, which is close but not exact on most types. A door on one side
only has `side`. The lower deck's forward and aft cargo doors are on the right, as Boeing's 757 and 787 door tables say.
That holds on every type here but the CRJs and ERJs, whose door figures put theirs on the left. A freighter's main-deck
door is on the left. The bulk cargo door's side comes from each type's own document. It's on the right on the 777s (the
777-9's door table 2.7.1, D6-58329-2's cargo-door figures 2.7.5 and 2.7.6, right side views). It's on the right on the
747s too (D6-58326-1's bulk-door figure 2.7.8, a right side view). The 747-8's door figure 2.7.1 draws it dashed, on the
far side of a left side view. It's on the left on the 787s (D6-58333's table) and the 767s (D6-58328's bulk-door figure
2.7.6, a left side view). On the MD-11s it's where their sheet draws it (left). Where the drawing doesn't show the
windows (Boeing's), they're placed at the type's frame pitch and `windows.note` says so. The A220s' document draws none
and their spacing isn't regular around the overwing exit. So theirs are measured on openly licensed Wikimedia Commons
photos of the left side, two a type that agree, scaled between the doors. Only the measurements are taken, and each
photo is in the shape's `sources`. Those photos showed the A220-300's general-dimensions sheets distorted along the
body. They draw the doors up to 1 m from where their own door-distance figure puts them. The photos back the figure,
with 7 more windows than the A220-100's and 3.7 m of plugs. The sheets also draw the engine inlet 1.05 m forward of the
12.17 m they print. So `BCS3` is the A220-100's measured outlines with the two plugs added back (`plug.py`), checked
against the A220-300's printed figures (within 0.5%), with the figure's doors.

**Cockpit.** `windows`: each pane's outline from the side, as [x, z].

## Painting a shape

The part spaces are [COORDINATES.md](COORDINATES.md)'s. On a shape they sit like this:

- **Fuselage:** x is the share of `length`. At that x the center is halfway between crown and belly and the radius is
  half their gap. From the side a point at y is drawn `r · sin(y · 90°)` from that center. Around the fuselage (3D) y is
  the angle up from the belly, `acos(−y)`, on the cross-section above.
- **Upper deck** (`fuselage.hump`): no space of its own. It wears the fuselage's paint at the crown (y 0.985), carried
  straight up at each x, as the fin's fillet does. In 3D the deck is part of the fuselage's section, textured by height
  on its sides, so the fuselage's paint and windows run on over it unstretched.
- **Fin:** y is the share of the height from the leading edge's root to the tip. x is the share of the chord between
  `leading` and `trailing` at that height. The rudder is aft of `rudder`. Aft of the leading edge's root the crown falls
  away, so the fin's lowest strip there is a little below y = 0. Paint it as y = 0. A `fillet` takes the paint at the
  fin's root leading edge (x 0, y 0).
- **Wing and tailplane:** y is the share of the span from the root to the tip. x is the share of the chord between
  `leading` and `trailing` at that y.
- **Wingtip:** y is the share of its height from where it leaves the wing to its tip. x is the share of the chord
  between `leading` and `trailing` at that height. The side view draws the wing's trailing edge a little below its
  leading edge (the wing's drawn thickness). So the device's trailing root drops the same and eases back over its lower
  40%.
- **Cockpit:** each pane where it's measured, by height. The windshield is the pane reaching nearest the outline's top.
  That's not always the foremost, since the C-17's chin window is further forward. It meets its twin along a center post
  on the nose's centerline, which from the side is the crown's outline. Its forward edge's points within 12 cm of the
  crown sit on it, so around the fuselage the two windshields meet in the middle. Drawings place the panes only roughly
  up there (Boeing's up to 20 cm low). Over an upper deck the outline's top is the hump's crown. `build.py` applies
  this. `windshieldTolerance` in a recipe widens it, since the 747 sheet draws its windshield up to 18 cm low.
  `tools/trace/windshield.py` runs after `smooth.py` and finishes it where the glass still stops short of the crown. The
  post goes onto the outline. That's the pane's edge rising steeply from its foremost point to where its top edge levels
  off. Its points up to 25 cm under the outline are lifted (the 737 Classic sheets draw it 0.16-0.23 m low), with the
  outline's own points between so it follows the curve. `tools/validate.py` checks that the glass reaches the crown
  (within 0.02 of the fuselage texture's height). Until 2026-11-18, 27 shapes fell short of it. A point further under
  than 25 cm isn't on the post (the ATRs' drawn front edge runs down the nose's side). It stays, and there the two
  windshields meet at the post's top only.
  A pane's edges are straight from the side. The renderer steps along each one in meters (5 cm at most) before taking it
  into fuselage space. That space's mapping bends an edge drawn between two corners near the crown. The C-130J's
  windshield's bottom edge, from its post on the crown back to its aft corner, bowed up to 0.16 m.
  A windshield facing forward on a blunt nose (the C-17's) lies along the outline from the side, where a side drawing
  can't show where it reaches. Its post is placed from the front view. It sits on the crown at the x where the crown is
  at the heights the front view draws the pane's bottom and top at the centerline.
- **Engines:** x is the share from the inlet lip to the exhaust. y is the share between `bottom` (−1) and `top` (1) at
  that x. The same goes for a rear-mounted nacelle. Its outboard face is the one seen from that side.
- **A tail engine** (`mount: "tail"`) wears the fin's paint carried down below its root, not the engines'. That's the
  fin's base, with its areas carried on across it. Each area's points on the fin's foot (y 0 or below) go on down and
  those on its leading or trailing edge go on out. So a stripe running off the fin's foot runs on across the nacelle
  (Western Global's MD-11s). The fin's own art stays where it is in fin space. The fin's root is the leading edge's foot
  on the nacelle, so fin shares measured on any type still fit. Not the rudder, a separate surface. Its inlet lip is the
  scheme's `engines.inletLip` and its `nozzle` is bare metal. The scheme's engine areas, titles and logos are the other
  engines'. Photos agree on the fin's paint: UPS's brown, Lufthansa Cargo's blue, KLM's white and FedEx's purple
  nacelles, and the 727's intake under FedEx's purple tail. FedEx's fan cowl is white, which a scheme can't say yet.
- **A propeller:** its blades are dark and never painted. Its spinner is the scheme's `engines.cowling`
  (COORDINATES.md).
- **A stub pylon** (on the fuselage) takes the scheme's `engines.pylon`, else the fuselage's paint where it meets the
  fuselage (it's faired into the body).
- **A T-tail's fin:** its space runs from the root to its top as on any fin, including the fairing on top. The tailplane
  crosses its top tenth or two (the 717's root at y 0.8) as on the aircraft. Delta's widget (up to y 0.74) stays clear
  of it.

## For apps: the compact export

`tools/export_shapes.py OUT.json` writes every shape in one file for an app that builds its own model (Skyarium's paper
models). Each line is thinned to stay within 2 cm (1 cm on spinners, inlets, wingtip devices, pylons and cockpit panes).
Every number is in whole centimeters. Lines are flattened to `[a0, b0, a1, b1, ...]` in the shape's own axes. `types`
maps each designator to the shapes serving it, its own first. Sources, checks and notes stay here. It's 146 KB (55 KB
compressed) for the 65 shapes, against 788 KB as measured. With it `export_compact.py` gives each scheme its `on` and
its paint for one type (`types`, docs/COORDINATES.md). `on` is the shape it was drawn on. A freighter's scheme is drawn
on a shape without cabin windows, so an app can take the freighter of a type with two.

## Not yet

- **More types.** Next, in order, busiest in Skyarium's skies first. "Plugs" means built from a measured sibling by its
  fuselage plugs, as the 787-8 and 787-10 were:
  1. **777-8** (B778): done from the 777-9 by plugs (above). Redo it on its own sheet once Boeing adds the 777-8 to
     D6-86073. Its 2.2 and door table would settle doors 2 to 4.
  2. **The hard cases,** each needing the shape model or the trace tools extended first. The **747-8I** (B748-passenger)
     is done (above). For **the T-tails with engines on the fuselage** the **717** (B712) is done, so the shape model,
     `build.py` and the renderer handle the layout (`engines[].mount`, the stub `pylon`, `stabilizer.mount`). The
     **CRJ200, CRJ700 and CRJ900** (CRJ2, CRJ7, CRJ9, from Bombardier's own planning manuals), the **ERJ-135, -140, -145
     and -145XR** (above), the **MD-90** (MD90) and the **MD-80** are done too. The MD-80 (MD82) serves MD81, MD82, MD83
     and MD88. It's the MD-90's measured airframe less its 1.45 m plug, with its own JT8D nacelle, doors and windows
     from its document, a gridded 1989 scan. The **Dash 8-400** (DH8D, with propellers and a high wing, from
     Bombardier's planning manual) is done. The **ATR 72-600** (AT76, serving AT75 too) is done from ATR's own
     dimensioned drawing because its planning manual isn't public. The **ATR 42-600** (AT46, serving AT45) is done the
     same way. Next is the Dash 8-100/200/300 (DH8A-C), whose planning manuals are on Bombardier's page too. The center
     engine is done (the **MD-11**, `MD11` and `MD11-passenger`, and the **727-200F**, `B722`). The **L-1011** (L101, an S-duct like the 727's)
     and the **DC-10** (DC10, a straight duct like the MD-11's) use it. The **DC-9-10, -30 and -50** (DC91, DC93, DC95) are done from Douglas's
     DC-9 document, gridded 1984 scans.
     The A319 is drawn with sharklets. Many fly with wingtip fences, which would be a variant. The 757-200 and 767-300ER
     are drawn with plain wingtips, as Boeing's documents draw them. Most US ones fly with blended winglets (Aviation
     Partners Boeing's), which would be variants from a non-Boeing source.
- **Shapes for the hard cases** above are done. Propellers and a high wing came with the Dash 8-400. Engines on the
  fuselage and T-tails are done with the 717. A 747's upper deck is done as `fuselage.hump`. A center engine is done as
  `engines[].mount: "tail"`, on the MD-11 and 727. A label on the upper deck itself (a title on the hump) has no space
  yet. Titles stay on the main tube. The 717's tailplane-and-fin fairing (the "bullet") is the fin's outline from the
  side but isn't modeled round in 3D.
- **The fuselage's real cross-section.** Two quarter-ellipses are close on the A320 (3.97 m wide, 4.15 m tall). The
  front view has the true one, partly hidden by the wing and gear.
- **The wing-to-body fairing, pylons, flap-track fairings, landing gear:** in the drawings, not yet in the
  shapes.
- **In the renderer:** smooth curves through a scheme's area points, a pylon where a nacelle sits as high as the wing
  (the A320's gets none) and the 3D example built from a measured shape.
