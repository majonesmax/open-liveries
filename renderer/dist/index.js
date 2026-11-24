// Open Liveries' reference renderer: a scheme (liveries/<airline>/<id>.json) drawn as SVG on one of the shapes
// that come with it, on a measured type (shapes/<type>.json), or on your own (an AircraftShape, in meters). Returns markup as text, so it runs in a
// browser, in Node or in a build step, with no dependencies.
//
//   import { renderSide, renderBelow, SHAPES } from './renderer/dist/index.js';
//   const svg = renderSide(scheme, { shape: SHAPES.widebody, side: 'right' });
import { belowLabelCount, drawBelow } from './below.js';
import { layout, VIEW_WIDTH } from './geometry.js';
import { isMeasuredShape, layoutMeasured, measuredShapeProblems } from './measured.js';
import { NARROWBODY, shapeProblems } from './shape.js';
import { fitScheme } from './landmarks.js';
import { schemeOn } from './per-type.js';
import { colorOf, UNPAINTED_FUSELAGE } from './colors.js';
import { stubPylonPaint } from './paint.js';
import { drawFinPicture, drawSide, drawWingletPicture, wingletCrop } from './side.js';
import { drawEngineTexture, drawFuselageTexture } from './texture.js';
export { isMeasuredShape, measuredShapeProblems } from './measured.js';
export { schemeOn } from './per-type.js';
export { NARROWBODY, REGIONAL, SHAPES, WIDEBODY, shapeNamed, shapeProblems } from './shape.js';
export { belowLabelCount };
export { colorOf, NEUTRAL, PROPELLER, spinnerPaint, UNPAINTED_FUSELAGE } from './colors.js';
const layouts = new WeakMap();
/** A shape laid out once and reused: drawing a list of schemes on one shape doesn't redo the arithmetic. */
function geometryFor(shape) {
    let geometry = layouts.get(shape);
    if (!geometry) {
        const problems = isMeasuredShape(shape) ? measuredShapeProblems(shape) : shapeProblems(shape);
        if (problems.length)
            throw new Error(`Shape ${isMeasuredShape(shape) ? shape.id : shape.name}: ${problems.join('; ')}`);
        geometry = isMeasuredShape(shape) ? layoutMeasured(shape) : layout(shape);
        layouts.set(shape, geometry);
    }
    return geometry;
}
/** The scheme as drawn on `shape`: fitted from the shape it was measured on, then its paint for that type laid over. */
function paintedOn(scheme, shape, drawnOn) {
    const fitted = drawnOn && drawnOn !== shape ? fitScheme(scheme, geometryFor(drawnOn), geometryFor(shape)) : scheme;
    return schemeOn(fitted, shape);
}
/**
 * The scheme from one side, as an SVG document: nose left for the left side, nose right for the right. On a measured
 * shape the scheme's paint for that type (its `types`) is laid over its own, here and in every view and texture.
 */
export function renderSide(scheme, options = {}) {
    const { shape = NARROWBODY, side = 'left', logo, idPrefix, drawnOn } = options;
    return drawSide(paintedOn(scheme, shape, drawnOn), side, geometryFor(shape), { logo, idPrefix }).toString();
}
/** The scheme from below, nose left: the aircraft's left side is the top half. */
export function renderBelow(scheme, options = {}) {
    const { shape = NARROWBODY, logo, idPrefix, drawnOn } = options;
    return drawBelow(paintedOn(scheme, shape, drawnOn), geometryFor(shape), { logo, idPrefix }).toString();
}
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
export function renderTexture(scheme, part, options = {}) {
    const { shape = NARROWBODY, side = 'left', logo, idPrefix, drawnOn } = options;
    const painted = paintedOn(scheme, shape, drawnOn);
    const geometry = geometryFor(shape);
    if (part === 'engine') {
        // One texture for every engine: the first under the wing's cowl (a rear-engined type's on its stub alike).
        const cowlEnd = geometry.engines.find((e) => e.cowlEnd !== undefined)?.cowlEnd;
        return drawEngineTexture(painted, { logo, idPrefix }, cowlEnd).toString();
    }
    const drawn = part === 'fuselage'
        ? drawFuselageTexture(painted, geometry, { logo, idPrefix })
        : part === 'winglet'
            ? drawWingletPicture(painted, side, geometry, { logo, idPrefix })
            : drawFinPicture(painted, side, geometry, { logo, idPrefix });
    return drawn.toString();
}
export function sideProjection(shape = NARROWBODY) {
    const geometry = geometryFor(shape);
    const width = VIEW_WIDTH;
    return {
        width,
        height: geometry.sideHeight,
        uv: (meters, height) => [
            geometry.fuselageX(geometry.share(meters)) / width,
            1 - (geometry.centerY - height * geometry.scale) / geometry.sideHeight,
        ],
    };
}
/**
 * Where a winglet's texture (`renderTexture(scheme, 'winglet', { shape, side })`) lies in `sideProjection`'s u and v
 * (u0, v0, u1, v1, seen from the left): a 3D winglet's face maps its projected points into it. None without one.
 */
export function wingletBox(shape = NARROWBODY) {
    const geometry = geometryFor(shape);
    const crop = wingletCrop(geometry, 'left');
    if (!crop)
        return undefined;
    const [x, y, w, h] = crop;
    return [x / VIEW_WIDTH, 1 - (y + h) / geometry.sideHeight, (x + w) / VIEW_WIDTH, 1 - y / geometry.sideHeight];
}
/**
 * The fuselage's outline as the renderer draws it: at fuselage x (0 nose to 1 tail), the crown's and the belly's
 * heights above the centerline in meters. A 3D fuselage built on it lines up with the pictures.
 */
export function fuselageProfile(shape = NARROWBODY) {
    return geometryFor(shape).profile;
}
/**
 * A rear-mounted engine's stub pylon color (a measured shape's `engines[i].pylon`, `engine` its index inboard
 * first), seen from one side: the scheme's `engines.pylon`, else the fuselage's paint where the pylon meets it.
 * Undefined for an engine without one.
 */
export function stubPylonColor(scheme, shape, engine, side = 'left') {
    const found = geometryFor(shape).engines[engine];
    if (!found?.stubPylon)
        return undefined;
    const painted = schemeOn(scheme, shape);
    return colorOf(painted, stubPylonPaint(painted, side, found), UNPAINTED_FUSELAGE);
}
