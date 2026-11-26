import type { Livery } from './scheme.js';
import type { Outlines, Parts } from './side-parts.js';
import type { Canvas, Element } from './svg.js';
type Side = 'left' | 'right';
type LabelPart = 'fuselage' | 'fin' | 'engines' | 'winglets';
/**
 * Titles, then logos. Fuselage and fin labels are clipped to their part: paint stays on the skin. Drawn flat, a
 * big title's tallest letters (Alaska's l and k) would rise past the crown, where on the aircraft they curve
 * over it. Engine and winglet labels are returned to be drawn after those parts, on every engine seen from this
 * side. Belly and under-wing labels belong to the below view. With more than one engine a side, the nearest
 * (outboard) engine's labels are drawn last with the winglet's; each one behind it has its labels in `behind`, by
 * engine, to be drawn straight after that engine, so the nearer nacelle covers them as it covers the engine.
 */
export declare function drawLabels(livery: Livery, side: Side, canvas: Canvas, parts: Parts, outlines: Outlines, only?: LabelPart, finParent?: Element): ((parent: Element) => void)[] & {
    behind: ((parent: Element) => void)[][];
};
export {};
