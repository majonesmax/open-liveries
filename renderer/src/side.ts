// A scheme seen from one side, in the paint order of docs/COORDINATES.md: each part's base, its areas, the
// radome and the paint round the glass, then titles and logos, then the windows over them.

import {
  COCKPIT_FRAME,
  COCKPIT_GLASS,
  NEUTRAL,
  NOZZLE,
  OUTLINE,
  OUTLINE_DARK,
  PROPELLER,
  spinnerPaint,
  UNPAINTED_FUSELAGE,
  WINDOW_GLASS,
} from './colors.js';
import type { Geometry, Mapping } from './geometry.js';
import { inside, rect } from './geometry.js';
import {
  doorSeam,
  drawAreas,
  maskAround,
  paintDoors,
  paintFuselage,
  paintGlass,
  polish,
  runs,
  stubPylonPaint,
} from './paint.js';
import { carriedToTheCrown } from './landmarks.js';
import type { Area, Livery, Point } from './scheme.js';
import { drawLabels } from './side-labels.js';
import { finFaceX, finStrip, partOutlines, sideParts } from './side-parts.js';
import type { Outlines, Parts } from './side-parts.js';
import { createCanvas, densify, round1, svgElement } from './svg.js';
import type { Canvas, DrawOptions, Element } from './svg.js';

type Side = 'left' | 'right';

export function drawSide(livery: Livery, side: Side, geometry: Geometry, options: DrawOptions = {}): Element {
  const label = `${livery.airline} ${livery.name}, ${side} side`;
  const canvas = createCanvas(livery, label, geometry.sideHeight, options);
  const { svg } = canvas;
  const parts = sideParts(geometry, side);
  const outlines = partOutlines(parts);

  drawFin(livery, side, canvas, parts, outlines.fin);
  drawFuselage(livery, side, canvas, parts, outlines.fuselage);
  const engineAndWingletLabels = drawLabels(livery, side, canvas, parts, outlines);
  drawWindows(livery, side, canvas, parts, outlines.fuselage);
  drawHump(livery, side, canvas, parts);
  drawTailEngines(livery, side, canvas, parts);
  drawWingsAndEngines(livery, side, canvas, parts, outlines, engineAndWingletLabels.behind);
  // Engine and winglet labels go over the near engines and winglet, drawn just above.
  const top = svgElement('g', {}, svg);
  for (const draw of engineAndWingletLabels) draw(top);
  return svg;
}

/**
 * An upper deck above the main tube (a 747's hump), over the fuselage: the crown's paint carried straight up at each
 * x (as the fin's fillet carries it), then its glass and doors, and its outline along the top. The main tube's paint
 * space is untouched: a scheme measured on it renders as measured.
 */
function drawHump(livery: Livery, side: Side, canvas: Canvas, parts: Parts): void {
  const hump = parts.geometry.measured?.hump;
  if (!hump) return;
  const { mirror, geometry } = parts;
  const shape = hump.outline.map(mirror);
  const group = svgElement('g', { 'clip-path': canvas.clipTo('hump', shape) }, canvas.svg);
  const step = geometry.share(0.03);
  const top = Math.min(...shape.map((p) => p[1])) - 2;
  const bottom = Math.max(...shape.map((p) => p[1])) + 2;
  const runsOnCrown = runs(livery, side, canvas, 0.985, hump.from - step, hump.to + step, step);
  runsOnCrown.forEach((run, k) => {
    const end = runsOnCrown[k + 1]?.x ?? hump.to + step;
    const [x0] = parts.fuselage(run.x, 0.985);
    const [x1] = parts.fuselage(end, 0.985);
    canvas.polygon(
      [
        [x0, top],
        [x1, top],
        [x1, bottom],
        [x0, bottom],
      ],
      run.color,
      group,
    );
  });
  const panes = hump.glass.cockpit.map((pane) => pane.map(mirror));
  const mask = livery.fuselage?.cockpitWindows?.mask;
  if (mask && panes.length) {
    // A cockpit mask round the panes, as on the main tube: 0.15 m round the glass.
    canvas.polygon(maskAround(panes.flat(), geometry.scale * 0.15), canvas.color(mask), group);
  }
  if (livery.fuselage?.windows !== 'hidden') {
    for (const pane of hump.glass.cabin) canvas.polygon(pane.map(mirror), WINDOW_GLASS, group);
  }
  for (const pane of panes) canvas.polygon(densify(pane), COCKPIT_GLASS, group, COCKPIT_FRAME);
  for (const door of hump.doors) {
    if (door.side && door.side !== side) continue;
    canvas.polygon(door.outline.map(mirror), 'none', group, doorSeam(door.kind, geometry.scale));
    if (door.window) canvas.polygon(door.window.map(mirror), WINDOW_GLASS, group);
  }
  // Its outline along the top only: below, it runs into the main tube without a seam.
  const topLine = shape.slice(0, shape.length / 2);
  svgElement(
    'polyline',
    {
      points: topLine.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' '),
      fill: 'none',
      stroke: OUTLINE_DARK,
    },
    canvas.svg,
  );
}

/**
 * The fin's space carried on down below its root and out past its edges, for a tail engine's paint: a point on the
 * fin's lowest edge (y 0 or below) goes 2 spans down, one on its leading or trailing edge 3 chords out. An area
 * running off the fin's foot then runs on across the nacelle under it (Western Global's stripes), sheared as the fin
 * is: its edges carried straight down from their first stretch. An area fitted from a twin's fin
 * (`carriedToTheCrown`, landmarks.ts) runs below the root already, its foot carried down: only its edges go out.
 */
const carriedDown = ([x, y]: Point, area: Area): Point => [
  x <= 0 ? -3 : x >= 1 ? 4 : x,
  y <= 0 && !carriedToTheCrown.has(area) ? -2 : y,
];

/**
 * Engines on the tail's centerline (the MD-11's through the fin's base, the 727's S-duct intake), over the fuselage
 * and the fin's foot: the fin's paint carried down (its base, and its areas where they reach its foot; not the rudder,
 * a separate surface) and on an S-duct's fairing the fin's logos where they reach down over it, the inlet lip as the scheme's other engines',
 * the bare exhaust in metal (docs/COORDINATES.md).
 */
function drawTailEngines(livery: Livery, side: Side, canvas: Canvas, parts: Parts): void {
  const tails = parts.geometry.measured?.tailEngines;
  if (!tails?.length) return;
  const fin = livery.fin ?? { base: livery.fuselage?.base ?? UNPAINTED_FUSELAGE };
  const faceX = finFaceX(livery, side);
  const onFace: Mapping = (x, y) => parts.fin(faceX(x), y);
  const outlines = partOutlines(parts);
  tails.forEach((tail, i) => {
    const outline = tail.outline.map(parts.mirror);
    // An S-duct fairing's paint meets the fin's along its outline under the fin, the same paint on both sides: the
    // group is painted whole and then clipped (isolated), or each shape clipped on its own leaves a pale hairline there
    // where the base shows through the areas' anti-aliased edge.
    const group = svgElement(
      'g',
      { 'clip-path': canvas.clipTo(`tail${i}`, outline), ...(tail.duct === 's' ? { style: 'isolation:isolate' } : {}) },
      canvas.svg,
    );
    canvas.polygon(outline, canvas.color(fin.base), group);
    drawAreas(fin.areas, side, [-2, 1.1], onFace, canvas, group, carriedDown, [0, 1]);
    // An S-duct's intake fairing is the fin's foot (the 727's, the L-1011's): the fin's lettering and logos placed low
    // run on over it (TWA's title, Pan Am's globe and flag). A straight-through nacelle (the MD-11's) is in front of the
    // fin, and covers it as before.
    if (tail.duct === 's') drawLabels(livery, side, canvas, parts, outlines, 'fin', group);
    if (livery.engines?.inletLip)
      canvas.polygon(tail.lip.map(parts.mirror), canvas.color(livery.engines.inletLip), group);
    if (tail.duct === 's') {
      // Under the fin, an S-duct's fairing runs on behind the fin's skin (its outline bridged there): the paint is one
      // surface from the fairing up into the fin, so its outline is drawn only where it shows, outside the fin (the
      // lip, the top and its fillet) and along the crown. Where it runs along the fin's own edge, the fin's line is it.
      const hidden = (p: Point, inward: Point): boolean =>
        inside(inward, outlines.fin) &&
        !inside(inward, outlines.fuselage) &&
        edgeDistance(p, outlines.fuselage) > SEAM_MARGIN;
      for (const run of shownRuns(outline, hidden)) {
        svgElement(
          'polyline',
          { points: run.map(([x, y]) => `${round1(x)},${round1(y)}`).join(' '), fill: 'none', stroke: OUTLINE_DARK },
          canvas.svg,
        );
      }
    } else canvas.polygon(outline, 'none', canvas.svg, { stroke: OUTLINE_DARK });
    if (tail.nozzle) canvas.polygon(tail.nozzle.map(parts.mirror), NOZZLE, canvas.svg, { stroke: OUTLINE_DARK });
  });
}

/** How near the fuselage's outline (px) an S-duct fairing's outline always shows: where it runs along the crown. */
const SEAM_MARGIN = 1.5;

/** The distance from a point to a closed outline's nearest edge. */
function edgeDistance([px, py]: Point, outline: readonly Point[]): number {
  let best = Infinity;
  outline.forEach(([x0, y0], i) => {
    const [x1, y1] = outline[(i + 1) % outline.length] ?? [x0, y0];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy))) : 0;
    best = Math.min(best, Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy)));
  });
  return best;
}

/**
 * A closed outline's stretches that show, as open polylines: each edge cut into pieces of at most `step` px, a piece
 * left out where it's `hidden`, asked of its middle and of that point half a pixel into the outline (so a stretch
 * lying along another part's edge counts as inside that part when the outline's inside is).
 */
function shownRuns(outline: readonly Point[], hidden: (p: Point, inward: Point) => boolean, step = 1.5): Point[][] {
  // Which way is in: the outline's turn (its signed area; y runs down).
  const area = outline.reduce((sum, [x0, y0], i) => {
    const [x1, y1] = outline[(i + 1) % outline.length] ?? [x0, y0];
    return sum + x0 * y1 - x1 * y0;
  }, 0);
  const turn = area > 0 ? 1 : -1;
  const pieces: [Point, Point, boolean][] = [];
  outline.forEach(([x0, y0], i) => {
    const [x1, y1] = outline[(i + 1) % outline.length] ?? [x0, y0];
    const length = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(length / step));
    const [nx, ny] = length ? [(-(y1 - y0) / length) * turn * 0.5, ((x1 - x0) / length) * turn * 0.5] : [0, 0];
    for (let k = 0; k < n; k++) {
      const a: Point = [x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n];
      const b: Point = [x0 + ((x1 - x0) * (k + 1)) / n, y0 + ((y1 - y0) * (k + 1)) / n];
      const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      pieces.push([a, b, !hidden(mid, [mid[0] + nx, mid[1] + ny])]);
    }
  });
  // Start at a hidden piece so a run doesn't wrap round the outline's first point.
  const start = Math.max(
    0,
    pieces.findIndex(([, , shown]) => !shown),
  );
  const runs: Point[][] = [];
  let run: Point[] | undefined;
  for (const [a, b, shown] of [...pieces.slice(start), ...pieces.slice(0, start)]) {
    if (!shown) {
      run = undefined;
      continue;
    }
    if (!run) runs.push((run = [a]));
    run.push(b);
  }
  // Each run thinned back to the outline's own corners (the cut points along a straight edge add nothing).
  return runs.map((r) => r.filter((p, k) => !collinear(r[k - 1], p, r[k + 1])));
}

/** Whether b lies on the straight line from a to c (false at a run's ends, where a or c is missing). */
const collinear = (a: Point | undefined, [bx, by]: Point, c: Point | undefined): boolean =>
  !!a && !!c && Math.abs((bx - a[0]) * (c[1] - a[1]) - (by - a[1]) * (c[0] - a[0])) < 1e-6;

/**
 * The fin alone, painted and lettered, in the side view's frame with nothing else drawn: a texture for a flat fin
 * whose vertices take their side-view positions as coordinates (the renderer's `sideProjection`).
 */
export function drawFinPicture(livery: Livery, side: Side, geometry: Geometry, options: DrawOptions = {}): Element {
  const label = `${livery.airline} ${livery.name}, fin from the ${side}`;
  const canvas = createCanvas(livery, label, geometry.sideHeight, options);
  const parts = sideParts(geometry, side);
  const outlines = partOutlines(parts);
  drawFin(livery, side, canvas, parts, outlines.fin);
  drawLabels(livery, side, canvas, parts, outlines, 'fin');
  // A tail engine wears the fin's paint: a 3D nacelle takes it from this picture, as the fin does.
  drawTailEngines(livery, side, canvas, parts);
  return canvas.svg;
}

/** The near winglet: its outer face's paint and areas, outlined darker than a wing (it stands in front of the body). */
function drawWinglet(livery: Livery, side: Side, canvas: Canvas, parts: Parts, outlines: Outlines): void {
  if (!parts.winglet) return;
  const winglets = livery.winglets ?? {};
  const wingletGroup = svgElement('g', { 'clip-path': canvas.clipTo('wl', outlines.winglet) }, canvas.svg);
  canvas.polygon(outlines.winglet, canvas.color(winglets.outer, NEUTRAL.winglets), wingletGroup);
  drawAreas(winglets.areas, side, [0, 1], parts.winglet, canvas, wingletGroup);
  // Outlined darker, as an engine is: it stands in front of the fuselage, often in the same paint at its root.
  canvas.polygon(outlines.winglet, 'none', canvas.svg, { stroke: OUTLINE_DARK });
}

/**
 * The winglet's box in the side view's pixels (x, y, width, height), a little round it: what its 3D texture shows
 * (`drawWingletPicture`, `wingletBox`), so a logo on it isn't a few pixels of the whole view.
 */
export function wingletCrop(geometry: Geometry, side: Side): [number, number, number, number] | undefined {
  const parts = sideParts(geometry, side);
  const outline = partOutlines(parts).winglet;
  if (!outline.length) return undefined;
  const xs = outline.map(([x]) => x);
  const ys = outline.map(([, y]) => y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const m = 0.05 * Math.max(x1 - x0, y1 - y0);
  return [x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m];
}

/** The winglet from one side, cropped to it (`wingletCrop`): its 3D face wears it, as a fin's does the fin picture. */
export function drawWingletPicture(livery: Livery, side: Side, geometry: Geometry, options: DrawOptions = {}): Element {
  const crop = wingletCrop(geometry, side);
  const canvas = createCanvas(
    livery,
    `${livery.airline} ${livery.name}, winglet from the ${side}`,
    geometry.sideHeight,
    {
      ...options,
      ...(crop ? { crop } : {}),
    },
  );
  const parts = sideParts(geometry, side);
  const outlines = partOutlines(parts);
  drawWinglet(livery, side, canvas, parts, outlines);
  for (const draw of drawLabels(livery, side, canvas, parts, outlines, 'winglets')) draw(canvas.svg);
  return canvas.svg;
}

/** The fin, behind the fuselage: base, rudder, areas. */
function drawFin(livery: Livery, side: Side, canvas: Canvas, parts: Parts, outline: Point[]): void {
  const fin = livery.fin ?? { base: livery.fuselage?.base ?? UNPAINTED_FUSELAGE };
  const faceX = finFaceX(livery, side);
  const onFace: Mapping = (x, y) => parts.fin(faceX(x), y);
  const group = svgElement('g', { 'clip-path': canvas.clipTo('fin', outline) }, canvas.svg);
  canvas.polygon(outline, canvas.color(fin.base), group);
  const { measured } = parts.geometry;
  if (fin.rudder) {
    // The rudder: from its hinge line where the shape has one, else about x 0.7, to the trailing edge.
    const hinge = measured?.rudderShare;
    const strip = hinge
      ? [
          ...Array.from({ length: 13 }, (_, i): Point => [hinge(-0.2 + (1.2 * i) / 12), -0.2 + (1.2 * i) / 12]),
          [1, 1] as Point,
          [1, -0.2] as Point,
        ]
      : densify(finStrip(0.7, 1));
    canvas.polygon(
      strip.map(([x, y]) => onFace(x, y)),
      canvas.color(fin.rudder),
      group,
    );
  }
  drawAreas(fin.areas, side, [-0.2, 1.1], onFace, canvas, group, undefined, [0, 1]);
  if (measured?.finFillet) {
    // The dorsal fillet ahead of the leading edge is the body's, faired up into the fin: the paint on the crown
    // under it carries straight up (stripes flowing from the body into the tail pass through it), unless the
    // scheme gives it its own colour (easyJet's white). It never takes the fin's paint.
    const ahead: Point[] = [
      [-1, -0.2],
      [0, -0.2],
      [0, 1.1],
      [-1, 1.1],
    ];
    // The body's, so in the fin's own shape on both sides, never through an unmirrored design's flip (which would
    // put the right side's fillet behind the trailing edge).
    const filletClip = canvas.clipTo(
      'fillet',
      densify(ahead).map(([x, y]) => parts.fin(x, y)),
    );
    const fillet = svgElement('g', { 'clip-path': filletClip }, group);
    paintFilletFromCrown(livery, side, canvas, parts, fin.fillet, fillet);
    // Below the fin's root (aft, where the crown falls away under it) is the body's too: a fin's logo (United's
    // globe) stays off the tail cone's top.
    const below: Point[] = [
      [0, -0.4],
      [1.2, -0.4],
      [1.2, 0],
      [0, 0],
    ];
    const belowClip = canvas.clipTo(
      'finfoot',
      densify(below).map(([x, y]) => parts.fin(x, y)),
    );
    paintFilletFromCrown(livery, side, canvas, parts, undefined, svgElement('g', { 'clip-path': belowClip }, group));
  }
  canvas.polygon(outline, 'none', canvas.svg, { stroke: OUTLINE });
}

/**
 * The fillet: the crown's paint carried on up, each run slanted the way the body's stripes run there (from where
 * they cross a lower line), so a stripe flowing from the body into the tail passes through it; or one colour.
 */
function paintFilletFromCrown(
  livery: Livery,
  side: Side,
  canvas: Canvas,
  parts: Parts,
  own: string | undefined,
  group: Element,
): void {
  const { geometry } = parts;
  const step = geometry.share(0.03);
  const root = geometry.share(geometry.shape.fin.rootLeading);
  const from = root - geometry.share(9);
  const to = 1;
  const top = own ? [{ x: from, color: canvas.color(own) }] : runs(livery, side, canvas, 0.985, from, to, step);
  // The stripes' slant: boundaries on the crown against the same ones a little lower down.
  const low = own ? [] : runs(livery, side, canvas, 0.75, from - geometry.share(4), to, step);
  const yTop = parts.fuselage(root, 0.985)[1];
  const yLow = parts.fuselage(root, 0.75)[1];
  const px = (x: number): number => parts.fuselage(x, 0.985)[0];
  let slant = 0;
  const pairs = top.slice(1).flatMap((t, i) => {
    const l = low.slice(1)[i];
    return l ? [(px(t.x) - parts.fuselage(l.x, 0.75)[0]) / (yTop - yLow)] : [];
  });
  if (pairs.length && top.length === low.length) slant = pairs.reduce((a, b) => a + b, 0) / pairs.length;
  const base = parts.fuselage(root, 0.9)[1];
  const along = (x: number, y: number): number => px(x) + slant * (y - yTop);
  top.forEach((run, k) => {
    const end = top[k + 1]?.x ?? to;
    canvas.polygon(
      [
        [along(run.x, base), base],
        [along(end, base), base],
        [along(end, 0), 0],
        [along(run.x, 0), 0],
      ],
      run.color,
      group,
    );
  });
}

/** How much darker a flap track fairing is than the wing's underside: it hangs in the wing's shadow. */
const FAIRING_SHADE = 0.22;

/** The fuselage: base, areas, radome, and the paint round the glass (a cockpit mask, a dark window band). */
function drawFuselage(livery: Livery, side: Side, canvas: Canvas, parts: Parts, outline: Point[]): void {
  const group = svgElement('g', { 'clip-path': canvas.clipTo('fus', outline) }, canvas.svg);
  canvas.polygon(outline, canvas.color(livery.fuselage?.base ?? UNPAINTED_FUSELAGE), group);
  if (livery.finish === 'metallic' || livery.finish === 'bareMetal') polish(canvas, parts.fuselage, group);
  paintFuselage(livery, side, canvas, parts.geometry, parts.fuselage, group);
  canvas.polygon(outline, 'none', canvas.svg, { stroke: OUTLINE_DARK });
}

/**
 * The cabin and cockpit windows, over the titles and logos: glass is never painted, so a title across the
 * window line shows the windows through its letters, as on the aircraft.
 */
function drawWindows(livery: Livery, side: Side, canvas: Canvas, parts: Parts, outline: Point[]): void {
  const group = svgElement('g', { 'clip-path': canvas.clipTo('win', outline) }, canvas.svg);
  paintGlass(livery, canvas, parts.geometry, parts.fuselage, group);
  paintDoors(canvas, parts.geometry, side, parts.fuselage, group);
}

/**
 * The near tailplane, wing, winglet, pylons and engines, in front of the fuselage. A T-tail's tailplane crosses the
 * fin near its top, in front of it; a rear-mounted engine sits over the fuselage, its stub pylon behind it showing as
 * the fairing aft of the nozzle. Each far-side part is behind its near twin (the same outline), so isn't drawn. The
 * labels of an engine with a nearer one in front of it (`behind`, by engine) come straight after it.
 */
function drawWingsAndEngines(
  livery: Livery,
  side: Side,
  canvas: Canvas,
  parts: Parts,
  outlines: Outlines,
  behind: ((parent: Element) => void)[][] = [],
): void {
  const { svg, color, polygon } = canvas;
  const { mirror, geometry } = parts;

  const stabilizer = livery.stabilizer ?? {};
  const stabilizerColor = stabilizer.top ?? stabilizer.under ?? livery.wings?.top;
  polygon(geometry.stabilizerSide.map(mirror), color(stabilizerColor, NEUTRAL.wings), svg, { stroke: OUTLINE });

  const wingColor = color(livery.wings?.under ?? livery.wings?.top, NEUTRAL.wings);
  // The flap track fairings hang under the near wing: drawn first, the wing's edge over their tops.
  for (const fairing of geometry.fairingsSide) {
    // In the wing's shadow: its underside's color, darkened.
    polygon(fairing.map(mirror), wingColor, svg);
    polygon(fairing.map(mirror), '#000000', svg, { 'fill-opacity': FAIRING_SHADE, stroke: OUTLINE });
  }
  polygon(geometry.wingSide.map(mirror), wingColor, svg, { stroke: OUTLINE });

  drawWinglet(livery, side, canvas, parts, outlines);

  const engines = livery.engines ?? {};
  const cowling = color(engines.cowling, NEUTRAL.engines);
  parts.engines.forEach(({ engine, point }, i) => {
    const outline = outlines.engines[i] ?? [];
    if (engine.underWing) {
      // The pylon, from the nacelle's top up into the wing.
      const length = engine.x1 - engine.x0;
      const pylon: Point[] = [
        point(0.25, 0.9),
        point(0.95, 0.9),
        mirror([engine.x1 + 0.3 * length, engine.wingY]),
        mirror([engine.x0 + 0.78 * length, engine.wingY]),
      ];
      polygon(pylon, color(engines.pylon, cowling), svg, { stroke: OUTLINE });
    }
    if (engine.stubPylon) {
      // A stub pylon on the fuselage: the body's paint where it meets it, unless the scheme names it (COORDINATES.md).
      polygon(engine.stubPylon.side.map(mirror), color(stubPylonPaint(livery, side, engine), UNPAINTED_FUSELAGE), svg, {
        stroke: OUTLINE,
      });
    }
    const engineGroup = svgElement('g', { 'clip-path': canvas.clipTo(`eng${i}`, outline) }, svg);
    polygon(outline, cowling, engineGroup);
    drawAreas(engines.areas, side, [-1, 1], point, canvas, engineGroup);
    if (engines.inletLip) {
      const lip = densify(rect(0, -1, 0.05, 1)).map(([x, y]) => point(x, y));
      polygon(lip, color(engines.inletLip), engineGroup);
    }
    // Behind the fan cowl the core and nozzle: bare metal, over any paint.
    if (engine.cowlEnd !== undefined && engine.cowlEnd < 1) {
      const core = densify(rect(engine.cowlEnd, -1.05, 1.05, 1.05)).map(([x, y]) => point(x, y));
      polygon(core, NOZZLE, engineGroup, { stroke: OUTLINE_DARK });
    }
    polygon(outline, 'none', svg, { stroke: OUTLINE_DARK });
    if (engine.propeller) {
      polygon(engine.propeller.disc.map(mirror), PROPELLER.blades, svg, { 'fill-opacity': PROPELLER.discOpacity });
      polygon(engine.propeller.spinner.map(mirror), color(spinnerPaint(livery), NEUTRAL.engines), svg, {
        stroke: OUTLINE_DARK,
      });
    }
    const labels = behind[i];
    if (labels?.length) {
      const group = svgElement('g', {}, svg);
      for (const draw of labels) draw(group);
    }
  });
}
