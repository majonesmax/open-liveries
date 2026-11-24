// Textures for a 3D model: the fuselage's paint unrolled in its own coordinates, so a mesh whose texture
// coordinates follow the fuselage (along it, and round it) wears the scheme without distortion.
//
// The fuselage texture's columns run nose (left edge) to tail (right edge). Its rows run once round: from the
// belly's centerline at the bottom, up the left side to the crown at mid-height, then down the right side to the
// belly again at the top. With three.js's default (flipY) that's u = x and v = angle / 2π, the angle measured from
// the belly up the left side. Its height is chosen so a pixel is as tall as it is wide on the cabin, so lettering
// keeps its proportions on the model. Belly titles and logos aren't drawn on it (they sit across the seam).

import { NEUTRAL, NOZZLE, UNPAINTED_FUSELAGE } from './colors.js';
import type { Geometry, Mapping } from './geometry.js';
import { drawLogo, drawTitle } from './labels.js';
import { drawAreas, onThePaint, PAINT_MARGIN, paintDoors, paintFuselage, paintGlass } from './paint.js';
import type { Livery, Point } from './scheme.js';
import { createCanvas, showsOn, svgElement } from './svg.js';
import type { Canvas, DrawOptions, Element } from './svg.js';

/** The fuselage texture's width in pixels; its height follows the shape. */
const TEXTURE_WIDTH = 2048;
/** The engine texture's size in pixels. */
const ENGINE_TEXTURE = { width: 1024, height: 512 };

/** The fuselage texture's height for a shape: the cabin's circumference at the same pixels per meter as its length. */
function fuselageTextureHeight(geometry: Geometry): number {
  const { length, radius } = geometry.shape.fuselage;
  return Math.round((TEXTURE_WIDTH * 2 * Math.PI * radius) / length);
}

/**
 * One side's half of an unrolled texture `width` by `height`. Each half is drawn as that side is seen (top up, nose
 * toward its own end) in the top half's frame: `mapping` takes the part's x (0 to 1) across and its y (−1 to 1) over
 * the half. `transform` then moves the left side down to the bottom half and turns the right side half a turn, which
 * puts its nose at the left edge and its top at mid-height, as the rows require.
 */
function unrolled(side: 'left' | 'right', width: number, height: number): { mapping: Mapping; transform: string } {
  const half = height / 2;
  return {
    mapping: (x, y) => [side === 'left' ? x * width : (1 - x) * width, ((1 - y) / 2) * half],
    transform: side === 'left' ? `translate(0,${half})` : `rotate(180,${width / 2},${half / 2})`,
  };
}

/**
 * A part's titles and logos on one side's half of its texture, through `mapping`: a y unit is a quarter of the half's
 * height, and the part's length is the texture's `width`. On paint that ends short of the part's end (`paintedTo`: an
 * engine's fan cowl) they stay ahead of its end, as from the side.
 */
function drawTextureLabels(
  livery: Livery,
  place: 'fuselage' | 'engines',
  side: 'left' | 'right',
  canvas: Canvas,
  group: Element,
  { mapping, height, width, paintedTo }: { mapping: Mapping; height: number; width: number; paintedTo?: number },
): void {
  const yUnit = height / 2 / 2;
  for (const title of livery.titles ?? []) {
    if (title.place !== place || !showsOn(title, side)) continue;
    const fitted = paintedTo !== undefined ? onThePaint(title, paintedTo) : title;
    const placement = {
      at: mapping(fitted.at[0], fitted.at[1]),
      capHeight: fitted.height * yUnit,
      length: fitted.length ? fitted.length * width : 0,
      side,
    };
    drawTitle(fitted, placement, group, canvas);
  }
  for (const logo of livery.logos ?? []) {
    if (logo.place !== place || !showsOn(logo, side)) continue;
    // Kept ahead of the paint's end by about half its width (as wide as it's tall: its mark's width isn't known here).
    const half = (logo.height * yUnit) / 2 / width;
    const x = paintedTo !== undefined ? Math.min(logo.at[0], paintedTo - PAINT_MARGIN - half) : logo.at[0];
    drawLogo(logo, mapping(x, logo.at[1]), logo.height * yUnit, side, group, canvas);
  }
}

export function drawFuselageTexture(livery: Livery, geometry: Geometry, options: DrawOptions = {}): Element {
  const width = TEXTURE_WIDTH;
  const height = fuselageTextureHeight(geometry);
  const half = height / 2;
  const label = `${livery.airline} ${livery.name}, fuselage texture`;
  const canvas = createCanvas(livery, label, height, { ...options, width });
  const base = canvas.color(livery.fuselage?.base ?? UNPAINTED_FUSELAGE);
  svgElement('rect', { x: 0, y: 0, width, height, fill: base }, canvas.svg);

  for (const side of ['left', 'right'] as const) {
    const { mapping, transform } = unrolled(side, width, height);
    const frame: Point[] = [
      [0, 0],
      [width, 0],
      [width, half],
      [0, half],
    ];
    const outer = svgElement('g', { transform }, canvas.svg);
    const group = svgElement('g', { 'clip-path': canvas.clipTo(`tex${side}`, frame) }, outer);
    paintFuselage(livery, side, canvas, geometry, mapping, group);
    drawTextureLabels(livery, 'fuselage', side, canvas, group, { mapping, height, width });
    paintGlass(livery, canvas, geometry, mapping, group);
    paintDoors(canvas, geometry, side, mapping, group);
  }
  return canvas.svg;
}

/**
 * An engine nacelle's paint unrolled: columns from the inlet lip (left edge) to the exhaust (right edge); rows from
 * the bottom up the side seen from the left to the top at mid-height, then down the side seen from the right. Rows
 * are even in the engine's own y (−1 at the bottom, 1 at the top, as its areas are measured), not in the angle round
 * it: a point at angle a from the bottom is at y = −cos a.
 */
export function drawEngineTexture(livery: Livery, options: DrawOptions = {}, cowlEnd?: number): Element {
  const { width, height } = ENGINE_TEXTURE;
  const canvas = createCanvas(livery, `${livery.airline} ${livery.name}, engine texture`, height, {
    ...options,
    width,
  });
  const engines = livery.engines ?? {};
  svgElement('rect', { x: 0, y: 0, width, height, fill: canvas.color(engines.cowling, NEUTRAL.engines) }, canvas.svg);
  for (const side of ['left', 'right'] as const) {
    const { mapping, transform } = unrolled(side, width, height);
    const group = svgElement('g', { transform }, canvas.svg);
    drawAreas(engines.areas, side, [-1, 1], mapping, canvas, group);
    // Lettering and logos on the cowl, as from the side.
    drawTextureLabels(livery, 'engines', side, canvas, group, {
      mapping,
      height,
      width,
      ...(cowlEnd !== undefined ? { paintedTo: cowlEnd } : {}),
    });
  }
  // Behind the fan cowl (`cowlEnd`, its share from the inlet) the core and nozzle: bare metal, over any paint.
  if (cowlEnd !== undefined && cowlEnd < 1) {
    svgElement('rect', { x: cowlEnd * width, y: 0, width: (1 - cowlEnd) * width, height, fill: NOZZLE }, canvas.svg);
  }
  return canvas.svg;
}
