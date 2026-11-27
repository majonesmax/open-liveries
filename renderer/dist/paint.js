// A part's paint through any mapping of its own space, shared by the side view (side.ts), the below view and the
// textures (texture.ts): areas, the fuselage's paint and glass and doors, and where lettering stays on the paint.
import { COCKPIT_FRAME, COCKPIT_GLASS, UNPAINTED_FUSELAGE, WINDOW_GLASS } from './colors.js';
import { doorShape, fromHeight, inside, rect, toHeight, WINDOW_BAND } from './geometry.js';
import { areaPolygon, densify, densifyArea, showsOn } from './svg.js';
/** Paints a part's areas, in order, mapped through its own coordinates. */
export function drawAreas(areas, side, yRange, mapping, canvas, parent, 
/** Moves the area's own points before they're drawn (a tail engine's: the fin's space carried down, side.ts). */
adjust = (p) => p, 
/** The part's lowest and highest y, where an area's outline stays sharp (default: `yRange`). */
edges = yRange, 
/** The fuselage: edges straight as seen from the side, not in y (an angle round it). */
heights = false) {
    for (const area of areas ?? []) {
        if (!showsOn(area, side))
            continue;
        const outline = areaPolygon(area, ...yRange, edges, heights).map((p) => adjust(p, area));
        // A curve's own points are close already; a straight outline gets points along every edge, as always.
        const dense = area.smooth === true ? densifyArea(outline) : densify(outline);
        const polygon = dense.map(([x, y]) => mapping(x, heights ? fromHeight(y) : y));
        canvas.polygon(polygon, canvas.color(area.color), parent);
    }
}
/** The fuselage's paint at (x, y), as the scheme names it: its last area there, else its base. */
function bodyPaint(livery, side, x, y) {
    const fuselage = livery.fuselage;
    let color = fuselage?.base ?? UNPAINTED_FUSELAGE;
    const probe = [x, toHeight(y)];
    for (const area of fuselage?.areas ?? []) {
        if (!showsOn(area, side))
            continue;
        if (inside(probe, areaPolygon(area, -1, 1, [-1, 1], true)))
            color = area.color;
    }
    return color;
}
/** The fuselage's paint at (x, y): its last area there, else its base. */
function bodyColor(livery, side, canvas, x, y) {
    return canvas.color(bodyPaint(livery, side, x, y));
}
/**
 * A rear-mounted engine's stub pylon, as the scheme names its paint: `engines.pylon`, else the fuselage's paint where
 * it meets the fuselage (it's faired into the body: QantasLink's red tail runs onto it).
 */
export function stubPylonPaint(livery, side, engine) {
    const root = engine.stubPylon?.root;
    return livery.engines?.pylon ?? (root ? bodyPaint(livery, side, root[0], root[1]) : undefined);
}
/** Where the paint changes along a line of fuselage y from x `from` to `to`: each run's start and colour. */
export function runs(livery, side, canvas, y, from, to, step) {
    const out = [];
    for (let x = from; x <= to; x += step) {
        const color = bodyColor(livery, side, canvas, x, y);
        if (out.at(-1)?.color !== color)
            out.push({ x, color });
    }
    return out;
}
/**
 * Polished metal's reflections, as photos of it show them from the side: the sky's light along the upper side, a
 * darker line of the horizon just below the middle, the ground's dull light on the belly. White or black over the
 * base by `y` (positive lighter), in bands following the body; paint over it stays solid. The side view only: a
 * texture is lit by its 3D view instead.
 */
const POLISH = [
    [-1, 0.16],
    [-0.7, 0.06],
    [-0.45, -0.14],
    [-0.25, -0.3],
    [-0.08, -0.08],
    [0.1, 0.16],
    [0.35, 0.55],
    [0.55, 0.4],
    [0.8, 0.08],
    [1, -0.06],
];
/** Bands to a unit of y, so the reflections shade smoothly. */
const POLISH_BANDS = 20;
export function polish(canvas, mapping, group) {
    const at = (y) => {
        const i = POLISH.findIndex(([py]) => py >= y);
        if (i <= 0)
            return POLISH[0]?.[1] ?? 0;
        const [y0, v0] = POLISH[i - 1] ?? [y, 0];
        const [y1, v1] = POLISH[i] ?? [y, 0];
        return v0 + ((v1 - v0) * (y - y0)) / (y1 - y0);
    };
    const n = POLISH_BANDS * 2;
    for (let k = 0; k < n; k++) {
        const y0 = -1 + (2 * k) / n;
        const y1 = y0 + 2 / n;
        const v = at((y0 + y1) / 2);
        if (Math.abs(v) < 0.01)
            continue;
        canvas.polygon(densify(rect(-0.01, y0, 1.01, y1)).map(([x, y]) => mapping(x, y)), v > 0 ? '#FFFFFF' : '#000000', group, { 'fill-opacity': Math.round(Math.abs(v) * 100) / 100 });
    }
}
/**
 * The fuselage's paint over its base: areas, radome, and the paint round the glass (a cockpit mask, a dark window
 * band), through any mapping of fuselage space: the side view's, or a texture's.
 */
export function paintFuselage(livery, side, canvas, geometry, mapping, group) {
    const { cabin, cockpit } = geometry.shape;
    const fuselage = livery.fuselage ?? { base: UNPAINTED_FUSELAGE };
    const paint = (region, color, attributes = {}) => {
        canvas.polygon(densify(region).map(([x, y]) => mapping(x, y)), color, group, attributes);
    };
    drawAreas(fuselage.areas, side, [-1, 1], mapping, canvas, group, undefined, undefined, true);
    if (fuselage.radome) {
        const to = fuselage.radome.to ?? 0.025;
        paint(rect(0, -1, to, 1), canvas.color(fuselage.radome.color));
    }
    const panes = geometry.measured?.glass.cockpit;
    if (fuselage.cockpitWindows?.mask && panes?.length) {
        // On a measured type, round the panes themselves, shaped as they're seen: their outline grown by a margin,
        // straight along the top and bottom, following the glass round the nose, the aft end slightly rounded. The
        // generic box below is placed for the built-in shapes' nose only.
        const seen = panes.flat().map(([x, y]) => mapping(x, y));
        // A metre along the fuselage, in the picture; the mask reaches 0.15 m round the glass.
        const [ax] = mapping(0, 0);
        const [bx] = mapping(geometry.share(1), 0);
        canvas.polygon(maskAround(seen, Math.abs(bx - ax) * 0.15), canvas.color(fuselage.cockpitWindows.mask), group);
    }
    else if (fuselage.cockpitWindows?.mask && !geometry.measured?.hump?.glass.cockpit.length) {
        // The mask reaches about half a meter round the glass.
        const x0 = geometry.share(cockpit.from - 0.5);
        const x1 = geometry.share(cockpit.to + 0.55);
        const mask = [
            [x0, 0.12],
            [x1, 0.12],
            [x1, 0.52],
            [x0 + 0.1 * (x1 - x0), 0.56],
        ];
        paint(mask, canvas.color(fuselage.cockpitWindows.mask));
    }
    if (fuselage.windows === 'lined') {
        paint(rect(geometry.share(cabin.from - 0.2), 0.04, geometry.share(cabin.to + 0.4), 0.21), WINDOW_GLASS, {
            opacity: 0.85,
        });
    }
}
/** A cockpit mask round the panes, in the picture: their convex outline (straight between panes) grown by `m`. */
export function maskAround(points, m) {
    const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const chain = (list) => {
        const out = [];
        for (const p of list) {
            while (out.length >= 2 && cross(out[out.length - 2] ?? p, out[out.length - 1] ?? p, p) <= 0)
                out.pop();
            out.push(p);
        }
        return out.slice(0, -1);
    };
    const hull = [...chain(sorted), ...chain([...sorted].reverse())];
    // Each edge pushed out by m, corners rounded: a few points round each vertex between its edges' normals.
    const out = [];
    hull.forEach((p, i) => {
        const prev = hull[(i - 1 + hull.length) % hull.length] ?? p;
        const next = hull[(i + 1) % hull.length] ?? p;
        const normal = (a, b) => Math.atan2(-(b[0] - a[0]), b[1] - a[1]);
        const a0 = normal(prev, p);
        let a1 = normal(p, next);
        while (a1 < a0)
            a1 += 2 * Math.PI;
        if (a1 - a0 > Math.PI)
            a1 -= 2 * Math.PI;
        for (let k = 0; k <= 4; k++) {
            const a = a0 + ((a1 - a0) * k) / 4;
            out.push([p[0] + m * Math.cos(a), p[1] + m * Math.sin(a)]);
        }
    });
    return out;
}
/** How far ahead of the paint's end (a share of the part's x) lettering and logos stop. */
export const PAINT_MARGIN = 0.03;
/**
 * A title on a part whose paint ends short of its end (an engine's fan cowl: its core behind is bare metal) kept on
 * the paint: made smaller from its start, kept about its middle up the part, until it ends `PAINT_MARGIN` short of
 * `end`, to 40% of its size. Southwest's "Southwest.com", measured to 80% of a 737's nacelle, stays on the cowl of a
 * nacelle whose cowl is shorter.
 */
export function onThePaint(title, end) {
    const run = title.length;
    if (!run)
        return title;
    const room = end - PAINT_MARGIN - title.at[0];
    if (title.at[0] + run <= end - PAINT_MARGIN)
        return title;
    const k = Math.max(room / run, 0.4);
    return {
        ...title,
        length: run * k,
        height: title.height * k,
        at: [title.at[0], title.at[1] + (title.height * (1 - k)) / 2],
    };
}
/** A main door's height on a built-in shape, from its sill to its top, as shares of the fuselage's radius. */
const DOOR_SILL = -0.27;
const DOOR_TOP = 0.7;
/** Door outlines: a seam a little darker than whatever paint it crosses (black, part-transparent), this wide. */
const DOOR_LINE_M = 0.035;
const DOOR_LINE_OPACITY = 0.3;
const CARGO_LINE_OPACITY = 0.16;
/** A door's seam (`kind` its kind) as stroke attributes, at `perMetre` pixels to a meter. */
export function doorSeam(kind, perMetre) {
    return {
        stroke: '#000',
        'stroke-opacity': kind === 'cargo' ? CARGO_LINE_OPACITY : DOOR_LINE_OPACITY,
        'stroke-width': Math.round(DOOR_LINE_M * perMetre * 100) / 100,
        'stroke-linejoin': 'round',
    };
}
/**
 * The doors, over the paint and the windows: each one's outline as a thin dark seam, and a main door's small
 * window. Where they are comes from the shape (a measured type's doors exactly; a built-in shape's door gaps at a
 * standard height), never the scheme. A door on one side only (a cargo door on the right) is drawn on that side.
 */
export function paintDoors(canvas, geometry, side, mapping, group) {
    const radius = geometry.shape.fuselage.radius;
    const toFuselage = ([m, z]) => [geometry.share(m), fromHeight(z / radius)];
    const doors = geometry.measured?.doors ??
        geometry.shape.cabin.doors.map(([from, to]) => doorShape('door', [from, to], [DOOR_SILL * radius, DOOR_TOP * radius], toFuselage));
    const [ax, ay] = mapping(0, 0);
    const [bx, by] = mapping(geometry.share(1), 0);
    const perMetre = Math.hypot(bx - ax, by - ay);
    for (const door of doors) {
        if (door.side && door.side !== side)
            continue;
        canvas.polygon(densify(door.outline, true, 2).map(([x, y]) => mapping(x, y)), 'none', group, doorSeam(door.kind, perMetre));
        if (door.window)
            canvas.polygon(door.window.map(([x, y]) => mapping(x, y)), WINDOW_GLASS, group);
    }
}
/**
 * A built-in shape's windshield, wrapping round the nose: the front pane reaching forward of the cockpit's start, its
 * top edge dropping toward the nose, then the side panes, each behind a thin frame post. Each pane's corners are
 * (share of the cockpit's length from its start, fuselage y), and flagged where they're just aft of a post.
 */
const WINDSHIELD = [
    [
        [-0.35, 0.27],
        [0.3, 0.22],
        [0.3, 0.45],
        [-0.2, 0.38],
    ],
    [
        [0.3, 0.22, true],
        [0.66, 0.22],
        [0.66, 0.46],
        [0.3, 0.45, true],
    ],
    [
        [0.66, 0.22, true],
        [1, 0.22],
        [1, 0.4],
        [0.66, 0.46, true],
    ],
];
/** The windshield's frame posts' width, in meters. */
const WINDSHIELD_POST = 0.08;
/** The cabin and cockpit windows, through any mapping of fuselage space. */
export function paintGlass(livery, canvas, geometry, mapping, group) {
    const { cabin, cockpit } = geometry.shape;
    const glass = geometry.measured?.glass;
    if (glass) {
        // Each window and pane where the drawing has it.
        if (livery.fuselage?.windows !== 'hidden') {
            for (const pane of glass.cabin)
                canvas.polygon(pane.map(([x, y]) => mapping(x, y)), WINDOW_GLASS, group);
        }
        for (const pane of glass.cockpit) {
            canvas.polygon(densify(pane).map(([x, y]) => mapping(x, y)), COCKPIT_GLASS, group, COCKPIT_FRAME);
        }
        return;
    }
    if (livery.fuselage?.windows !== 'hidden') {
        // A run of cabin windows, with gaps for the doors. A pane is about 0.22 m wide.
        const pane = geometry.share(0.22);
        for (let m = cabin.from; m < cabin.to; m += cabin.pitch) {
            if (cabin.doors.some(([from, to]) => m > from && m < to))
                continue;
            const x = geometry.share(m);
            canvas.polygon(rect(x, WINDOW_BAND[0], x + pane, WINDOW_BAND[1]).map(([px, py]) => mapping(px, py)), WINDOW_GLASS, group);
        }
    }
    const width = cockpit.to - cockpit.from;
    const at = (share) => geometry.share(cockpit.from + share * width);
    const post = geometry.share(WINDSHIELD_POST);
    const panes = WINDSHIELD.map((pane) => pane.map(([along, y, afterPost]) => [at(along) + (afterPost ? post : 0), y]));
    for (const pane of panes) {
        canvas.polygon(densify(pane).map(([x, y]) => mapping(x, y)), COCKPIT_GLASS, group, COCKPIT_FRAME);
    }
}
