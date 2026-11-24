// The side view's parts as the picture shows them: each part's mapping into the picture (the right side mirrored,
// nose to the right) and the outlines the views clip each part's paint to.
import { rect, VIEW_WIDTH } from './geometry.js';
import { densify } from './svg.js';
/**
 * A strip of the fin from x0 to x1, root to tip. It starts a little below the root (y −0.2) so the fin meets
 * the curved crown without a gap.
 */
export const finStrip = (x0, x1) => [
    [x0, -0.2],
    [x0, 1],
    [x1, 1],
    [x1, -0.2],
];
/** The parts seen from `side`. */
export function sideParts(geometry, side) {
    // The right side is the left side's picture flipped, nose to the right.
    const mirror = (p) => (side === 'right' ? [VIEW_WIDTH - p[0], p[1]] : p);
    const onView = (mapping) => (x, y) => mirror(mapping(x, y));
    return {
        geometry,
        fuselage: onView(geometry.fuselagePoint),
        fin: onView(geometry.finPoint),
        engines: geometry.engines.map((engine) => ({
            engine,
            point: onView((x, y) => geometry.enginePoint(engine, x, y)),
        })),
        ...(geometry.winglet ? { winglet: onView(geometry.winglet.point) } : {}),
        mirror,
    };
}
export function partOutlines(parts) {
    const { measured } = parts.geometry;
    // A measured shape's outline runs through every measured point; a parametric one's through 121 even steps.
    const xs = measured?.fuselageSamples ?? Array.from({ length: 121 }, (_, i) => i / 120);
    const fuselage = [
        ...xs.map((x) => parts.fuselage(x, 1)),
        ...[...xs].reverse().map((x) => parts.fuselage(x, -1)),
    ];
    const fin = measured
        ? measured.finOutline.map(parts.mirror)
        : densify(finStrip(0, 1)).map(([x, y]) => parts.fin(x, y));
    const engines = parts.engines.map(({ point }) => densify(rect(0, 1, 1, -1), true, 20).map(([x, y]) => point(x, y)));
    const { winglet } = parts;
    const wingletOutline = winglet ? rect(0, 0, 1, 1).map(([x, y]) => winglet(x, y)) : [];
    return { fuselage, fin, engines, winglet: wingletOutline };
}
/** With `mirrored: false` the right face shows the left face's picture unreversed: (x, y) → (1 − x, y). */
export function finFaceX(livery, side) {
    return livery.fin?.mirrored === false && side === 'right' ? (x) => 1 - x : (x) => x;
}
