// Fix-ups for titles and logos fitted from one type to another (landmarks.ts): what was clear of the wing, the paint,
// another title or the fin's edges where the scheme was measured stays clear of it on the type it's drawn on, moved
// or made smaller as little as it takes (docs/COORDINATES.md, Landmarks).
import { clamp, deckAt, fromHeight, fuselageRadiusAt, inside, toHeight } from './geometry.js';
import { ADVANCE_PER_EM, CAP_HEIGHT_PER_EM } from './labels.js';
/** Points over a title's box (its run and cap height) in fuselage space: along its foot, middle and top. */
export function titleBox(t) {
    const [x, y] = t.at;
    const run = t.length ?? 0;
    const out = [];
    for (let i = 0; i <= 8; i++)
        for (const k of [0, 0.5, 1])
            out.push([x + (run * i) / 8, y + t.height * k]);
    return out;
}
/**
 * The wing's outline from the side (its near half, in front of the body) in fuselage space: where a title would run
 * into it. Both layouts draw the side view linearly, so its pixels map straight back.
 */
export function wingOnBody(g) {
    const x0 = g.fuselageX(0);
    const span = g.fuselageX(1) - x0 || 1;
    return g.wingSide.map(([px, py]) => {
        const x = (px - x0) / span;
        const { crown, belly } = g.profile(x);
        const r = (crown - belly) / 2 || 1;
        const z = (g.centerY - py) / g.scale;
        // On the body, its fuselage y; past the crown or the belly, carried on straight (the outline still closes).
        const v = (z - (crown + belly) / 2) / r;
        return [x, Math.abs(v) <= 1 ? fromHeight(v) : Math.sign(v) * clamp(Math.abs(v), 1, 1.5)];
    });
}
/**
 * A title clear of the wing where it was measured stays clear of it (Asiana's, under the windows on its A321neo, on a
 * 747's or an A380's longer wing root): moved forward until it clears, not past the cockpit's end, then made
 * smaller about its start if that isn't enough, to half its size.
 */
export function clearOfTheWing(measured, fitted, from, to) {
    const wingFrom = wingOnBody(from);
    const wingTo = wingOnBody(to);
    const hits = (wing, t) => titleBox(t).some((p) => inside(p, wing));
    const cockpitEnd = clamp(to.share(to.shape.cockpit.to), 0, 1);
    return fitted.map((f, i) => {
        const t = measured[i];
        if (t?.place !== 'fuselage' || !t.length || t.rotationDeg || hits(wingFrom, t) || !hits(wingTo, f))
            return f;
        for (let dx = 0.005; f.at[0] - dx >= cockpitEnd; dx += 0.005) {
            const c = { ...f, at: [f.at[0] - dx, f.at[1]] };
            if (!hits(wingTo, c))
                return c;
        }
        const start = Math.max(cockpitEnd, Math.min(f.at[0], cockpitEnd + 0.01));
        for (let k = 0.98; k >= 0.5; k -= 0.02) {
            const c = { ...f, height: f.height * k, length: (f.length ?? 0) * k };
            c.at = [start, f.at[1] + (f.height * (1 - k)) / 2];
            if (!hits(wingTo, c))
                return c;
        }
        return f;
    });
}
/**
 * The topmost area (seen from the left) under all of `points`, by index, if one is: where a title sits on one painted
 * area. An area drawn by `below` or `above` a line isn't counted.
 */
export function areaUnder(areas, points) {
    for (let i = areas.length - 1; i >= 0; i--) {
        const a = areas[i];
        if (!a?.points || a.side === 'right')
            continue;
        const poly = a.points;
        const over = points.map((p) => inside(p, poly));
        if (over.every(Boolean))
            return i;
        if (over.some(Boolean))
            return undefined;
    }
    return undefined;
}
/**
 * A title on one painted area where it was measured stays on it (Sun Country's white name on its orange): where the
 * fitted body has it running off the area, it's made smaller about the start of its foot until it fits, down to half
 * its size; one that crosses areas on purpose is left as it is.
 */
export function onTheirAreas(scheme, fitted, areas) {
    const measured = scheme.fuselage?.areas ?? [];
    return fitted.map((f, i) => {
        const t = scheme.titles?.[i];
        if (t?.place !== 'fuselage' || !t.length || t.rotationDeg)
            return f;
        const under = areaUnder(measured, titleBox(t));
        if (under === undefined)
            return f;
        const fits = (c) => titleBox(c).every((p) => areaUnder(areas, [p]) === under);
        if (fits(f))
            return f;
        for (let k = 0.98; k >= 0.5; k -= 0.02) {
            const c = { ...f, height: f.height * k, length: (f.length ?? 0) * k };
            // Kept about its middle up the side, so it stays in the band it was in.
            c.at = [f.at[0], f.at[1] + (f.height * (1 - k)) / 2];
            if (fits(c))
                return c;
        }
        return f;
    });
}
/**
 * Titles fitted one by one can run into each other where they grew (Qantas' name and "Spirit of Australia" on an
 * A380): a fuselage title that followed another on its row, with a gap, keeps that gap (in meters, grown with the
 * body as the titles are), moved aft if it has to.
 */
export function spaced(measured, fitted, from, to) {
    const out = [...fitted];
    const along = (t) => [t.at[0], t.at[0] + (t.length ?? 0)];
    const overlapUp = (a, b) => a.at[1] < b.at[1] + b.height && b.at[1] < a.at[1] + a.height;
    const order = measured
        .flatMap((t, i) => (t.place === 'fuselage' && t.length && !t.rotationDeg ? [i] : []))
        .sort((i, j) => (measured[i]?.at[0] ?? 0) - (measured[j]?.at[0] ?? 0));
    for (let k = 1; k < order.length; k++) {
        const [i, j] = [order[k - 1] ?? 0, order[k] ?? 0];
        const [a, b, fa, fb] = [measured[i], measured[j], out[i], out[j]];
        if (!a || !b || !fa || !fb || !overlapUp(a, b) || !overlapUp(fa, fb))
            continue;
        const gap = along(b)[0] - along(a)[1];
        if (gap < 0)
            continue;
        const grown = (fuselageRadiusAt(to, fa.at[0]) / (fuselageRadiusAt(from, a.at[0]) || 1)) * gap * from.shape.fuselage.length;
        const start = along(fa)[1] + grown / to.shape.fuselage.length;
        if (fb.at[0] < start)
            out[j] = { ...fb, at: [start, fb.at[1]] };
    }
    return out;
}
/** Columns across the body this far apart, each with the heights painted there. */
const COLUMN = 0.0025;
/**
 * The fuselage's paint (areas seen from the left, drawn by `points`) as the stretches of y painted in each column
 * across it: each area's outline crossed by the column's line, its stretches between alternate crossings (even-odd,
 * as it's filled). Made once for a set of areas.
 */
const paintColumns = new WeakMap();
function columns(areas) {
    const known = paintColumns.get(areas);
    if (known)
        return known;
    const n = Math.round(1 / COLUMN);
    const out = Array.from({ length: n + 1 }, () => []);
    for (const a of areas) {
        if (!a.points || a.side === 'right')
            continue;
        const poly = a.points;
        const crossings = Array.from({ length: n + 1 }, () => []);
        poly.forEach((p, i) => {
            const q = poly[(i + 1) % poly.length] ?? p;
            const [[x0, y0], [x1, y1]] = [p, q];
            if (x0 === x1)
                return;
            const [lo, hi] = [Math.min(x0, x1), Math.max(x0, x1)];
            for (let c = Math.max(0, Math.ceil(lo / COLUMN)); c <= Math.min(n, Math.floor(hi / COLUMN)); c++) {
                const x = c * COLUMN;
                // Half-open at the right end, so a vertex shared by two edges is crossed once.
                if (x === hi)
                    continue;
                crossings[c]?.push(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0));
            }
        });
        crossings.forEach((ys, c) => {
            ys.sort((u, v) => u - v);
            for (let k = 0; k + 1 < ys.length; k += 2)
                out[c]?.push([ys[k] ?? 0, ys[k + 1] ?? 0]);
        });
    }
    paintColumns.set(areas, out);
    return out;
}
/**
 * How far a fuselage title is from the paint below and above it, in meters up the side, the least along its run (0
 * where it's on some); Infinity where there's none.
 */
function clearances(g, t, areas) {
    const painted = columns(areas);
    let [below, above] = [Infinity, Infinity];
    const run = t.length ?? 0;
    const [foot, top] = [t.at[1], t.at[1] + t.height];
    for (let i = 0; i <= 8; i++) {
        const x = t.at[0] + (run * i) / 8;
        const column = x < 0 || x > 1 ? undefined : painted[Math.round(x / COLUMN)];
        if (!column?.length)
            continue;
        const r = fuselageRadiusAt(g, x);
        let [under, over] = [-Infinity, Infinity];
        for (const [lo, hi] of column) {
            if (lo <= foot)
                under = Math.max(under, Math.min(hi, foot));
            if (hi >= top)
                over = Math.min(over, Math.max(lo, top));
        }
        if (under > -Infinity)
            below = Math.min(below, r * (toHeight(foot) - toHeight(under)));
        if (over < Infinity)
            above = Math.min(above, r * (toHeight(over) - toHeight(top)));
    }
    return [below, above];
}
/** How far a fuselage title is from the paint, in meters up the side (docs/COORDINATES.md, Landmarks). */
export function paintClearance(g, t, areas) {
    return Math.min(...clearances(g, t, areas));
}
/**
 * A title on the bare body where it was measured stays off the paint, with at least half its gap to it (in meters,
 * grown with the body): moved away from the nearer paint, up to just under an upper deck's windows (or short of the
 * crown) or down short of the belly, then made smaller about its middle if that isn't enough, to half its size
 * (American's red name, above the tri-color's stripes on the 737, stays off the blue's top edge on an A380).
 */
export function offThePaint(scheme, fitted, areas, from, to) {
    const measured = scheme.fuselage?.areas ?? [];
    const grown = to.shape.fuselage.radius / (from.shape.fuselage.radius || 1);
    return fitted.map((f, i) => {
        const t = scheme.titles?.[i];
        if (t?.place !== 'fuselage' || !t.length || t.rotationDeg || !measured.length)
            return f;
        const gap = paintClearance(from, t, measured);
        if (gap === 0 || gap === Infinity)
            return f;
        const need = gap * grown * 0.5;
        const clear = (c) => paintClearance(to, c, areas) >= need;
        if (clear(f))
            return f;
        const [below, above] = clearances(to, f, areas);
        const step = below <= above ? 0.005 : -0.005;
        const deck = deckAt(to, [f.at[0], f.at[0] + (f.length ?? 0)]);
        const ceiling = deck ? deck[0] - 0.01 : 0.9;
        for (let k = 1; k >= 0.5; k -= 0.02) {
            const c = { ...f, height: f.height * k, length: (f.length ?? 0) * k };
            const middle = f.at[1] + (f.height * (1 - k)) / 2;
            for (let y = middle; y + c.height <= ceiling && y >= -0.9; y += step) {
                c.at = [f.at[0], y];
                if (clear(c))
                    return c;
            }
        }
        return f;
    });
}
/** A fin's point (its x a share of the chord at each height, y root → tip) in meters: aft, and up. */
function finMeters(g, fx, fy) {
    const [px, py] = g.finPoint(fx, fy);
    return [(px - g.fuselageX(0)) / g.scale, (g.centerY - py) / g.scale];
}
/** The fin's span in meters. */
const finSpanMeters = (g) => g.finSpan / g.scale;
/**
 * What a fin title or logo covers, in meters on `g`: a title's box (its run along its turn, its cap height across;
 * a run not given, estimated from its letters), a logo's disc (its width isn't known here).
 */
function onTheFin(g, item) {
    const [ax, ay] = finMeters(g, item.at[0], item.at[1]);
    const height = item.height * finSpanMeters(g);
    if (!('text' in item))
        return { points: [[ax, ay]], radius: height / 2 };
    const [leading, trailing] = g.finChord(item.at[1]);
    const run = item.length
        ? item.length * (trailing - leading) * (g.fuselageLength / g.scale)
        : (item.text.length * ADVANCE_PER_EM * height) / CAP_HEIGHT_PER_EM;
    const turn = ((item.rotationDeg ?? 0) * Math.PI) / 180;
    const [dx, dy] = [Math.cos(turn), Math.sin(turn)];
    const points = [];
    for (let i = 0; i <= 8; i++)
        for (const k of [0, 0.5, 1]) {
            const along = (run * i) / 8;
            points.push([ax + dx * along - dy * height * k, ay + dy * along + dx * height * k]);
        }
    return { points, radius: 0 };
}
/**
 * How far a fin title or logo is from the fin's leading edge, trailing edge and tip, in meters (negative where it's
 * past one); its foot may sit on the root, which the body covers.
 */
export function finClearance(g, item) {
    const { outline, closed, rootZ, tailplane } = finOutline(g);
    const { points, radius } = onTheFin(g, item);
    let least = Infinity;
    for (const p of points) {
        const inFin = inside(p, closed) || p[1] < rootZ;
        least = Math.min(least, (inFin ? distance(p, outline) : -distance(p, outline)) - radius);
        // The tailplane is drawn across the fin from the side (a T-tail's, over its top): an edge too.
        const under = inside(p, tailplane);
        least = Math.min(least, (under ? -distance(p, tailplane) : distance(p, tailplane)) - radius);
    }
    return least;
}
const finOutlines = new WeakMap();
function finOutline(g) {
    const known = finOutlines.get(g);
    if (known)
        return known;
    const steps = 24;
    const le = [];
    const te = [];
    const tip = [];
    for (let k = 0; k <= steps; k++) {
        le.push(finMeters(g, 0, k / steps));
        te.push(finMeters(g, 1, k / steps));
        tip.push(finMeters(g, k / steps, 1));
    }
    const outline = [...le, ...tip, ...[...te].reverse()];
    // Inside: between the edges and under the tip; below the root counts as inside (the body covers it).
    const side = g.stabilizerSide.map(([px, py]) => [
        (px - g.fuselageX(0)) / g.scale,
        (g.centerY - py) / g.scale,
    ]);
    const made = {
        outline,
        closed: [...outline, ...(le[0] ? [le[0]] : [])],
        rootZ: le[0]?.[1] ?? 0,
        tailplane: [...side, ...(side[0] ? [side[0]] : [])],
    };
    finOutlines.set(g, made);
    return made;
}
/** A point's distance from a polyline. */
function distance(p, line) {
    let best = Infinity;
    for (let i = 1; i < line.length; i++) {
        const [a, b] = [line[i - 1] ?? p, line[i] ?? p];
        const [vx, vy] = [b[0] - a[0], b[1] - a[1]];
        const t = clamp(((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1), 0, 1);
        best = Math.min(best, Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t));
    }
    return best;
}
/** Of the clearance from the fin's edges a title or logo had where it was measured (grown with the fin), the least kept. */
const FIN_CLEARANCE_KEPT = 0.75;
/**
 * The moves tried to clear a fin's edges, in the fin's own space: up to `reach` along its chord (x) and up its span
 * (y) either way, in steps of `step`; the nearest first.
 */
const FIN_MOVES = { reach: [0.3, 0.2], step: [0.03, 0.04] };
/**
 * A fin title or logo keeps clear of the fin's edges (and of a T-tail's tailplane across its top) as it was where measured (in meters, grown with the fin): a fin
 * swept or proportioned otherwise puts the same shares nearer an edge (Spirit's diagonal name, clear on its A320,
 * would crowd a 747's leading edge). Moved the least it takes, then made smaller (and moved) if that isn't enough, to
 * 30% of its size (a 727's fin, under its T-tail, is half an A320's height; Southwest's long diagonal name needs
 * that).
 */
export function clearOnTheFin(measuredItem, from, to) {
    const measured = finClearance(from, measuredItem);
    if (measured <= 0)
        return measuredItem;
    // Lettering that reaches down past the fin's root over a tail engine's fairing where it was measured (TWA's on
    // the 727) has nothing under it on a fin without one: it's lifted to stand on the root, then kept clear as below.
    const lifted = measuredItem.at[1] < 0 && from.measured?.tailEngines?.length && !to.measured?.tailEngines?.length;
    const item = lifted ? { ...measuredItem, at: [measuredItem.at[0], 0] } : measuredItem;
    const need = measured * FIN_CLEARANCE_KEPT * (finSpanMeters(to) / (finSpanMeters(from) || 1));
    if (finClearance(to, item) >= need)
        return item;
    const moves = [];
    const [reachX, reachY] = FIN_MOVES.reach;
    const [stepX, stepY] = FIN_MOVES.step;
    // A little past each reach, so float steps still land on it.
    for (let dx = -reachX; dx <= reachX + 1e-4; dx += stepX)
        for (let dy = -reachY; dy <= reachY + 1e-4; dy += stepY)
            moves.push([dx, dy]);
    moves.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
    for (let k = 1; k >= 0.3 - 1e-9; k -= 0.1) {
        for (const [dx, dy] of moves) {
            // Not moved down onto the body: no lower than the fin's root, or where it was.
            if (item.at[1] + dy < Math.min(item.at[1], 0))
                continue;
            const scaled = { ...item, height: item.height * k };
            if ('text' in scaled && scaled.length)
                scaled.length *= k;
            scaled.at = [item.at[0] + dx, item.at[1] + dy];
            if (finClearance(to, scaled) >= need)
                return scaled;
        }
    }
    return item;
}
