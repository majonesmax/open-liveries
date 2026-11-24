// A scheme seen from below with the nose to the left, so the aircraft's left side is the top half of the
// picture. Each half of the fuselage shows that side's areas, from the belly's centerline up to y = 0.

import { NEUTRAL, NOZZLE, OUTLINE, OUTLINE_DARK, PROPELLER, spinnerPaint, UNPAINTED_FUSELAGE } from './colors.js';
import type { Livery, Point } from './scheme.js';
import { fromHeight, HALVES, halfSign } from './geometry.js';
import type { Geometry, Half } from './geometry.js';
import { drawLogo, drawTitle } from './labels.js';
import { stubPylonPaint } from './paint.js';
import { areaPolygon, createCanvas, densify, densifyArea, showsOn, svgElement } from './svg.js';
import type { Canvas, DrawOptions, Element } from './svg.js';

export function drawBelow(livery: Livery, geometry: Geometry, options: DrawOptions = {}): Element {
  const label = `${livery.airline} ${livery.name}, from below`;
  const canvas = createCanvas(livery, label, geometry.belowHeight, options);
  // Wings, tailplane and engines first: from below, the fuselage is nearer.
  for (const half of HALVES) drawWingAndTailplane(livery, half, canvas, geometry);
  for (const half of HALVES) drawEngines(livery, half, canvas, geometry);
  drawTailEngines(livery, canvas, geometry);
  drawFuselage(livery, canvas, geometry);
  drawLabels(livery, canvas, geometry);
  return canvas.svg;
}

/** How many belly and under-wing titles and logos a scheme has: what the below view adds to the sides. */
export function belowLabelCount(livery: Livery): number {
  const titles = (livery.titles ?? []).filter((t) => t.place === 'belly').length;
  const logos = (livery.logos ?? []).filter((l) => l.place === 'belly' || l.place === 'wingUnder').length;
  return titles + logos;
}

function drawWingAndTailplane(livery: Livery, half: Half, canvas: Canvas, geometry: Geometry): void {
  const { svg, color, polygon } = canvas;
  const wings = livery.wings ?? {};
  const corners: Point[] = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ];
  const wing = geometry.measured?.wingBelow(half) ?? corners.map(([x, y]) => geometry.wingUnderPoint(x, y, half));
  polygon(wing, color(wings.under ?? wings.top, NEUTRAL.wings), svg, { stroke: OUTLINE });

  const stabilizer = livery.stabilizer ?? {};
  const tailplaneColor = stabilizer.under ?? stabilizer.top ?? wings.under;
  polygon(geometry.tailplaneBelow(half), color(tailplaneColor, NEUTRAL.wings), svg, { stroke: OUTLINE });
}

/**
 * The engines under each wing, or on the rear fuselage (on their stub pylons): nacelles tapering at the exhaust,
 * with their inlet lips.
 */
function drawEngines(livery: Livery, half: Half, canvas: Canvas, geometry: Geometry): void {
  const { svg, color, polygon } = canvas;
  const engines = livery.engines ?? {};
  for (const engine of geometry.engines) {
    const y = geometry.belowCenterY + halfSign(half) * engine.lateral;
    const w = engine.belowHalfWidth ?? engine.halfHeight * 0.8;
    const { x0: front, x1: back } = engine;
    if (engine.underWing) {
      // The pylon, from mid-nacelle back into the wing.
      const pylonBack = Math.max(back, engine.wingLeadingX) + 0.15 * (back - front);
      const half = w * 0.22;
      const pylon: Point[] = [
        [front + 0.5 * (back - front), y - half],
        [pylonBack, y - half],
        [pylonBack, y + half],
        [front + 0.5 * (back - front), y + half],
      ];
      polygon(pylon, color(engines.pylon ?? engines.cowling, NEUTRAL.engines), svg, { stroke: OUTLINE });
    }
    if (engine.stubPylon) {
      const paint = color(stubPylonPaint(livery, half, engine), UNPAINTED_FUSELAGE);
      polygon(engine.stubPylon.below(half), paint, svg, { stroke: OUTLINE });
    }
    const taperStart = back - 0.15 * (back - front);
    const nacelle: Point[] = [
      [front, y - w],
      [taperStart, y - w],
      [back, y - w * 0.6],
      [back, y + w * 0.6],
      [taperStart, y + w],
      [front, y + w],
    ];
    polygon(nacelle, color(engines.cowling, NEUTRAL.engines), svg, { stroke: OUTLINE_DARK });
    if (engines.inletLip) {
      const lipBack = front + 0.045 * (back - front);
      const lip: Point[] = [
        [front, y - w],
        [lipBack, y - w],
        [lipBack, y + w],
        [front, y + w],
      ];
      polygon(lip, color(engines.inletLip), svg);
    }
    if (engine.propeller) {
      const { disc, spinner } = engine.propeller.below(half);
      polygon(disc, PROPELLER.blades, svg, { 'fill-opacity': PROPELLER.discOpacity });
      polygon(spinner, color(spinnerPaint(livery), NEUTRAL.engines), svg, { stroke: OUTLINE_DARK });
    }
  }
}

/**
 * A tail engine's nacelle from below, where it shows past the fuselage (the MD-11's): the fin's base colour (the
 * paint it wears from the side, carried down), its core and nozzle behind the cowl bare metal. An S-duct's intake
 * is on top, out of sight.
 */
function drawTailEngines(livery: Livery, canvas: Canvas, geometry: Geometry): void {
  const { svg, color, polygon } = canvas;
  const base = livery.fin?.base ?? livery.fuselage?.base;
  for (const tail of geometry.measured?.tailEngines ?? []) {
    if (tail.belowNozzle) polygon(tail.belowNozzle, NOZZLE, svg, { stroke: OUTLINE_DARK });
    if (tail.below) polygon(tail.below, color(base, UNPAINTED_FUSELAGE), svg, { stroke: OUTLINE_DARK });
  }
}

function drawFuselage(livery: Livery, canvas: Canvas, geometry: Geometry): void {
  const { svg, color, polygon } = canvas;
  const { bellyPoint } = geometry;
  const fuselage = livery.fuselage ?? { base: UNPAINTED_FUSELAGE };
  const xs = geometry.measured?.fuselageSamples ?? Array.from({ length: 121 }, (_, i) => i / 120);
  const outline: Point[] = [
    ...xs.map((x) => bellyPoint(x, 0, 'left')),
    ...[...xs].reverse().map((x) => bellyPoint(x, 0, 'right')),
  ];

  const group = svgElement('g', { 'clip-path': canvas.clipTo('bfus', outline) }, svg);
  polygon(outline, color(fuselage.base), group);
  for (const half of HALVES) {
    const onHalf = ([x, y]: Point): Point => bellyPoint(x, y, half);
    for (const area of fuselage.areas ?? []) {
      if (!showsOn(area, half)) continue;
      const outline = areaPolygon(area, -1, 1, [-1, 1], true);
      const dense = area.smooth === true ? densifyArea(outline) : densify(outline);
      polygon(
        dense.map(([x, h]) => onHalf([x, fromHeight(h)])),
        color(area.color),
        group,
      );
    }
    if (fuselage.radome) {
      const to = fuselage.radome.to ?? 0.025;
      const radome: Point[] = [
        [0, -1],
        [to, -1],
        [to, 0],
        [0, 0],
      ];
      polygon(densify(radome).map(onHalf), color(fuselage.radome.color), group);
    }
  }
  polygon(outline, 'none', svg, { stroke: OUTLINE_DARK });
}

/**
 * Belly titles and logos, and logos under the wings. A belly label's y is the line its middle runs on (−1 the
 * centerline; toward −0.8 is a little toward the left side, the top here). Its height counts the fuselage's
 * full height as 2.
 */
function drawLabels(livery: Livery, canvas: Canvas, geometry: Geometry): void {
  const { bellyPoint, wingUnderPoint, radius } = geometry;
  const group = svgElement('g', {}, canvas.svg);
  for (const title of livery.titles ?? []) {
    if (title.place !== 'belly') continue;
    const placement = {
      at: bellyPoint(title.at[0], title.at[1], 'left'),
      capHeight: title.height * radius,
      length: title.length ? title.length * geometry.fuselageLength : 0,
      side: 'left' as const,
      centeredOnLine: true,
    };
    drawTitle(title, placement, group, canvas);
  }
  for (const logo of livery.logos ?? []) {
    const [x, y] = logo.at;
    if (logo.place === 'belly') {
      drawLogo(logo, bellyPoint(x, y, 'left'), logo.height * radius, 'below', group, canvas);
    } else if (logo.place === 'wingUnder') {
      const height = logo.height * (geometry.wingUnderSpan - radius);
      for (const half of HALVES) drawLogo(logo, wingUnderPoint(x, y, half), height, 'below', group, canvas);
    }
  }
}
