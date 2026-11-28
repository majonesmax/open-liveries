// A scheme measured on one type, fitted to another by their landmarks (docs/COORDINATES.md, Landmarks): positions
// along the body go "this far between these two landmarks" rather than "this share of the length", and heights go
// by the window band, so paint follows the features it was placed by when a body's proportions differ.
import { clearOfTheWing, clearOnTheFin, offThePaint, onTheirAreas, spaced } from './fit-labels.js';
import { clamp, deckAt, fromHeight, fuselageRadiusAt, toHeight } from './geometry.js';
import { areaPolygon } from './svg.js';
function piecewise(knots, slope = 1) {
    return (v) => {
        const first = knots[0];
        const last = knots.at(-1);
        if (!first || !last)
            return v;
        if (v <= first[0])
            return first[1] + (v - first[0]) * slope;
        if (v >= last[0])
            return last[1] + (v - last[0]) * slope;
        for (let i = 1; i < knots.length; i++) {
            const [a0, b0] = knots[i - 1] ?? first;
            const [a1, b1] = knots[i] ?? last;
            if (v <= a1)
                return a1 === a0 ? b1 : b0 + ((b1 - b0) * (v - a0)) / (a1 - a0);
        }
        return v;
    };
}
/** Pairs kept only where both sides keep increasing (a landmark out of order on either type is left out). */
/** A landmark carried further than this share of the body to its match is the first to go when two disagree. */
const FAR = 0.2;
function increasing(pairs) {
    const out = [];
    for (const [a, b] of pairs) {
        const last = out.at(-1);
        if (!last || (a > last[0] + 1e-6 && b > last[1] + 1e-6))
            out.push([a, b]);
        // Two landmarks in a different order on the two types (a 747's first window under its upstairs cockpit, the
        // Convair 580's behind its propeller, 7.4 m back): where the one kept would carry a position more than FAR along
        // the body, the one that moves less stays instead, so the nose of one isn't carried to the other's mid-cabin.
        else if (Math.abs(last[1] - last[0]) > FAR && Math.abs(b - a) < Math.abs(last[1] - last[0])) {
            const before = out.at(-2);
            if (!before || (a > before[0] + 1e-6 && b > before[1] + 1e-6))
                out[out.length - 1] = [a, b];
        }
    }
    return out;
}
/** A flight deck this many of the cabin's radii above the main deck's windows is on another deck. */
const UPSTAIRS = 0.4;
/**
 * The body's landmarks as fuselage x (0 nose → 1 tail): the cockpit's end, the first and last cabin window, the
 * wing's root edges and the fin's root leading edge, between the nose and the tail. One a shape doesn't have is
 * undefined: a windowless freighter has no first or last cabin window to fit by (for `paint`, it has where a
 * freighter's would be), and for `paint` a flight deck on another deck isn't the main deck's.
 */
function bodyLandmarks(g, paint = false) {
    const { cabin, cockpit, wing, fin } = g.shape;
    const windowed = !!g.windows.main;
    const at = (m) => clamp(g.share(m), 0, 1);
    // For paint, a flight deck well above the main deck's windows (a 747's, up on its hump; its main deck's windows run
    // on forward under it) isn't the main deck's: a stripe that starts at a 737's cockpit starts at a 747's nose, not
    // behind its upstairs cockpit. Lettering keeps it (Sun Country's name, just behind a 737's cockpit, stays just
    // behind a 747's rather than going to its nose).
    const { line, flightDeck } = g.windows;
    const upstairs = paint &&
        line !== undefined &&
        flightDeck !== undefined &&
        flightDeck - line[1] > UPSTAIRS * g.shape.fuselage.radius;
    return [
        0,
        upstairs ? undefined : at(cockpit.to),
        windowed ? at(cabin.from) : paint ? g.windows.wouldBe?.[0] : undefined,
        at(wing.rootLeading),
        at(wing.rootTrailing),
        windowed ? at(cabin.to) : paint ? g.windows.wouldBe?.[1] : undefined,
        at(fin.rootLeading),
        1,
    ];
}
/** Fuselage x on `from` to fuselage x on `to`, piecewise between the landmarks both have (for areas, `paint`). */
export function alongBody(from, to, paint = false) {
    const a = bodyLandmarks(from, paint);
    const b = bodyLandmarks(to, paint);
    const pairs = a
        .flatMap((x, i) => {
        const y = b[i];
        return x === undefined || y === undefined ? [] : [[x, y]];
    })
        .sort((p, q) => p[0] - q[0]);
    return piecewise(increasing(pairs));
}
/**
 * Fuselage y on `from` to fuselage y on `to`, by the main window band: the belly, the band's bottom and top, and the
 * crown. Without windows on one of them (a freighter) there's no band to fit by, and y stays as written. For
 * lettering and logos, `decks` (the upper deck's bands at the label on each, if any): what sits above the main
 * deck's windows under no upper deck goes between the decks under one, as the A380's titles do, and back.
 */
function upTheSide(from, to, decks = [undefined, undefined]) {
    const [a, b] = [from.windows.main, to.windows.main];
    if (!a || !b)
        return (y) => y;
    const pairs = [
        [-1, -1],
        [a[0], b[0]],
        [a[1], b[1]],
    ];
    const [fromDeck, toDeck] = decks;
    if (toDeck && !fromDeck)
        pairs.push([1, toDeck[0]]);
    else if (fromDeck && !toDeck)
        pairs.push([fromDeck[0], 1]);
    else if (fromDeck && toDeck)
        pairs.push([fromDeck[0], toDeck[0]], [fromDeck[1], toDeck[1]], [1, 1]);
    else
        pairs.push([1, 1]);
    return piecewise(increasing(pairs));
}
/**
 * Fuselage lettering between two decks' windows (an A380's) is centered in the gap and its half height at most this
 * share of the gap's: about 60% of it, as the A380s measured are lettered.
 */
const BETWEEN_DECKS = 0.31;
/** Lettering clear of the windows fills at most this share of its slot (between the windows and the crown or belly). */
const SLOT_FILL = 0.9;
/**
 * Lettering across the main deck's windows under a second deck runs up to just under the upper deck's windows from
 * below the main deck's, by this share of the height between the two (Emirates' A380 titles).
 */
const UNDER_MAIN_WINDOWS = 0.15;
/** Within this share of the cabin's radius of the windows, paint keeps its distance from them in meters. */
const NEAR_WINDOWS = 0.5;
/** The main deck's windows' bottom and top in meters (as `profile`'s) at fuselage x, if it has any. */
function windowsAt(g, x) {
    if (g.windows.heights)
        return g.windows.heights;
    if (g.windows.line)
        return g.windows.line;
    const band = g.windows.main;
    if (!band)
        return undefined;
    const { crown, belly } = g.profile(x);
    const [middle, r] = [(crown + belly) / 2, (crown - belly) / 2];
    return [middle + r * toHeight(band[0]), middle + r * toHeight(band[1])];
}
/**
 * Fuselage (x, y) on `from` to fuselage y on `to` (at `X(x)`), for paint: by the landmarks up the side where it is
 * along the body, in meters: the belly, the main deck's windows, the crown. Near the windows (within half the cabin's
 * radius of them) paint keeps its distance from them, grown with the body, so a stripe along them follows them where
 * the body tapers and stays the stripe it is, running into the nose as it did where it was drawn (American's tri-color
 * stays under the regional jets' windshields and a 747's flight deck); farther off it keeps its share of
 * the way to the belly or the crown (under a 747's hump, the hump's). On a type without windows (a freighter) its
 * window line counts, where its passenger version's windows are; paint drawn on one has no windows it was placed by,
 * and stays as written.
 */
function paintUpTheSide(from, to, X) {
    if (!from.windows.main || !windowsAt(to, 0.5))
        return (_x, y) => y;
    const grown = to.shape.fuselage.radius / (from.shape.fuselage.radius || 1);
    const near = NEAR_WINDOWS * from.shape.fuselage.radius;
    // Out from the windows, each landmark kept while both bodies still have room for it: where the crown comes down
    // inside the margin (a nose, a tail cone) a stripe keeps its meters and runs off the body, as drawn.
    const outward = (list, sign) => {
        const out = [];
        for (const k of list) {
            const last = out.at(-1);
            if (!last || (sign * (k[0] - last[0]) > 1e-6 && sign * (k[1] - last[1]) > 1e-6))
                out.push(k);
        }
        return out;
    };
    // At the very tip and tail the body is a point: what's written there stays. A point on the crown or the belly
    // stays on it where that's still beyond the windows (paint over the crown toward the tail stays over it); only
    // where it's come down past them (a nose's tip) does it keep its meters, so paint run off the nose on one type runs
    // off it on another rather than up its front.
    return (x, y) => {
        if (y < -1 || y > 1 || x <= 0 || x >= 1)
            return y;
        const toX = X(x);
        const [a, b] = [windowsAt(from, x), windowsAt(to, toX)];
        if (!a || !b)
            return y;
        const [p, q] = [from.profile(x), to.profile(toX)];
        if ((y === 1 && p.crown > a[1]) || (y === -1 && p.belly < a[0]))
            return y;
        const z = (p.crown + p.belly) / 2 + ((p.crown - p.belly) / 2) * toHeight(y);
        const down = outward([
            [a[0], b[0]],
            [a[0] - near, b[0] - near * grown],
            [p.belly, q.belly],
        ], -1);
        const up = outward([
            [a[1], b[1]],
            [a[1] + near, b[1] + near * grown],
            [p.crown, q.crown],
        ], 1);
        const fitted = piecewise([...down.reverse(), ...up], grown)(z);
        return fromHeight((fitted - (q.crown + q.belly) / 2) / ((q.crown - q.belly) / 2 || 1));
    };
}
/**
 * A label's span up the side (y0 to y1, fuselage y at fuselage x on `from`) on `to`: centered where the landmarks
 * put its middle, as tall in meters as on `from` scaled by the bodies' sizes there (a widebody's titles are bigger,
 * as the airlines letter them).
 */
function labelSpan(from, to, [fromAlong, toAlong], [y0, y1]) {
    const [x, toX] = [fromAlong[0], toAlong[0]];
    const [a, b] = [from.windows.main, to.windows.main];
    // Without windows on one of them there's no band to fit by: as written.
    if (!a || !b)
        return [y0, y1];
    const fromDeck = deckAt(from, fromAlong);
    const toDeck = deckAt(to, toAlong);
    const upper = toDeck && !fromDeck ? toDeck : undefined;
    const labelY = upTheSide(from, to, [fromDeck, toDeck]);
    const rFrom = fuselageRadiusAt(from, x) || 1;
    const rTo = fuselageRadiusAt(to, toX) || 1;
    // In sine space heights are straight: r·(sin y1 − sin y0) meters.
    let half = ((toHeight(y1) - toHeight(y0)) * rFrom * (rTo / rFrom)) / rTo / 2;
    let middle = toHeight(labelY(fromHeight((toHeight(y0) + toHeight(y1)) / 2)));
    // Clear of the windows as measured, it stays clear of them here: between the main deck's windows and the crown
    // (or the upper deck's windows) when it was above them, under them when it was under. One that crosses them on
    // purpose (glass through its letters) keeps that.
    const [a0, a1] = a;
    const [b0, b1] = b;
    const slot = y0 >= a1 - 0.01 ? [b1, upper?.[0] ?? 1] : y1 <= a0 + 0.01 ? [-1, b0] : undefined;
    if (slot && upper && slot[1] === upper[0]) {
        // Between the decks: centered in the gap, about 60% of its height.
        const [lo, hi] = [toHeight(b1), toHeight(upper[0])];
        half = Math.min(half, (hi - lo) * BETWEEN_DECKS);
        middle = (lo + hi) / 2;
    }
    else if (slot) {
        const [lo, hi] = [toHeight(slot[0] ?? -1), toHeight(slot[1] ?? 1)];
        half = Math.min(half, ((hi - lo) / 2) * SLOT_FILL);
        middle = clamp(middle, lo + half, hi - half);
    }
    else {
        // Across them: the band crosses its letters as far up as it did. Under a second deck the decks size it: from
        // a little under the main deck's windows up to just under the upper deck's, as Emirates' A380 titles are.
        const share = (toHeight((a0 + a1) / 2) - toHeight(y0)) / (toHeight(y1) - toHeight(y0) || 1);
        middle = toHeight((b0 + b1) / 2) - (share - 0.5) * 2 * half;
        if (upper) {
            const top = toHeight(upper[0]);
            const bottom = toHeight(b0) - UNDER_MAIN_WINDOWS * (top - toHeight(b0));
            half = Math.min(half, (top - bottom) / 2);
            middle = top - half;
        }
    }
    return [fromHeight(middle - half), fromHeight(middle + half)];
}
/**
 * The scheme with its fuselage's paint, lettering and logos (and the belly's positions along the body) fitted from
 * the type it was measured on (`from`) to `to`. Lettering and logos are placed by their middles, sized with the
 * body and kept clear of the windows where they were; each title keeps its proportions in meters, its length on `to`
 * following its height there. Fin, wings, engines and winglets are in
 * their own parts' spaces and stay as they are, except the fin's areas from a type whose fin stands on the body onto
 * one with a tail engine (`finToTheCrown`).
 */
export function fitScheme(scheme, from, to) {
    if (from === to)
        return scheme;
    const X = alongBody(from, to);
    const paintX = alongBody(from, to, true);
    const Y = paintUpTheSide(from, to, paintX);
    // Beyond the body (paint carried past the nose or the tail, under the belly or over the crown) stays as written.
    const point = ([x, y, corner]) => {
        const fitted = [x < 0 || x > 1 ? x : paintX(x), y < -1 || y > 1 ? y : Y(clamp(x, 0, 1), y)];
        return corner ? [...fitted, corner] : fitted;
    };
    const area = (a) => {
        const out = { ...a };
        for (const key of ['points', 'below', 'above']) {
            const line = a[key];
            if (line)
                out[key] = (a.smooth ? line : alongTheSide(line, key === 'points')).map(point);
        }
        // A fade's ends move with the paint.
        if (a.gradient)
            out.gradient = { ...a.gradient, from: point(a.gradient.from), to: point(a.gradient.to) };
        return out;
    };
    const logo = (l) => {
        if (l.place === 'belly')
            return { ...l, at: [X(l.at[0]), l.at[1]] };
        if (l.place !== 'fuselage')
            return l;
        const [x, y] = l.at;
        // Its run along the body, about as wide as it's tall on the measured type.
        const run = l.height * ((fuselageRadiusAt(from, x) / from.shape.fuselage.length) * 0.5);
        const along = [
            [x - run, x + run],
            [X(x - run), X(x + run)],
        ];
        const [bottom, top] = labelSpan(from, to, along, [y - l.height / 2, y + l.height / 2]);
        return { ...l, at: [X(x), (bottom + top) / 2], height: top - bottom };
    };
    const title = (t) => {
        if (t.place === 'belly')
            return { ...t, at: [X(t.at[0]), t.at[1]] };
        if (t.place !== 'fuselage')
            return t;
        const [x, y] = t.at;
        const end = x + (t.length ?? 0);
        const [bottom, top] = labelSpan(from, to, [
            [x, end],
            [X(x), X(end)],
        ], [y, y + t.height]);
        const at = [X(x), bottom];
        const height = top - bottom;
        if (!t.length)
            return { ...t, at, height };
        // Its length to its height in meters, as measured.
        const metersUp = (g, gx, a, b) => fuselageRadiusAt(g, gx) * (toHeight(b) - toHeight(a));
        const aspect = (t.length * from.shape.fuselage.length) / (metersUp(from, x, y, y + t.height) || 1);
        const length = (aspect * metersUp(to, at[0], bottom, top)) / to.shape.fuselage.length;
        return { ...t, at, height, length };
    };
    const fuselage = scheme.fuselage && {
        ...scheme.fuselage,
        ...(scheme.fuselage.areas ? { areas: scheme.fuselage.areas.map(area) } : {}),
        ...(scheme.fuselage.radome?.to !== undefined
            ? { radome: { ...scheme.fuselage.radome, to: X(scheme.fuselage.radome.to) } }
            : {}),
    };
    const fin = finToTheCrown(scheme.fin, from, to);
    return {
        ...scheme,
        ...(fuselage ? { fuselage } : {}),
        ...(fin ? { fin } : {}),
        ...(scheme.logos
            ? { logos: scheme.logos.map(logo).map((l) => (l.place === 'fin' ? clearOnTheFin(l, from, to) : l)) }
            : {}),
        ...(scheme.titles
            ? {
                titles: clearOfTheWing(scheme.titles, offThePaint(scheme, onTheirAreas(scheme, spaced(scheme.titles, scheme.titles.map(title), from, to), fuselage?.areas ?? []), fuselage?.areas ?? [], from, to), from, to).map((t) => (t.place === 'fin' ? clearOnTheFin(t, from, to) : t)),
            }
            : {}),
    };
}
/**
 * Fin areas fitted by `finToTheCrown`: a tail engine's fairing or nacelle draws them as they are, their foot already
 * carried down (side.ts), where it carries an area measured on a trijet down from the fin's root.
 */
export const carriedToTheCrown = new WeakSet();
/**
 * The fin's areas from a type whose fin stands on the body (a twin's: its root on the crown) onto one whose fin
 * stands on a center engine or its S-duct's fairing (the 727's, the DC-10's, the L-1011's). There the fin's root is
 * well up the tail seen from the side, so the twin's fin, root to tip, is laid over the trijet's from the crown under
 * its fin (`finFoot`) to the tip, stretched up the fin's space: a design covering the twin's fin covers the trijet's
 * whole tail, its fairing or nacelle too. Where an area reached the twin's root it runs on down (to y −2, as the
 * schemes measured on trijets write it), straight down the fin's space from where its edges met the root. Each area
 * is taken as drawn on the twin (its curve, or its line's paint down to the root) and given as points. Undefined
 * where nothing changes: between two twins, two trijets, or from a trijet to a twin.
 */
function finToTheCrown(fin, from, to) {
    const foot = to.measured?.finFoot;
    if (!fin?.areas || from.measured?.tailEngines?.length || foot === undefined || foot >= 0)
        return undefined;
    const up = (y) => 1 - (1 - y) * (1 - foot);
    const areas = fin.areas.map((a) => {
        // As side.ts draws the fin's areas: a line's paint down to y −0.2, sharp at the root and the tip.
        const drawn = areaPolygon(a, -0.2, 1.1, [0, 1]);
        const points = [];
        drawn.forEach(([x, y], i) => {
            if (y > 0)
                points.push([x, up(y)]);
            else
                points.push([x, -2]);
            const [nx, ny] = drawn[(i + 1) % drawn.length] ?? [x, y];
            if (y > 0 === ny > 0)
                return;
            // The edge crosses the twin's root: on there to the crown, then straight down.
            const t = y / (y - ny);
            const xc = x + (nx - x) * t;
            const crossing = [
                [xc, foot],
                [xc, -2],
            ];
            points.push(...(y > 0 ? crossing : crossing.reverse()));
        });
        const fitted = { ...a, points };
        if (a.gradient) {
            const [fx, fy] = a.gradient.from;
            const [tx, ty] = a.gradient.to;
            fitted.gradient = { ...a.gradient, from: [fx, up(fy)], to: [tx, up(ty)] };
        }
        delete fitted.below;
        delete fitted.above;
        delete fitted.smooth;
        carriedToTheCrown.add(fitted);
        return fitted;
    });
    return { ...fin, areas };
}
/** Longer edges than this (in fuselage x) are divided before they're fitted. */
const EDGE_STEP = 0.02;
/**
 * An area's outline (`closed`) or line with its long edges divided as a renderer draws them (straight in side-view
 * heights, docs/COORDINATES.md › Fuselage), so each part is fitted where it is: a stripe's edge from the nose to the
 * tail follows the windows on another type, and one along the crown stays on it as far as the crown does. Not a
 * smooth area's (curves through its points), nor an edge from the side to the crown or the belly.
 */
function alongTheSide(line, closed) {
    const out = [];
    const n = line.length;
    line.forEach((p, i) => {
        out.push(p);
        const q = line[(i + 1) % n];
        if (!q || (!closed && i === n - 1))
            return;
        const [[x0, y0], [x1, y1]] = [p, q];
        const across = (x, y) => x >= 0 && x <= 1 && Math.abs(y) < 1;
        const alongTheOutline = x0 >= 0 && x1 <= 1 && x1 >= 0 && x0 <= 1 && Math.abs(y0) === 1 && y1 === y0;
        const steps = Math.ceil(Math.abs(x1 - x0) / EDGE_STEP);
        if (steps < 2 || !(alongTheOutline || (across(x0, y0) && across(x1, y1))))
            return;
        for (let k = 1; k < steps; k++)
            out.push([x0 + ((x1 - x0) * k) / steps, fromHeight(toHeight(y0) + ((toHeight(y1) - toHeight(y0)) * k) / steps)]);
    });
    return out;
}
