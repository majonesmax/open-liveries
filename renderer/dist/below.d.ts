import type { Livery } from './scheme.js';
import type { Geometry } from './geometry.js';
import type { DrawOptions, Element } from './svg.js';
export declare function drawBelow(livery: Livery, geometry: Geometry, options?: DrawOptions): Element;
/** How many belly and under-wing titles and logos a scheme has: what the below view adds to the sides. */
export declare function belowLabelCount(livery: Livery): number;
