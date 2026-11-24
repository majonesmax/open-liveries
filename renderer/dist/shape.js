// What the renderer paints a scheme onto: an aircraft described by a handful of measurements in meters. A scheme
// places everything as shares of each part (docs/COORDINATES.md), so any shape takes any scheme. Positions along
// the aircraft are meters back from the nose; heights are meters up from the fuselage's centerline (negative is
// below it); lateral distances are meters out from the centerline.
/** About a 737-800 or A320: the shape the viewer has always drawn. */
export const NARROWBODY = {
    name: 'narrowbody',
    fuselage: {
        length: 39.5,
        radius: 2.0,
        nose: { crown: 5.5, belly: 3.2, tip: -0.2 },
        tail: { crownFrom: 33.2, crownEnd: 0.72, bellyFrom: 27.6, bellyEnd: 0.42 },
    },
    cabin: {
        from: 4.5,
        to: 31.6,
        pitch: 0.49,
        doors: [
            [4.55, 5.1],
            [31.85, 32.6],
        ],
    },
    cockpit: { from: 2.3, to: 3.6 },
    fin: { rootLeading: 31.6, rootTrailing: 38.9, tipLeading: 36.9, tipTrailing: 40.3, height: 4.9 },
    stabilizer: {
        rootLeading: 34.2,
        rootTrailing: 39.1,
        tipLeading: 37.1,
        tipTrailing: 39.5,
        span: 7.2,
        height: 0.25,
        dihedralDeg: 4,
    },
    wing: {
        rootLeading: 14.6,
        rootTrailing: 20.9,
        tipLeading: 23.7,
        tipTrailing: 26.3,
        span: 17.9,
        height: -1.1,
        dihedralDeg: 3,
    },
    winglet: { height: 2.2, sweep: 1.4, tipChord: 0.6 },
    engines: [{ front: 11.6, back: 17.0, radius: 0.83, height: -2.7, out: 4.9 }],
};
/** About a 787-9 or A350-900: a longer, fatter fuselage, raked wingtips, big engines. */
export const WIDEBODY = {
    name: 'widebody',
    fuselage: {
        length: 62.8,
        radius: 2.9,
        nose: { crown: 8.0, belly: 4.6, tip: -0.2 },
        tail: { crownFrom: 52.5, crownEnd: 0.7, bellyFrom: 45.0, bellyEnd: 0.4 },
    },
    cabin: {
        from: 6.6,
        to: 52.0,
        pitch: 0.62,
        doors: [
            [6.6, 7.7],
            [17.5, 18.6],
            [34.0, 35.1],
            [48.5, 49.6],
        ],
    },
    cockpit: { from: 3.4, to: 5.3 },
    fin: { rootLeading: 50.5, rootTrailing: 61.6, tipLeading: 58.6, tipTrailing: 63.8, height: 9.6 },
    stabilizer: {
        rootLeading: 54.6,
        rootTrailing: 62.0,
        tipLeading: 60.4,
        tipTrailing: 63.4,
        span: 10.0,
        height: 0.4,
        dihedralDeg: 5,
    },
    wing: {
        rootLeading: 22.6,
        rootTrailing: 33.2,
        tipLeading: 38.4,
        tipTrailing: 40.6,
        span: 30.0,
        height: -1.7,
        dihedralDeg: 3,
    },
    engines: [{ front: 19.2, back: 26.6, radius: 1.65, height: -3.9, out: 9.8 }],
};
/** About an E175 or CRJ900 (a wing-engined one): short, slim, a tall fin. */
export const REGIONAL = {
    name: 'regional',
    fuselage: {
        length: 31.7,
        radius: 1.5,
        nose: { crown: 4.3, belly: 2.5, tip: -0.2 },
        tail: { crownFrom: 26.5, crownEnd: 0.72, bellyFrom: 22.0, bellyEnd: 0.42 },
    },
    cabin: {
        from: 3.8,
        to: 25.4,
        pitch: 0.5,
        doors: [
            [3.8, 4.6],
            [25.6, 26.35],
        ],
    },
    cockpit: { from: 1.8, to: 2.9 },
    fin: { rootLeading: 24.6, rootTrailing: 30.6, tipLeading: 29.4, tipTrailing: 32.6, height: 5.6 },
    stabilizer: {
        rootLeading: 27.4,
        rootTrailing: 31.2,
        tipLeading: 30.4,
        tipTrailing: 32.2,
        span: 5.2,
        height: 0.3,
        dihedralDeg: 4,
    },
    wing: {
        rootLeading: 11.6,
        rootTrailing: 16.8,
        tipLeading: 19.4,
        tipTrailing: 21.0,
        span: 13.0,
        height: -0.85,
        dihedralDeg: 3,
    },
    winglet: { height: 1.6, sweep: 1.0, tipChord: 0.45 },
    engines: [{ front: 10.0, back: 13.8, radius: 0.7, height: -2.05, out: 3.6 }],
};
/** The shapes that come with the renderer, by name. */
export const SHAPES = {
    narrowbody: NARROWBODY,
    widebody: WIDEBODY,
    regional: REGIONAL,
};
/** A built-in shape by name (from a URL or a setting, say), or undefined if there's none by that name. */
export function shapeNamed(name) {
    return Object.hasOwn(SHAPES, name) ? SHAPES[name] : undefined;
}
/** Every number a shape must have, by its path. */
const REQUIRED = [
    'fuselage.length',
    'fuselage.radius',
    'fuselage.nose.crown',
    'fuselage.nose.belly',
    'fuselage.nose.tip',
    'fuselage.tail.crownFrom',
    'fuselage.tail.crownEnd',
    'fuselage.tail.bellyFrom',
    'fuselage.tail.bellyEnd',
    'cabin.from',
    'cabin.to',
    'cabin.pitch',
    'cockpit.from',
    'cockpit.to',
    ...['fin', 'stabilizer', 'wing'].flatMap((part) => ['rootLeading', 'rootTrailing', 'tipLeading', 'tipTrailing'].map((key) => `${part}.${key}`)),
    'fin.height',
    'stabilizer.span',
    'stabilizer.height',
    'stabilizer.dihedralDeg',
    'wing.span',
    'wing.height',
    'wing.dihedralDeg',
];
/** The value at a dotted path in parsed JSON, if every step on the way is an object. */
function valueAt(value, path) {
    return path
        .split('.')
        .reduce((v, key) => (typeof v === 'object' && v !== null ? v[key] : undefined), value);
}
/** What's missing from a shape read from JSON: numbers it must have, and its engines and doors. */
function missing(shape) {
    const problems = REQUIRED.filter((path) => typeof valueAt(shape, path) !== 'number').map((path) => `${path} must be a number`);
    const engines = valueAt(shape, 'engines');
    const engineKeys = ['front', 'back', 'radius', 'height', 'out'];
    if (!Array.isArray(engines))
        problems.push('engines must be a list');
    else
        engines.forEach((engine, i) => {
            for (const key of engineKeys) {
                if (typeof valueAt(engine, key) !== 'number')
                    problems.push(`engines[${i}].${key} must be a number`);
            }
        });
    if (!Array.isArray(valueAt(shape, 'cabin.doors')))
        problems.push('cabin.doors must be a list (it can be empty)');
    const winglet = valueAt(shape, 'winglet');
    if (winglet !== undefined) {
        for (const key of ['height', 'sweep', 'tipChord']) {
            if (typeof valueAt(winglet, key) !== 'number')
                problems.push(`winglet.${key} must be a number`);
        }
    }
    return problems;
}
/**
 * What's wrong with a shape (an empty list if nothing): enough to catch a typo in a hand-written one. Takes
 * anything, so a shape straight from JSON can be checked before it's used.
 */
export function shapeProblems(input) {
    const absent = missing(input);
    if (absent.length)
        return absent;
    const shape = input;
    const problems = [];
    const { fuselage, fin, wing, stabilizer, cabin, cockpit } = shape;
    const L = fuselage.length;
    const check = (ok, message) => {
        if (!ok)
            problems.push(message);
    };
    const positive = (value, name) => {
        check(Number.isFinite(value) && value > 0, `${name} must be a positive number of meters`);
    };
    const chords = (c, name) => {
        check(c.rootLeading < c.rootTrailing, `${name}: rootLeading must be ahead of rootTrailing`);
        check(c.tipLeading < c.tipTrailing, `${name}: tipLeading must be ahead of tipTrailing`);
    };
    positive(L, 'fuselage.length');
    positive(fuselage.radius, 'fuselage.radius');
    check(fuselage.radius < L / 4, 'fuselage.radius looks too big for its length');
    check(fuselage.nose.crown > 0 && fuselage.nose.crown < L / 2, 'fuselage.nose.crown must be in the front half');
    check(fuselage.nose.belly > 0 && fuselage.nose.belly < L / 2, 'fuselage.nose.belly must be in the front half');
    check(fuselage.tail.crownFrom > L / 2 && fuselage.tail.crownFrom < L, 'fuselage.tail.crownFrom: in the back half');
    check(fuselage.tail.bellyFrom > L / 2 && fuselage.tail.bellyFrom < L, 'fuselage.tail.bellyFrom: in the back half');
    check(fuselage.tail.bellyEnd < fuselage.tail.crownEnd, 'fuselage.tail: bellyEnd must be below crownEnd');
    check(cabin.from < cabin.to && cabin.to <= L, 'cabin: from must be ahead of to, within the fuselage');
    positive(cabin.pitch, 'cabin.pitch');
    check(cockpit.from < cockpit.to, 'cockpit: from must be ahead of to');
    chords(fin, 'fin');
    positive(fin.height, 'fin.height');
    chords(wing, 'wing');
    positive(wing.span, 'wing.span');
    chords(stabilizer, 'stabilizer');
    positive(stabilizer.span, 'stabilizer.span');
    check(shape.engines.length > 0, 'engines: at least one');
    shape.engines.forEach((e, i) => {
        check(e.front < e.back, `engines[${i}]: front must be ahead of back`);
        positive(e.radius, `engines[${i}].radius`);
    });
    return problems;
}
