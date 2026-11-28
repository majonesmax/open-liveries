import type { EngineGeometry, Geometry, Mapping } from './geometry.js';
import type { Livery, Point } from './scheme.js';
type Side = 'left' | 'right';
/**
 * A strip of the fin from x0 to x1, root to tip. It starts a little below the root (y −0.2) so the fin meets
 * the curved crown without a gap.
 */
export declare const finStrip: (x0: number, x1: number) => Point[];
/** Each part's mapping from its own space into the picture, and `mirror` for points already in the left side's pixels. */
export interface Parts {
    geometry: Geometry;
    fuselage: Mapping;
    fin: Mapping;
    engines: {
        engine: EngineGeometry;
        point: Mapping;
    }[];
    winglet?: Mapping;
    mirror: (p: Point) => Point;
}
/** Each part's outline in the picture: what its paint is clipped to. */
export interface Outlines {
    fuselage: Point[];
    fin: Point[];
    engines: Point[][];
    winglet: Point[];
}
/** The parts seen from `side`. */
export declare function sideParts(geometry: Geometry, side: Side): Parts;
export declare function partOutlines(parts: Parts): Outlines;
/** With `mirrored: false` the right face shows the left face's picture unreversed: (x, y) → (1 − x, y). */
export declare function finFaceX(livery: Livery, side: Side): (x: number) => number;
/**
 * Where a fin's logos and lettering may show, besides inside its outline (which runs on down inside the body, under
 * the fuselage): above the fuselage's crown, as they're drawn over it; and on a fin with a fillet, not below its
 * root aft of the leading edge, the tail cone's top, which the fin's own paint leaves to the crown's (`drawFin`).
 * Ahead of the leading edge is the fillet, faired into the fin: the fin's art runs onto it (United's globe).
 */
export declare function finLabelClips(parts: Parts): Point[][];
export {};
