import type { Geometry } from './geometry.js';
import type { Livery } from './scheme.js';
import type { DrawOptions, Element } from './svg.js';
export declare function drawFuselageTexture(livery: Livery, geometry: Geometry, options?: DrawOptions): Element;
/**
 * An engine nacelle's paint unrolled: columns from the inlet lip (left edge) to the exhaust (right edge); rows from
 * the bottom up the side seen from the left to the top at mid-height, then down the side seen from the right. Rows
 * are even in the engine's own y (−1 at the bottom, 1 at the top, as its areas are measured), not in the angle round
 * it: a point at angle a from the bottom is at y = −cos a.
 */
export declare function drawEngineTexture(livery: Livery, options?: DrawOptions, cowlEnd?: number): Element;
