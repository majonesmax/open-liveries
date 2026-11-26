import { belowLabelCount } from './below.js';
import type { MeasuredShape } from './measured.js';
import type { Livery } from './scheme.js';
import type { AircraftShape } from './shape.js';
import type { LogoPainter } from './svg.js';
export type * from './scheme.js';
export type { AircraftShape, Chords } from './shape.js';
export type { GearLeg, MeasuredShape } from './measured.js';
export { isMeasuredShape, measuredShapeProblems } from './measured.js';
export { schemeOn } from './per-type.js';
/** A shape to draw on: a parametric one (built in, or your own numbers), or a measured type from shapes/. */
export type Shape = AircraftShape | MeasuredShape;
export type { LogoBox, LogoPainter } from './svg.js';
export { NARROWBODY, REGIONAL, SHAPES, WIDEBODY, shapeNamed, shapeProblems } from './shape.js';
export { belowLabelCount };
export { colorOf, NEUTRAL, PROPELLER, spinnerPaint, UNPAINTED_FUSELAGE } from './colors.js';
export interface RenderOptions {
    /** What to paint it on: a built-in or your own shape, or a measured type (shapes/<type>.json). Default: the narrowbody. */
    shape?: Shape | undefined;
    /** Draws each logo the scheme places; without one, or where it returns undefined, a labeled placeholder. */
    logo?: LogoPainter | undefined;
    /** Starts the ids of the picture's clip paths, to keep them apart from others on the same page. */
    idPrefix?: string | undefined;
    /**
     * The shape the scheme was measured on (shapes/ for its `drawnOn`). Given, and not `shape`, the fuselage's paint,
     * titles and logos are fitted to `shape` by the two types' landmarks (docs/COORDINATES.md, Landmarks); without
     * it, they're placed by their shares as written.
     */
    drawnOn?: Shape | undefined;
}
/**
 * The scheme from one side, as an SVG document: nose left for the left side, nose right for the right. On a measured
 * shape the scheme's paint for that type (its `types`) is laid over its own, here and in every view and texture.
 */
export declare function renderSide(scheme: Livery, options?: RenderOptions & {
    side?: 'left' | 'right' | undefined;
}): string;
/** The scheme from below, nose left: the aircraft's left side is the top half. */
export declare function renderBelow(scheme: Livery, options?: RenderOptions): string;
/**
 * A texture for a 3D model. `'fuselage'`: the fuselage's paint unrolled round it, 2048 wide (columns nose to tail;
 * rows from the belly up the left side to the crown, then down the right side: u = x, v = angle / 2π from the
 * belly, up the left). `'fin'`: the fin alone, as seen from `side`, in the side view's frame: give a flat fin's
 * vertices texture coordinates from `sideProjection`. `'engine'`: a nacelle's paint, 1024 by 512 (columns inlet to
 * exhaust; rows from the bottom up the side seen from the left to the top, then down the side seen from the right,
 * even in the engine's height: v = (1 − cos a) / 4 up the left, 1 − (1 − cos a) / 4 down the right, for a the angle
 * from the bottom). The same for every engine. On a measured shape every part wears the scheme's paint for that type
 * (its `types`), so give the engine's texture the `shape` too.
 */
export declare function renderTexture(scheme: Livery, part: 'fuselage' | 'fin' | 'engine' | 'winglet', options?: RenderOptions & {
    side?: 'left' | 'right' | undefined;
}): string;
/** Where the side view draws a point, as texture coordinates: 0 to 1 across, and 0 at the bottom to 1 at the top. */
export interface SideProjection {
    /** The side view's size in pixels (what `renderSide` and a fin texture are drawn at). */
    width: number;
    height: number;
    /** A point on the aircraft, meters back from the nose and meters above the centerline, seen from the left. */
    uv: (meters: number, height: number) => [u: number, v: number];
}
export declare function sideProjection(shape?: Shape): SideProjection;
/**
 * Where a winglet's texture (`renderTexture(scheme, 'winglet', { shape, side })`) lies in `sideProjection`'s u and v
 * (u0, v0, u1, v1, seen from the left): a 3D winglet's face maps its projected points into it. None without one.
 */
export declare function wingletBox(shape?: Shape): [number, number, number, number] | undefined;
/**
 * The fuselage's outline as the renderer draws it: at fuselage x (0 nose to 1 tail), the crown's and the belly's
 * heights above the centerline in meters. A 3D fuselage built on it lines up with the pictures.
 */
export declare function fuselageProfile(shape?: Shape): (x: number) => {
    crown: number;
    belly: number;
};
/**
 * A rear-mounted engine's stub pylon color (a measured shape's `engines[i].pylon`, `engine` its index inboard
 * first), seen from one side: the scheme's `engines.pylon`, else the fuselage's paint where the pylon meets it.
 * Undefined for an engine without one.
 */
export declare function stubPylonColor(scheme: Livery, shape: Shape, engine: number, side?: 'left' | 'right'): string | undefined;
