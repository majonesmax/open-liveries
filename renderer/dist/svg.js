// SVG building blocks, as text so they work anywhere (a browser, Node, a build step): elements, polygons, clip
// paths and colors, and turning a scheme's areas into polygons.
import { colorOf, MISSING_COLOR } from './colors.js';
import { lerp, toHeight, VIEW_WIDTH } from './geometry.js';
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escape = (value) => value.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);
/** An element being built: its attributes, children, and text. `raw` is markup inserted as is (a logo). */
export class Element {
    name;
    attributes;
    children = [];
    textContent = '';
    constructor(name, attributes) {
        this.name = name;
        this.attributes = attributes;
    }
    appendRaw(markup) {
        this.children.push({ raw: markup });
    }
    toString() {
        const attributes = Object.entries(this.attributes)
            .filter((entry) => entry[1] !== undefined)
            .map(([key, value]) => ` ${key}="${escape(String(value))}"`)
            .join('');
        const inner = this.children.map((c) => (c instanceof Element ? c.toString() : c.raw)).join('');
        const content = inner + escape(this.textContent);
        return content ? `<${this.name}${attributes}>${content}</${this.name}>` : `<${this.name}${attributes}/>`;
    }
}
export function svgElement(name, attributes = {}, parent) {
    const element = new Element(name, attributes);
    parent?.children.push(element);
    return element;
}
/** Rounds to a tenth of a pixel, which keeps the markup short. */
export const round1 = (n) => Math.round(n * 10) / 10;
const pointsAttribute = (points) => points.map(([x, y]) => `${round1(x)},${round1(y)}`).join(' ');
/** Points along an edge so none is more than `EDGE_STEP` of its part apart. */
const EDGE_STEP = 0.003;
const edgeSteps = (a, b) => Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / EDGE_STEP);
/**
 * Adds points along each edge, so a straight edge in a part's space stays on the part when mapped onto a
 * curved surface (the fuselage's sides, the sheared fin). An open polyline keeps its last point.
 */
export function densify(polygon, closed = true, steps = 12) {
    const out = [];
    const addEdge = (a, b) => {
        // At least `steps`, and more on a long edge: a share of a part maps onto a curve (the nose's crown), and a long
        // edge (mid-fuselage to the nose) needs points all along it to follow the curve rather than cut across it.
        const n = Math.max(steps, edgeSteps(a, b));
        for (let s = 0; s < n; s++)
            out.push([lerp(a[0], b[0], s / n), lerp(a[1], b[1], s / n)]);
    };
    let previous;
    for (const point of polygon) {
        if (previous)
            addEdge(previous, point);
        previous = point;
    }
    const first = polygon[0];
    if (closed && first && previous)
        addEdge(previous, first);
    else if (previous)
        out.push(previous);
    return out;
}
/** A line's first and last x. */
const xSpan = (line) => [line[0]?.[0] ?? 0, line.at(-1)?.[0] ?? 0];
/** The y of a line (points in ascending x) at x, held level beyond its ends. */
function lineYAt(line, x) {
    let previous;
    for (const [x1, y1] of line) {
        if (x <= x1) {
            if (!previous)
                return y1;
            const [x0, y0] = previous;
            return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
        }
        previous = [x1, y1];
    }
    return previous?.[1] ?? 0;
}
/** Points along each curved stretch of an area's outline, between two of its points. */
const CURVE_STEPS = 8;
/**
 * A centripetal Catmull-Rom curve through p1 to p2, with p0 and p3 its neighbours: `CURVE_STEPS` points from p1
 * (p2 itself left for the next stretch). Centripetal keeps it from looping or overshooting at uneven spacing.
 */
function curveStretch(p0, p1, p2, p3) {
    const gap = (a, b) => Math.max(Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])), 1e-6);
    const t1 = gap(p0, p1);
    const t2 = t1 + gap(p1, p2);
    const t3 = t2 + gap(p2, p3);
    const mix = (a, b, ta, tb, t) => {
        const w = (t - ta) / (tb - ta);
        return [lerp(a[0], b[0], w), lerp(a[1], b[1], w)];
    };
    const out = [];
    for (let i = 0; i < CURVE_STEPS; i++) {
        const t = lerp(t1, t2, i / CURVE_STEPS);
        const a1 = mix(p0, p1, 0, t1, t);
        const a2 = mix(p1, p2, t1, t2, t);
        const a3 = mix(p2, p3, t2, t3, t);
        out.push(mix(mix(a1, a2, 0, t2, t), mix(a2, a3, t1, t3, t), t1, t2, t));
    }
    return out;
}
/** A curve through a run of points, sharp at both ends: each end's missing neighbour is mirrored. */
function curveThrough(run) {
    const out = [];
    for (let i = 0; i + 1 < run.length; i++) {
        const p1 = run[i];
        const p2 = run[i + 1];
        if (!p1 || !p2)
            continue;
        const p0 = run[i - 1] ?? [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
        const p3 = run[i + 2] ?? [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
        out.push(...(run.length === 2 ? [p1] : curveStretch(p0, p1, p2, p3)));
    }
    const last = run.at(-1);
    if (last)
        out.push(last);
    return out;
}
/**
 * Whether a point of an area's outline is a corner: flagged ([x, y, 1]), or on or past the part's edge (x 0 or 1,
 * y at `edges`), where paint meets the outline.
 */
function isCorner(p, edges) {
    const e = 1e-6;
    return p[2] === 1 || p[0] <= e || p[0] >= 1 - e || p[1] <= edges[0] + e || p[1] >= edges[1] - e;
}
/** A closed outline as a smooth curve through its points, sharp at its corners (docs/COORDINATES.md). */
function smoothClosed(points, edges) {
    const xy = points.map((p) => [p[0], p[1]]);
    const corners = points.flatMap((p, i) => (isCorner(p, edges) ? [i] : []));
    if (points.length < 3)
        return xy;
    if (!corners.length) {
        // No corner: one curve all the way round.
        const n = xy.length;
        const at = (i) => xy[((i % n) + n) % n] ?? [0, 0];
        return xy.flatMap((_, i) => curveStretch(at(i - 1), at(i), at(i + 1), at(i + 2)));
    }
    // From corner to corner: a curve through the points between, each stretch ending on the next corner.
    const start = corners[0] ?? 0;
    const first = xy[start];
    const firstPoint = points[start];
    if (!first || !firstPoint)
        return xy;
    const ring = [...xy.slice(start), ...xy.slice(0, start), first];
    const flags = [...points.slice(start), ...points.slice(0, start), firstPoint].map((p) => isCorner(p, edges));
    const out = [];
    let from = 0;
    for (let i = 1; i < ring.length; i++) {
        if (!flags[i])
            continue;
        out.push(...curveThrough(ring.slice(from, i + 1)).slice(0, -1));
        from = i;
    }
    return out;
}
/** An open line as a smooth curve through its points: its ends and corners sharp. */
function smoothLine(line, edges) {
    const xy = line.map((p) => [p[0], p[1]]);
    const out = [];
    let from = 0;
    for (let i = 1; i < line.length; i++) {
        const p = line[i];
        if (i < line.length - 1 && p && !isCorner(p, edges))
            continue;
        out.push(...curveThrough(xy.slice(from, i + 1)).slice(0, -1));
        from = i;
    }
    const last = xy.at(-1);
    if (last)
        out.push(last);
    return out;
}
const inHeights = (points) => points?.map((p) => (p[2] === 1 ? [p[0], toHeight(p[1]), 1] : [p[0], toHeight(p[1])]));
/**
 * An area as a polygon in its part's space. A line paints only over its own x-range: `below` paints down to
 * yMin, `above` up to yMax, and with both the band between them (`below` its upper edge, `above` its lower).
 * With `smooth: true` its outline is a smooth curve through its points, sharp at its corners and where it meets
 * the part's edges (`edges`: the part's lowest and highest y, by default yMin and yMax); otherwise straight.
 *
 * `heights` (the fuselage): its areas' edges run straight (or curve) as seen from the side, so the outline is shaped
 * in side-view heights (`toHeight`) and returned in them too; densify it, then turn each point back with `fromHeight`.
 */
export function areaPolygon(area, yMin, yMax, edges = [yMin, yMax], heights = false) {
    if (heights) {
        const shaped = { ...area };
        const points = inHeights(area.points);
        const below = inHeights(area.below);
        const above = inHeights(area.above);
        if (points)
            shaped.points = points;
        if (below)
            shaped.below = below;
        if (above)
            shaped.above = above;
        return areaPolygon(shaped, toHeight(yMin), toHeight(yMax), [toHeight(edges[0]), toHeight(edges[1])]);
    }
    const straight = area.smooth !== true;
    const line = (l) => straight ? l.map((p) => [p[0], p[1]]) : smoothLine(l, edges);
    if (area.points)
        return straight ? area.points.map((p) => [p[0], p[1]]) : smoothClosed(area.points, edges);
    const below = area.below && line(area.below);
    const above = area.above && line(area.above);
    if (below && above)
        return band(below, above);
    if (below) {
        const [start, end] = xSpan(below);
        return [...below, [end, yMin], [start, yMin]];
    }
    if (above) {
        const [start, end] = xSpan(above);
        return [...above, [end, yMax], [start, yMax]];
    }
    return [];
}
/**
 * An area's polygon with points added along its long edges only (a straight edge in a part's space stays on a
 * curved part), up to `densify`'s 12 per edge: the curves' own points are close already.
 */
export function densifyArea(polygon) {
    const out = [];
    polygon.forEach((a, i) => {
        const b = polygon[(i + 1) % polygon.length] ?? a;
        const steps = Math.max(1, Math.min(Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.02), 12), edgeSteps(a, b));
        for (let s = 0; s < steps; s++)
            out.push([lerp(a[0], b[0], s / steps), lerp(a[1], b[1], s / steps)]);
    });
    return out;
}
/** The band between two lines, over the x-range they share. */
function band(upper, lower) {
    const [upperStart, upperEnd] = xSpan(upper);
    const [lowerStart, lowerEnd] = xSpan(lower);
    const x0 = Math.max(upperStart, lowerStart);
    const x1 = Math.min(upperEnd, lowerEnd);
    const xs = [
        ...new Set([...upper, ...lower]
            .map((p) => p[0])
            .filter((x) => x >= x0 && x <= x1)
            .concat([x0, x1])),
    ].sort((p, q) => p - q);
    return [
        ...xs.map((x) => [x, lineYAt(upper, x)]),
        ...[...xs].reverse().map((x) => [x, lineYAt(lower, x)]),
    ];
}
/** Whether an area, title or logo appears on this side. */
export const showsOn = (item, side) => !item.side || item.side === 'both' || item.side === side;
/** Stands in for a drawing's id prefix until its markup is done; replaced by a hash of the markup (`Drawing`). */
const ID_MARK = '\u2063';
/**
 * A drawing's root: its clip-path ids are its prefix and a hash of its own markup, so the same drawing always gives
 * the same markup, and different drawings on one page don't share ids.
 */
class Drawing extends Element {
    prefix;
    constructor(attributes, prefix) {
        super('svg', attributes);
        this.prefix = prefix;
    }
    toString() {
        const markup = super.toString();
        return markup.includes(ID_MARK) ? markup.split(ID_MARK).join(`${this.prefix}${hash(markup)}-`) : markup;
    }
}
/** FNV-1a, in base 36: short and stable, not for security. */
function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++)
        h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(36);
}
export function createCanvas(livery, label, height, options) {
    const svg = new Drawing({
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: options.crop ? options.crop.join(' ') : `0 0 ${options.width ?? VIEW_WIDTH} ${height}`,
        role: 'img',
        'aria-label': label,
        class: 'ol-plane',
    }, options.idPrefix ?? 'ol');
    const defs = svgElement('defs', {}, svg);
    const color = (name, fallback = MISSING_COLOR) => colorOf(livery, name, fallback);
    const polygon = (points, fill, parent, attributes = {}) => svgElement('polygon', { points: pointsAttribute(points), fill, ...attributes }, parent);
    const clipTo = (name, outline) => {
        const id = ID_MARK + name;
        polygon(outline, '#000', svgElement('clipPath', { id }, defs));
        return `url(#${id})`;
    };
    let gradients = 0;
    const gradient = (stops, from, to) => {
        const id = `${ID_MARK}fade${gradients++}`;
        const element = svgElement('linearGradient', {
            id,
            gradientUnits: 'userSpaceOnUse',
            x1: round1(from[0]),
            y1: round1(from[1]),
            x2: round1(to[0]),
            y2: round1(to[1]),
        }, defs);
        for (const [offset, hex] of stops)
            svgElement('stop', { offset: Math.round(offset * 1000) / 1000, 'stop-color': hex }, element);
        return `url(#${id})`;
    };
    return { svg, color, polygon, clipTo, gradient, logoPainter: options.logo };
}
