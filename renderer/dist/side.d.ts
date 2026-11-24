import type { Geometry } from './geometry.js';
import type { Livery } from './scheme.js';
import type { DrawOptions, Element } from './svg.js';
type Side = 'left' | 'right';
export declare function drawSide(livery: Livery, side: Side, geometry: Geometry, options?: DrawOptions): Element;
/**
 * The fin alone, painted and lettered, in the side view's frame with nothing else drawn: a texture for a flat fin
 * whose vertices take their side-view positions as coordinates (the renderer's `sideProjection`).
 */
export declare function drawFinPicture(livery: Livery, side: Side, geometry: Geometry, options?: DrawOptions): Element;
/**
 * The winglet's box in the side view's pixels (x, y, width, height), a little round it: what its 3D texture shows
 * (`drawWingletPicture`, `wingletBox`), so a logo on it isn't a few pixels of the whole view.
 */
export declare function wingletCrop(geometry: Geometry, side: Side): [number, number, number, number] | undefined;
/** The winglet from one side, cropped to it (`wingletCrop`): its 3D face wears it, as a fin's does the fin picture. */
export declare function drawWingletPicture(livery: Livery, side: Side, geometry: Geometry, options?: DrawOptions): Element;
export {};
