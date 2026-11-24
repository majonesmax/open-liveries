// Where each part's coordinates (docs/COORDINATES.md) land on a shape, in SVG pixels. The side view is the left
// side, nose on the left; the below view has the nose on the left too, so the aircraft's left side is its top
// half. The fuselage always spans the same width; everything else is to the shape's scale.
export const VIEW_WIDTH = 1000;
export const NOSE_X = 50;
export const FUSELAGE_PIXELS = 900;
export const MARGIN = 14;
/** A parametric shape's cabin windows: their bottom and top in fuselage y. */
export const WINDOW_BAND = [0.05, 0.2];
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpPoint = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
/**
 * Round the fuselage, y is an angle and a side view draws it at height sin(y·90°) (COORDINATES.md): `toHeight` is
 * that height as a share of the radius, `fromHeight` turns one back to y.
 */
export const toHeight = (y) => Math.sin((clamp(y, -1, 1) * Math.PI) / 2);
export const fromHeight = (h) => (Math.asin(clamp(h, -1, 1)) * 2) / Math.PI;
/** A rectangle in a part's own coordinates. */
export const rect = (x0, y0, x1, y1) => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
];
/** Whether a point is inside a polygon (even-odd); an area's corner flags are ignored. */
export function inside([px, py], poly) {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i] ?? [0, 0];
        const [xj, yj] = poly[j] ?? [0, 0];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
            hit = !hit;
    }
    return hit;
}
/** A quarter ellipse from 0 to 1: the nose's and tail's rounding. */
const ellipseRise = (t) => Math.sqrt(1 - (1 - clamp(t, 0, 1)) ** 2);
const smoothstep = (t) => {
    const c = clamp(t, 0, 1);
    return c * c * (3 - 2 * c);
};
const tan = (deg) => Math.tan((deg * Math.PI) / 180);
export const HALVES = ['left', 'right'];
/** +1 for the bottom half of the below view, −1 for the top. */
export const halfSign = (half) => (half === 'left' ? -1 : 1);
/**
 * A door's outline from its edges (metres back, metres up), its corners rounded by `round` metres, each point turned
 * into fuselage space by `toFuselage`. A main door gets its small window, high and centred.
 */
export function doorShape(kind, [x0, x1], [z0, z1], toFuselage) {
    const r = Math.min(0.12, (x1 - x0) / 4, (z1 - z0) / 4);
    const corner = (cx, cz, from) => [0, 1, 2, 3].map((k) => {
        const a = ((from + (k * 90) / 3) * Math.PI) / 180;
        return [cx + r * Math.cos(a), cz + r * Math.sin(a)];
    });
    const outline = [
        ...corner(x1 - r, z0 + r, 270),
        ...corner(x1 - r, z1 - r, 0),
        ...corner(x0 + r, z1 - r, 90),
        ...corner(x0 + r, z0 + r, 180),
    ].map(toFuselage);
    if (kind !== 'door')
        return { kind, outline };
    const cx = (x0 + x1) / 2;
    const top = z0 + (z1 - z0) * 0.78;
    const window = [
        [cx - 0.1, top - 0.24],
        [cx + 0.1, top - 0.24],
        [cx + 0.1, top],
        [cx - 0.1, top],
    ].map(toFuselage);
    return { kind, outline, window };
}
/** The fuselage's half height at fuselage x, in meters. */
export const fuselageRadiusAt = (g, x) => (g.profile(x).crown - g.profile(x).belly) / 2;
/** The upper deck's window band, if it runs over any of fuselage x0 to x1 (the A380's whole length, a 747's front). */
export function deckAt(g, [x0, x1]) {
    const deck = g.windows.upper;
    return deck && x1 >= deck.along[0] && x0 <= deck.along[1] ? deck.band : undefined;
}
export function layout(shape) {
    const { fuselage, fin, wing, stabilizer } = shape;
    const L = fuselage.length;
    const scale = FUSELAGE_PIXELS / L;
    const radius = fuselage.radius * scale;
    const share = (meters) => meters / L;
    const fuselageX = (x) => NOSE_X + x * FUSELAGE_PIXELS;
    const px = (meters) => NOSE_X + meters * scale;
    // Heights in the side view, measured up from the centerline in meters, decide the picture's height.
    const wingTipZ = wing.height + wing.span * tan(wing.dihedralDeg);
    const finTipZ = fuselage.radius + fin.height;
    const top = Math.max(finTipZ, wingTipZ + (shape.winglet?.height ?? 0), fuselage.radius) * scale;
    const lowest = Math.min(...shape.engines.map((e) => e.height - e.radius), -fuselage.radius) * scale;
    const centerY = MARGIN + top;
    const sideHeight = Math.ceil(centerY - lowest + MARGIN);
    const y = (meters) => centerY - meters * scale;
    const { nose, tail } = fuselage;
    const noseTipY = centerY - nose.tip * radius;
    const crownFull = share(nose.crown);
    const bellyFull = share(nose.belly);
    const crownFrom = share(tail.crownFrom);
    const bellyFrom = share(tail.bellyFrom);
    const crownY = (x) => {
        const c = clamp(x, 0, 1);
        if (c < crownFull)
            return lerp(noseTipY, centerY - radius, ellipseRise(c / crownFull));
        if (c > crownFrom)
            return lerp(centerY - radius, centerY - tail.crownEnd * radius, ((c - crownFrom) / (1 - crownFrom)) ** 2);
        return centerY - radius;
    };
    const bellyY = (x) => {
        const c = clamp(x, 0, 1);
        if (c < bellyFull)
            return lerp(noseTipY, centerY + radius, ellipseRise(c / bellyFull));
        if (c > bellyFrom) {
            const t = (c - bellyFrom) / (1 - bellyFrom);
            return lerp(centerY + radius, centerY - tail.bellyEnd * radius, smoothstep(t) * 0.6 + t * 0.4);
        }
        return centerY + radius;
    };
    const radiusAt = (x) => (bellyY(x) - crownY(x)) / 2;
    /** A point at y is drawn r·sin(y·90°) from the centerline. */
    const fuselagePoint = (x, yy) => {
        const crown = crownY(x);
        const belly = bellyY(x);
        const r = (belly - crown) / 2;
        return [fuselageX(x), (crown + belly) / 2 - r * toHeight(yy)];
    };
    const finSpan = fin.height * scale;
    const finTipY = centerY - radius - finSpan;
    const finChord = (fy) => [
        lerp(share(fin.rootLeading), share(fin.tipLeading), fy),
        lerp(share(fin.rootTrailing), share(fin.tipTrailing), fy),
    ];
    /** x is a share of the chord at each height, so the space is sheared. */
    const finPoint = (fx, fy) => {
        const [leading, trailing] = finChord(fy);
        const x = lerp(leading, trailing, fx);
        const rootY = crownY(x);
        return [fuselageX(x), rootY + (finTipY - rootY) * fy];
    };
    const wingZAt = (lateral) => wing.height + lateral * tan(wing.dihedralDeg);
    /** The leading edge at a lateral in meters, from the fuselage side to the tip. */
    const wingLeadingAt = (lateral) => lerp(wing.rootLeading, wing.tipLeading, clamp((lateral - fuselage.radius) / (wing.span - fuselage.radius), 0, 1));
    // Inboard first, so an outboard engine (nearer, in the side view) is drawn over it.
    const engines = [...shape.engines]
        .sort((a, b) => a.out - b.out)
        .map((e) => ({
        x0: px(e.front),
        x1: px(e.back),
        centerY: y(e.height),
        halfHeight: e.radius * scale,
        lateral: e.out * scale,
        underWing: e.out > fuselage.radius && e.height < wingZAt(e.out),
        wingY: y(wingZAt(e.out)),
        wingLeadingX: px(wingLeadingAt(e.out)),
    }));
    /** The nacelle narrows over its last 30%. */
    const enginePoint = (engine, nx, ny) => {
        const halfHeight = engine.halfHeight * (nx < 0.7 ? 1 : 1 - (0.3 * (nx - 0.7)) / 0.3);
        return [lerp(engine.x0, engine.x1, nx), engine.centerY - clamp(ny, -1.2, 1.2) * halfHeight];
    };
    // The near wing and tailplane, nearly edge on: thin slivers from root to tip, the tip raised by the dihedral.
    const thickness = 0.1 * radius;
    const wingSide = [
        [px(wing.rootLeading), y(wing.height)],
        [px(wing.rootTrailing), y(wing.height) + thickness],
        [px(wing.tipTrailing), y(wingTipZ) + thickness],
        [px(wing.tipLeading), y(wingTipZ)],
    ];
    const stabilizerTipZ = stabilizer.height + stabilizer.span * tan(stabilizer.dihedralDeg);
    const stabilizerSide = [
        [px(stabilizer.rootLeading), y(stabilizer.height)],
        [px(stabilizer.tipLeading), y(stabilizerTipZ)],
        [px(stabilizer.tipTrailing), y(stabilizerTipZ) + thickness],
        [px(stabilizer.rootTrailing), y(stabilizer.height) + thickness],
    ];
    let winglet;
    if (shape.winglet) {
        const w = shape.winglet;
        const rootLE = [px(wing.tipLeading), y(wingTipZ)];
        const rootTE = [px(wing.tipTrailing), y(wingTipZ) + thickness];
        const tipLE = [px(wing.tipLeading + w.sweep), y(wingTipZ + w.height)];
        const tipTE = [px(wing.tipLeading + w.sweep + w.tipChord), y(wingTipZ + w.height) + thickness * 0.2];
        winglet = {
            height: w.height * scale,
            chord: (wing.tipTrailing - wing.tipLeading) * scale,
            /** x leading → trailing edge, y root → tip. */
            point: (x, yy) => lerpPoint(lerpPoint(rootLE, tipLE, yy), lerpPoint(rootTE, tipTE, yy), x),
        };
    }
    // The below view.
    const lateralMax = Math.max(wing.span, stabilizer.span, fuselage.radius, ...shape.engines.map((e) => e.out + e.radius));
    const belowCenterY = MARGIN + lateralMax * scale;
    const belowHeight = Math.ceil(2 * belowCenterY);
    /** Fuselage space on the belly (y from −1 the centerline up to 0). */
    const bellyPoint = (x, yy, half) => {
        const offset = radiusAt(clamp(x, 0, 1)) * Math.sin(((clamp(yy, -1, 0) + 1) * Math.PI) / 2);
        return [fuselageX(x), belowCenterY + halfSign(half) * offset];
    };
    const wingRoot = radius * 0.95;
    const wingUnderSpan = wing.span * scale;
    /** Wing space (x leading → trailing edge, y root → tip) on the underside. */
    const wingUnderPoint = (x, yy, half) => {
        const leading = lerp(px(wing.rootLeading), px(wing.tipLeading), yy);
        const trailing = lerp(px(wing.rootTrailing), px(wing.tipTrailing), yy);
        const lateral = wingRoot + yy * (wingUnderSpan - wingRoot);
        return [lerp(leading, trailing, x), belowCenterY + halfSign(half) * lateral];
    };
    const tailplaneBelow = (half) => {
        const s = halfSign(half);
        const root = radiusAt(share(stabilizer.rootLeading)) * 0.9;
        return [
            [px(stabilizer.rootLeading), belowCenterY + s * root],
            [px(stabilizer.tipLeading), belowCenterY + s * stabilizer.span * scale],
            [px(stabilizer.tipTrailing), belowCenterY + s * stabilizer.span * scale],
            [px(stabilizer.rootTrailing), belowCenterY + s * root * 0.6],
        ];
    };
    return {
        shape,
        // Where the views draw a parametric shape's windows (paint.ts, paintGlass).
        windows: { main: [WINDOW_BAND[0], WINDOW_BAND[1]] },
        sideHeight,
        belowHeight,
        scale,
        radius,
        fuselageLength: FUSELAGE_PIXELS,
        centerY,
        belowCenterY,
        fuselageX,
        share,
        fuselagePoint,
        profile: (x) => ({ crown: (centerY - crownY(x)) / scale, belly: (centerY - bellyY(x)) / scale }),
        finChord,
        finSpan,
        finPoint,
        engines,
        enginePoint,
        wingSide,
        fairingsSide: [],
        stabilizerSide,
        ...(winglet ? { winglet } : {}),
        bellyPoint,
        wingUnderPoint,
        wingUnderSpan,
        tailplaneBelow,
    };
}
