// A measured shape (shapes/<type>.json, docs/SHAPES.md) laid out for drawing: the same Geometry as the parametric
// shapes give, so every view and texture draws on it unchanged, with the measured outlines where the parametric
// layout would guess (the fuselage's curves, the fin with its fillet and rudder, the wing's plan, the nacelles,
// each window and cockpit pane).
import { clamp, doorShape, fromHeight, FUSELAGE_PIXELS, halfSign, lerp, lerpPoint, MARGIN, NOSE_X, toHeight, VIEW_WIDTH, } from './geometry.js';
/** A parsed JSON value that is a shape file rather than a parametric AircraftShape. */
export function isMeasuredShape(shape) {
    if (typeof shape !== 'object' || shape === null)
        return false;
    const fuselage = shape.fuselage;
    return typeof fuselage === 'object' && fuselage !== null && Array.isArray(fuselage.crown);
}
/** The value at a dotted path in parsed JSON, if every step on the way is an object. */
function valueAt(value, path) {
    return path
        .split('.')
        .reduce((v, key) => (typeof v === 'object' && v !== null ? v[key] : undefined), value);
}
/** What a shape file read from JSON lacks for drawing (schema/shape.schema.json checks the rest). */
export function measuredShapeProblems(shape) {
    const problems = [];
    const isLine = (value) => Array.isArray(value) &&
        value.length >= 2 &&
        value.every((p) => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number');
    const length = valueAt(shape, 'fuselage.length');
    if (typeof length !== 'number' || !(length > 0))
        problems.push('fuselage.length must be a positive number');
    const lines = [
        'fuselage.crown',
        'fuselage.belly',
        'fuselage.halfWidth',
        'fin.leading',
        'fin.trailing',
        ...['wing', 'stabilizer'].flatMap((s) => ['leading', 'trailing', 'z'].map((k) => `${s}.${k}`)),
    ];
    for (const path of lines) {
        if (!isLine(valueAt(shape, path)))
            problems.push(`${path} must be a list of at least two [a, b] points`);
    }
    const engines = valueAt(shape, 'engines');
    if (!Array.isArray(engines) || !engines.length)
        problems.push('engines: at least one');
    else {
        engines.forEach((e, i) => {
            for (const k of ['top', 'bottom']) {
                if (!isLine(valueAt(e, k)))
                    problems.push(`engines[${i}].${k} must be a list of at least two [a, b] points`);
            }
            if (valueAt(e, 'pylon') !== undefined) {
                for (const k of ['leading', 'trailing', 'z']) {
                    if (!isLine(valueAt(e, `pylon.${k}`)))
                        problems.push(`engines[${i}].pylon.${k} must be a list of at least two [a, b] points`);
                }
                if (typeof valueAt(e, 'pylon.thickness') !== 'number')
                    problems.push(`engines[${i}].pylon.thickness must be a number`);
            }
        });
    }
    return problems;
}
/** b at a along a line (sorted by a), held level beyond its ends. */
function at(line, a) {
    const first = line[0];
    const last = line.at(-1);
    if (!first || !last)
        return 0;
    if (a <= first[0])
        return first[1];
    if (a >= last[0])
        return last[1];
    let p = first;
    for (const q of line) {
        if (a <= q[0])
            return q[0] === p[0] ? q[1] : lerp(p[1], q[1], (a - p[0]) / (q[0] - p[0]));
        p = q;
    }
    return last[1];
}
const byFirst = (line) => [...line].sort((p, q) => p[0] - q[0]);
/** [x, z] side-view edges as x at each height: [z, x], sorted. */
const byHeight = (line) => byFirst(line.map(([x, z]) => [z, x]));
/**
 * x along a side-view edge at height z; below its root, carried on straight from its first stretch, or from its
 * first half meter where the first stretch is a trace's hook (a curl at the root that would run the edge off
 * near level).
 */
function edgeX(edge, z) {
    const [p, q] = edge;
    if (!p || !q || z >= p[0] || q[0] === p[0])
        return at(edge, z);
    const slope = (r) => (r[1] - p[1]) / (r[0] - p[0]);
    const far = edge.find((r) => r[0] - p[0] >= 0.5);
    const s = far && Math.abs(slope(q) - slope(far)) > 1 ? slope(far) : slope(q);
    return p[1] + s * (z - p[0]);
}
const maxOf = (line, i) => Math.max(...line.map((p) => p[i]));
const minOf = (line, i) => Math.min(...line.map((p) => p[i]));
/**
 * A parametric stand-in for the measured shape, for what reads the AircraftShape itself (a texture's size, the
 * cockpit mask's and window band's extent, viewers listing a shape's numbers).
 */
function approximate(m) {
    const { fuselage, fin, wing, stabilizer, cabin, cockpit } = m;
    const tube = Math.max(...fuselage.crown.map(([x, z]) => z - at(byFirst(fuselage.belly), x)));
    const xs = [...cabin.windows.x].sort((a, b) => a - b);
    const gaps = xs.flatMap((x, i) => (i > 0 ? [x - (xs[i - 1] ?? x)] : [])).sort((a, b) => a - b);
    const pitch = gaps[Math.floor(gaps.length / 2)] ?? 0.5;
    const panes = cockpit.windows.flat();
    const plan = (s) => ({
        rootLeading: s.leading[0]?.[1] ?? 0,
        rootTrailing: s.trailing[0]?.[1] ?? 0,
        tipLeading: s.leading.at(-1)?.[1] ?? 0,
        tipTrailing: s.trailing.at(-1)?.[1] ?? 0,
    });
    const span = (s) => maxOf(s.leading, 0);
    const dihedral = (s) => {
        const [a, b] = [s.z[0], s.z.at(-1)];
        return a && b && b[0] !== a[0] ? (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI : 0;
    };
    const root = fin.leading[0] ?? [0, 0];
    return {
        name: m.id,
        fuselage: {
            length: fuselage.length,
            radius: tube / 2,
            nose: { crown: 0, belly: 0, tip: 0 },
            tail: { crownFrom: fuselage.length, crownEnd: 1, bellyFrom: fuselage.length, bellyEnd: 1 },
        },
        cabin: {
            from: (xs[0] ?? 0) - cabin.windows.width / 2,
            to: (xs.at(-1) ?? 0) + cabin.windows.width / 2,
            pitch,
            doors: cabin.doors.map((d) => d.x),
        },
        cockpit: { from: panes.length ? minOf(panes, 0) : 0, to: panes.length ? maxOf(panes, 0) : 0 },
        fin: {
            rootLeading: root[0],
            rootTrailing: fin.trailing[0]?.[0] ?? 0,
            tipLeading: fin.leading.at(-1)?.[0] ?? 0,
            tipTrailing: fin.trailing.at(-1)?.[0] ?? 0,
            height: maxOf(fin.trailing, 1) - root[1],
        },
        stabilizer: {
            ...plan(stabilizer),
            span: span(stabilizer),
            height: stabilizer.z[0]?.[1] ?? 0,
            dihedralDeg: dihedral(stabilizer),
        },
        wing: { ...plan(wing), span: span(wing), height: wing.z[0]?.[1] ?? 0, dihedralDeg: dihedral(wing) },
        ...(m.wingtip
            ? {
                winglet: {
                    height: maxOf(m.wingtip.leading, 1) - (m.wingtip.leading[0]?.[1] ?? 0),
                    sweep: (m.wingtip.leading.at(-1)?.[0] ?? 0) - (m.wingtip.leading[0]?.[0] ?? 0),
                    tipChord: 0.4,
                },
            }
            : {}),
        engines: m.engines
            .filter((e) => e.mount !== 'tail')
            .map((e) => {
            const top = maxOf(e.top, 1);
            const bottom = minOf(e.bottom, 1);
            return { front: e.x[0], back: e.x[1], radius: (top - bottom) / 2, height: (top + bottom) / 2, out: e.y };
        }),
    };
}
function frameOf(m) {
    const { fuselage, fin, wing, stabilizer, wingtip } = m;
    const L = fuselage.length;
    // Nose to tail cone in FUSELAGE_PIXELS, unless a part reaches far enough behind the tail cone to leave the picture
    // (a T-tail's tailplane: the 717's tips are 3.4 m behind it); then smaller, so the whole aircraft fits, 4 px clear
    // of the edge (the 737-600's tailplane tips come within 7 px of it at full size).
    const reach = Math.max(L, ...[wing, stabilizer].flatMap((s) => [...s.leading, ...s.trailing].map(([, x]) => x)), ...fin.trailing.map(([x]) => x), ...m.engines.map((e) => e.x[1]));
    const fuselagePixels = Math.min(FUSELAGE_PIXELS, ((VIEW_WIDTH - 4 - NOSE_X) * L) / reach);
    const scale = fuselagePixels / L;
    const share = (meters) => meters / L;
    const crown = byFirst(fuselage.crown);
    const belly = byFirst(fuselage.belly);
    const halfWidth = byFirst(fuselage.halfWidth);
    const crownZ = (meters) => at(crown, meters);
    const bellyZ = (meters) => at(belly, meters);
    const stabZ = byFirst(stabilizer.z);
    const wingLeading = byFirst(wing.leading);
    const tipLeading = wingtip ? byHeight(wingtip.leading) : [];
    // The side view's height: from the highest of the fin, the wingtip and the crown down to the lowest of the
    // belly and the engines.
    const top = Math.max(maxOf(fin.leading, 1), maxOf(fin.trailing, 1), maxOf(crown, 1), ...(fuselage.hump ? [maxOf(fuselage.hump.crown, 1)] : []), maxOf(stabZ, 1), ...m.engines.filter((e) => e.mount === 'tail').map((e) => maxOf(e.top, 1)), ...tipLeading.map((p) => p[0]), ...m.engines.flatMap((e) => (e.propeller ? [e.propeller.z + e.propeller.diameter / 2] : [])));
    const lowest = Math.min(minOf(belly, 1), ...m.engines.map((e) => minOf(e.bottom, 1)), ...m.engines.flatMap((e) => (e.propeller ? [e.propeller.z - e.propeller.diameter / 2] : [])));
    const centerY = MARGIN + top * scale;
    const y = (meters) => centerY - meters * scale;
    const px = (meters) => NOSE_X + meters * scale;
    const tube = Math.max(...crown.map(([x, z]) => z - bellyZ(x)));
    const radius = (tube / 2) * scale;
    // The below view's middle (its lateral reach: the wing, tailplane, fuselage and engines).
    const wingTipLateral = Math.max(maxOf(wingLeading, 0), wingtip?.front ? maxOf(wingtip.front, 0) : 0);
    const lateralMax = Math.max(wingTipLateral, maxOf(stabilizer.leading, 0), maxOf(halfWidth, 1), ...m.engines.map((e) => e.y + Math.max((e.inlet?.width ?? 0) / 2, (e.propeller?.diameter ?? 0) / 2)));
    return {
        m,
        L,
        fuselagePixels,
        scale,
        share,
        fuselageX: (x) => NOSE_X + x * fuselagePixels,
        px,
        y,
        centerY,
        sideHeight: Math.ceil(centerY - lowest * scale + MARGIN),
        belowCenterY: MARGIN + lateralMax * scale,
        radius,
        thickness: 0.1 * radius,
        crown,
        belly,
        halfWidth,
        crownZ,
        bellyZ,
        wingZ: byFirst(wing.z),
        wingLeading,
        wingTrailing: byFirst(wing.trailing),
        stabZ,
        tipLeading,
        tipTrailing: wingtip ? byHeight(wingtip.trailing) : [],
        toFuselage: ([meters, z]) => {
            const c = crownZ(meters);
            const b = bellyZ(meters);
            const r = (c - b) / 2 || 1;
            return [share(meters), fromHeight((z - (c + b) / 2) / r)];
        },
        toSide: ([meters, z]) => [px(meters), y(z)],
    };
}
/**
 * The fuselage: its outline from the side, its glass and doors in fuselage space, an upper deck above the main tube
 * (a 747's hump) in the side view's pixels, and the windows' bands that a scheme from another type is fitted by.
 */
function layoutFuselage(f) {
    const { m, L, share, fuselageX, y, crown, belly, halfWidth, crownZ, bellyZ, toFuselage, toSide } = f;
    const { fuselage } = m;
    /** A point at y is drawn r·sin(y·90°) from the middle of crown and belly at that x. */
    const fuselagePoint = (x, yy) => {
        const meters = clamp(x, 0, 1) * L;
        const c = crownZ(meters);
        const b = bellyZ(meters);
        return [fuselageX(x), y((c + b) / 2 + ((c - b) / 2) * toHeight(yy))];
    };
    /**
     * A cockpit pane to fuselage space with its edges kept straight as the side view draws them: each edge in steps
     * of at most 5 cm in meters first. Near the crown the fuselage's mapping would bend an edge drawn between two
     * corners (a windshield's bottom edge, from its post on the crown back to its aft corner, by up to 0.16 m on the
     * C-130J).
     */
    const paneToFuselage = (pane) => pane.flatMap((a, i) => {
        const b = pane[(i + 1) % pane.length] ?? a;
        const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05));
        return Array.from({ length: steps }, (_, s) => toFuselage(lerpPoint(a, b, s / steps)));
    });
    // The cabin windows (both decks' rows) as outlines in meters.
    const cabinPanes = [m.cabin.windows, ...(m.cabin.upperWindows ? [m.cabin.upperWindows] : [])].flatMap((row) => row.x.map((x) => {
        const w = row.width / 2;
        const [z0, z1] = row.z;
        return [
            [x - w, z0],
            [x + w, z0],
            [x + w, z1],
            [x - w, z1],
        ];
    }));
    const doorBox = (d) => [
        [d.x[0], d.z[0]],
        [d.x[1], d.z[1]],
    ];
    // An upper deck above the main tube (a 747's hump): the main tube's paint space is the crown and belly, as on
    // any shape; the hump stands above it, in the side view's pixels. The glass and doors whose middle is above the
    // main crown are the hump's (the 747's flight deck, upper-deck windows and doors).
    const humpLine = fuselage.hump ? byFirst(fuselage.hump.crown) : undefined;
    const onHump = (outline) => {
        if (!humpLine || !outline.length)
            return false;
        const mx = outline.reduce((s, p) => s + p[0], 0) / outline.length;
        const mz = outline.reduce((s, p) => s + p[1], 0) / outline.length;
        return mx >= (humpLine[0]?.[0] ?? 0) && mx <= (humpLine.at(-1)?.[0] ?? 0) && mz > crownZ(mx) + 0.05;
    };
    let hump;
    if (humpLine) {
        // Its outline: along its top, then back along the main crown (a little inside it, so the two meet).
        const xs = [...new Set([...humpLine.map(([x]) => x), ...crown.map(([x]) => x)])]
            .filter((x) => x >= (humpLine[0]?.[0] ?? 0) && x <= (humpLine.at(-1)?.[0] ?? 0))
            .sort((a, b) => a - b);
        hump = {
            from: share(humpLine[0]?.[0] ?? 0),
            to: share(humpLine.at(-1)?.[0] ?? 0),
            outline: [
                ...xs.map((x) => toSide([x, Math.max(at(humpLine, x), crownZ(x))])),
                ...[...xs].reverse().map((x) => toSide([x, crownZ(x) - 0.08])),
            ],
            glass: {
                cabin: cabinPanes.filter(onHump).map((pane) => pane.map(toSide)),
                cockpit: m.cockpit.windows.filter(onHump).map((pane) => pane.map(toSide)),
            },
            doors: m.cabin.doors
                .filter((d) => onHump(doorBox(d)))
                .map((d) => ({ ...doorShape(d.kind, d.x, d.z, toSide), ...(d.side && { side: d.side }) })),
        };
    }
    // Every measured x along the fuselage, so its outline keeps the drawing's detail (the nose, the windshield).
    const fuselageSamples = [...new Set([...crown, ...belly, ...halfWidth].map(([x]) => clamp(share(x), 0, 1)))].sort((a, b) => a - b);
    // The windows' band in fuselage y, at the middle window of each row on the main tube (a 747's upper deck's
    // windows are below its main crown, under the hump); a row without windows (a freighter's) has none.
    const band = (row) => {
        const xs = [...row.x].sort((a, b) => a - b);
        const x = xs[Math.floor(xs.length / 2)];
        if (x === undefined || row.z[1] > crownZ(x))
            return undefined;
        return [toFuselage([x, row.z[0]])[1], toFuselage([x, row.z[1]])[1]];
    };
    const main = band(m.cabin.windows);
    const upperRow = m.cabin.upperWindows;
    const upperBand = upperRow && band(upperRow);
    const upper = upperRow && upperBand
        ? {
            band: upperBand,
            along: [share(Math.min(...upperRow.x)), share(Math.max(...upperRow.x))],
        }
        : undefined;
    return {
        fuselagePoint,
        profile: (x) => ({ crown: crownZ(clamp(x, 0, 1) * L), belly: bellyZ(clamp(x, 0, 1) * L) }),
        windows: {
            ...(main ? { main, heights: m.cabin.windows.z } : {}),
            // A type without windows has a line only where it says where they'd be (a freighter: its passenger version's).
            ...(main || m.cabin.windows.wouldBe ? { line: m.cabin.windows.z } : {}),
            ...(m.cabin.windows.wouldBe
                ? {
                    wouldBe: [
                        share(m.cabin.windows.wouldBe[0] - m.cabin.windows.width / 2),
                        share(m.cabin.windows.wouldBe[1] + m.cabin.windows.width / 2),
                    ],
                }
                : {}),
            flightDeck: Math.min(...m.cockpit.windows.flat().map(([, z]) => z)),
            ...(upper ? { upper } : {}),
        },
        detail: {
            fuselageSamples,
            glass: {
                cabin: cabinPanes.filter((pane) => !onHump(pane)).map((pane) => pane.map(toFuselage)),
                cockpit: m.cockpit.windows.filter((pane) => !onHump(pane)).map(paneToFuselage),
            },
            doors: m.cabin.doors
                .filter((d) => !onHump(doorBox(d)))
                .map((d) => ({
                ...doorShape(d.kind, d.x, d.z, toFuselage),
                ...(d.side && { side: d.side }),
            })),
            ...(hump ? { hump } : {}),
        },
    };
}
/** The fin: y from the leading edge's root (on the crown) to the tip; x the share of the chord at that height. */
function layoutFin(f) {
    const { m, share, fuselageX, px, y, scale, crownZ } = f;
    const { fin } = m;
    const finLeading = byHeight(fin.leading);
    const finTrailing = byHeight(fin.trailing);
    const finRoot = finLeading[0]?.[0] ?? 0;
    const finTip = Math.max(maxOf(finLeading, 0), maxOf(finTrailing, 0));
    const finZ = (fy) => lerp(finRoot, finTip, fy);
    const finChord = (fy) => [share(edgeX(finLeading, finZ(fy))), share(edgeX(finTrailing, finZ(fy)))];
    const finPoint = (fx, fy) => {
        const [leading, trailing] = finChord(fy);
        return [fuselageX(lerp(leading, trailing, fx)), y(finZ(fy))];
    };
    const rudder = fin.rudder ? byHeight(fin.rudder) : undefined;
    const rudderShare = rudder
        ? (fy) => {
            const [leading, trailing] = finChord(fy);
            return trailing === leading ? 0.7 : (share(edgeX(rudder, finZ(fy))) - leading) / (trailing - leading);
        }
        : undefined;
    // The fin's outline, from a meter inside the fuselage (or from the trailing edge's foot, where that's lower: the
    // L-1011's runs down behind its center engine's fairing to the body): the fillet's curve, the leading edge above
    // it, over the tip and down the trailing edge.
    const below = Math.min(finRoot - 1, finTrailing[0]?.[0] ?? finRoot);
    const fillet = fin.fillet ?? [];
    const filletTop = fillet.length ? maxOf(fillet, 1) : -Infinity;
    const finOutlineMeters = [
        fillet[0] ? [fillet[0][0], below] : [edgeX(finLeading, below), below],
        ...fillet,
        ...fin.leading.filter(([, z]) => z > filletTop),
        ...[...fin.trailing].reverse(),
        [edgeX(finTrailing, below), below],
    ];
    // The crown under the fin: about its root on a type whose fin stands on the body, well below it where the fin
    // stands on a center engine or its S-duct's fairing (the 727's, the DC-10's, the L-1011's).
    let footZ = finRoot;
    for (let z = finRoot; z > finRoot - (finTip - finRoot) * 3; z -= 0.01) {
        footZ = z;
        if (crownZ(edgeX(finLeading, z)) >= z)
            break;
    }
    return {
        finChord,
        finSpan: (finTip - finRoot) * scale,
        finPoint,
        foot: finTip === finRoot ? 0 : (footZ - finRoot) / (finTip - finRoot),
        detail: {
            finOutline: finOutlineMeters.map(([x, z]) => [px(x), y(z)]),
            ...(fillet.length ? { finFillet: true } : {}),
            ...(rudderShare ? { rudderShare } : {}),
        },
    };
}
/** The near wing (with its flap track fairings and wingtip device) and tailplane from the side. */
function layoutSurfaces(f) {
    const { m, px, y, scale, thickness, wingZ, stabZ, tipLeading, tipTrailing } = f;
    const { wing, stabilizer, wingtip } = m;
    // Wing and tailplane from the side: the band between their edges, at their heights along the span.
    const surfaceSide = (s, z) => [
        ...byFirst(s.leading).map(([lateral, x]) => [px(x), y(at(z, lateral))]),
        ...byFirst(s.trailing)
            .reverse()
            .map(([lateral, x]) => [px(x), y(at(z, lateral)) + thickness]),
    ];
    // A wing's flap track fairings from the side: canoes hanging from its lower surface at their span, deepest a little
    // aft of their middle and rising to a point behind the trailing edge.
    const fairingSide = (fairing) => {
        const top = y(at(wingZ, fairing.y)) + thickness;
        const depth = fairing.depth * scale;
        const [x0, x1] = fairing.x;
        const steps = 16;
        const under = [];
        for (let k = 0; k <= steps; k++) {
            const t = k / steps;
            // Deepest at 0.55 of its length; its nose blunter than its tail.
            const s = t < 0.55 ? Math.sin((t / 0.55) * (Math.PI / 2)) ** 0.7 : Math.cos(((t - 0.55) / 0.45) * (Math.PI / 2)) ** 1.4;
            under.push([px(x0 + (x1 - x0) * t), top + depth * s]);
        }
        return [[px(x0), top], ...under, [px(x1), top]];
    };
    // The wingtip device from the side: x the share of its chord, y the share of its height, each edge from its
    // own root to the tip. The side view draws the wing's trailing edge `thickness` below its leading edge, so the
    // device's trailing root drops the same, easing back over its lower 40%, to meet it.
    let winglet;
    if (wingtip && tipLeading.length && tipTrailing.length) {
        const rootL = tipLeading[0]?.[0] ?? 0;
        const rootT = tipTrailing[0]?.[0] ?? 0;
        const tipZ = Math.max(maxOf(tipLeading, 0), maxOf(tipTrailing, 0));
        const edge = (line, root, yy, drop = 0) => {
            const z = lerp(root, tipZ, clamp(yy, 0, 1));
            return [px(at(line, z)), y(z) + drop * Math.max(0, 1 - clamp(yy, 0, 1) / 0.4)];
        };
        winglet = {
            height: (tipZ - Math.min(rootL, rootT)) * scale,
            chord: Math.abs(at(tipTrailing, rootT) - at(tipLeading, rootL)) * scale,
            point: (x, yy) => lerpPoint(edge(tipLeading, rootL, yy), edge(tipTrailing, rootT, yy, thickness), x),
        };
    }
    return {
        wingSide: surfaceSide(wing, wingZ),
        fairingsSide: (wing.fairings ?? []).map(fairingSide),
        stabilizerSide: surfaceSide(stabilizer, stabZ),
        ...(winglet ? { winglet } : {}),
    };
}
/**
 * A rear-mounted engine's stub pylon, carried on from its measured tip to the nacelle's middle (`out` from the
 * centerline) so it meets the nacelle in every view. From the side it's mostly behind the nacelle: its outline runs
 * from the leading edge back to the trailing edge's tip, then tapers in to the trailing edge's root on the fuselage
 * (the fairing aft of the nozzle). From below, its plan.
 */
function stubPylon(f, p, out) {
    const { px, y, scale, belowCenterY, toFuselage } = f;
    const leading = byFirst(p.leading);
    const trailing = byFirst(p.trailing);
    const tipOf = (edge) => {
        const last = edge.at(-1);
        return last && last[0] < out ? [...edge, [out, last[1]]] : edge;
    };
    const zs = p.z.map(([, z]) => z);
    const zTop = Math.max(...zs) + p.thickness / 2;
    const zBottom = Math.min(...zs) - p.thickness / 2;
    const front = minOf(leading, 1);
    const tipTrailing = trailing.at(-1)?.[1] ?? front;
    const rootTrailing = trailing[0]?.[1] ?? tipTrailing;
    const zMiddle = (zTop + zBottom) / 2;
    return {
        // Where the fairing aft of the nozzle meets the fuselage: halfway along the trailing edge, at its middle.
        root: toFuselage([(tipTrailing + rootTrailing) / 2, zMiddle]),
        side: [
            [px(front), y(zTop)],
            [px(tipTrailing), y(zTop)],
            [px(rootTrailing), y(zMiddle)],
            [px(tipTrailing), y(zBottom)],
            [px(front), y(zBottom)],
        ],
        below: (half) => {
            const sign = halfSign(half);
            return [
                ...tipOf(leading).map(([lateral, x]) => [px(x), belowCenterY + sign * lateral * scale]),
                ...tipOf(trailing)
                    .reverse()
                    .map(([lateral, x]) => [px(x), belowCenterY + sign * lateral * scale]),
            ];
        },
    };
}
/**
 * A propeller (docs/SHAPES.md), in pixels: its disc seen edge on, a lens a twelfth of its diameter thick (a blur of
 * blades turning), and its spinner, a rounded cone from its tip to its base on the nacelle; from the side about the
 * hub's height, from below about the engine's line (`out` from the centerline).
 */
function propellerGeometry(f, p, out) {
    const { px, y, scale, belowCenterY } = f;
    const radius = (p.diameter / 2) * scale;
    const thick = Math.max((p.diameter / 24) * scale, 1.2);
    const lens = (cx, cy) => Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * 2 * Math.PI;
        return [cx + thick * Math.cos(a), cy + radius * Math.sin(a)];
    });
    const [tip, base] = p.spinner?.x ?? [p.x - 0.05 * p.diameter, p.x + 0.05 * p.diameter];
    const r = ((p.spinner?.diameter ?? 0.15 * p.diameter) / 2) * scale;
    const cone = (cy) => {
        const ts = Array.from({ length: 17 }, (_, i) => i / 16);
        const at = (t) => [px(lerp(tip, base, t)), r * Math.sqrt(1 - (1 - t) ** 2)];
        return [
            ...ts.map((t) => [at(t)[0], cy - at(t)[1]]),
            ...[...ts].reverse().map((t) => [at(t)[0], cy + at(t)[1]]),
        ];
    };
    return {
        disc: lens(px(p.x), y(p.z)),
        spinner: cone(y(p.z)),
        below: (half) => {
            const cy = belowCenterY + halfSign(half) * out * scale;
            return { disc: lens(px(p.x), cy), spinner: cone(cy) };
        },
    };
}
/**
 * An engine on the tail's centerline (docs/SHAPES.md): drawn over the fuselage and the fin's foot, in the side view's
 * pixels. The outline runs along its top and back along its bottom; where a strut joins the nacelle to the crown, the
 * bottom drops to the crown (a little inside it, so the two meet) over the strut's length.
 */
function tailEngine(f, e) {
    const { px, scale, belowCenterY, crown, crownZ, toSide } = f;
    const top = byFirst(e.top);
    const bottom = byFirst(e.bottom);
    const [s0, s1] = e.strut ?? [Infinity, -Infinity];
    const xs = [...new Set([...bottom.map(([x]) => x), ...crown.map(([x]) => x), s0, s1])]
        .filter((x) => x >= (bottom[0]?.[0] ?? 0) && x <= (bottom.at(-1)?.[0] ?? 0))
        .sort((a, b) => a - b);
    const under = xs.flatMap((x) => {
        const b = at(bottom, x);
        const c = Math.min(crownZ(x) - 0.08, b);
        if (x === s0)
            return [toSide([x, b]), toSide([x, c])];
        if (x === s1)
            return [toSide([x, c]), toSide([x, b])];
        return [toSide([x, x > s0 && x < s1 ? c : b])];
    });
    const outline = [...top.map(toSide), ...under.reverse()];
    const front = Math.min(top[0]?.[0] ?? 0, bottom[0]?.[0] ?? 0);
    const back = Math.max(top.at(-1)?.[0] ?? 0, bottom.at(-1)?.[0] ?? 0);
    const lipTo = front + 0.04 * (e.x[1] - e.x[0]);
    const plan = e.halfWidth ? byFirst(e.halfWidth) : undefined;
    const planSide = (line, sign) => line.map(([x, w]) => [px(x), belowCenterY + sign * w * scale]);
    const cut = e.cowlEnd ?? Infinity;
    const ahead = plan?.filter(([x]) => x <= cut);
    const behind = plan?.filter(([x]) => x >= cut);
    if (plan && ahead?.length && behind?.length && Number.isFinite(cut)) {
        ahead.push([cut, at(plan, cut)]);
        behind.unshift([cut, at(plan, cut)]);
    }
    return {
        duct: e.duct ?? 'straight',
        outline,
        lip: [
            toSide([front, Math.max(...top.map(([, z]) => z))]),
            toSide([lipTo, Math.max(...top.map(([, z]) => z))]),
            toSide([lipTo, Math.min(...bottom.map(([, z]) => z))]),
            toSide([front, Math.min(...bottom.map(([, z]) => z))]),
        ],
        ...(e.nozzle
            ? { nozzle: [...byFirst(e.nozzle.top).map(toSide), ...byFirst(e.nozzle.bottom).reverse().map(toSide)] }
            : {}),
        ...(plan && e.duct !== 's'
            ? {
                below: [
                    ...planSide(ahead?.length ? ahead : plan, -1),
                    ...planSide([...(ahead?.length ? ahead : plan)].reverse(), 1),
                ],
                ...(behind && behind.length > 1 && Number.isFinite(cut)
                    ? { belowNozzle: [...planSide(behind, -1), ...planSide([...behind].reverse(), 1)] }
                    : {}),
            }
            : {}),
        x: [px(front), px(back)],
    };
}
/**
 * The engines: under the wing or on the rear fuselage (on a stub pylon), inboard first so an outboard one (nearer, in
 * the side view) is drawn over it, each a nacelle through its measured top and bottom; and those on the tail's
 * centerline, apart.
 */
function layoutEngines(f) {
    const { m, px, y, scale, halfWidth, wingZ, wingLeading } = f;
    const measuredEngines = [...m.engines].filter((e) => e.mount !== 'tail').sort((a, b) => a.y - b.y);
    const profiles = new Map();
    const engines = measuredEngines.map((e) => {
        const topZ = maxOf(e.top, 1);
        const bottomZ = minOf(e.bottom, 1);
        const engine = {
            x0: px(e.x[0]),
            x1: px(e.x[1]),
            centerY: y((topZ + bottomZ) / 2),
            halfHeight: ((topZ - bottomZ) / 2) * scale,
            lateral: e.y * scale,
            underWing: e.mount !== 'fuselage' && e.y > maxOf(halfWidth, 1) && topZ < at(wingZ, e.y),
            ...(e.cowlEnd !== undefined && e.mount !== 'tail'
                ? { cowlEnd: (e.cowlEnd - e.x[0]) / (e.x[1] - e.x[0] || 1) }
                : {}),
            wingY: y(at(wingZ, e.y)),
            wingLeadingX: px(at(wingLeading, e.y)),
            ...(e.mount === 'fuselage' && e.pylon ? { stubPylon: stubPylon(f, e.pylon, e.y) } : {}),
            ...(e.propeller ? { propeller: propellerGeometry(f, e.propeller, e.y) } : {}),
            ...(e.halfWidth && e.mount !== 'tail' ? { belowHalfWidth: maxOf(e.halfWidth, 1) * scale } : {}),
        };
        profiles.set(engine, { top: byFirst(e.top), bottom: byFirst(e.bottom), x: e.x });
        return engine;
    });
    const enginePoint = (engine, nx, ny) => {
        const p = profiles.get(engine);
        if (!p)
            return [lerp(engine.x0, engine.x1, nx), engine.centerY - ny * engine.halfHeight];
        const meters = lerp(p.x[0], p.x[1], clamp(nx, 0, 1));
        const t = at(p.top, meters);
        const b = at(p.bottom, meters);
        return [px(meters), y((t + b) / 2 + (clamp(ny, -1.2, 1.2) * (t - b)) / 2)];
    };
    return {
        engines,
        enginePoint,
        tailEngines: m.engines.filter((e) => e.mount === 'tail').map((e) => tailEngine(f, e)),
    };
}
/** The below view: the belly by its half-width, the wing's and tailplane's plans. */
function layoutBelow(f) {
    const { m, L, fuselageX, px, scale, belowCenterY, halfWidth, wingLeading, wingTrailing } = f;
    const bellyPoint = (x, yy, half) => {
        const offset = at(halfWidth, clamp(x, 0, 1) * L) * scale * Math.sin(((clamp(yy, -1, 0) + 1) * Math.PI) / 2);
        return [fuselageX(x), belowCenterY + halfSign(half) * offset];
    };
    const wingRoot = Math.max(wingLeading[0]?.[0] ?? 0, wingTrailing[0]?.[0] ?? 0);
    const wingTip = Math.min(wingLeading.at(-1)?.[0] ?? 0, wingTrailing.at(-1)?.[0] ?? 0);
    const wingUnderPoint = (x, yy, half) => {
        const lateral = lerp(wingRoot, wingTip, yy);
        const leading = at(wingLeading, lateral);
        const trailing = at(wingTrailing, lateral);
        return [px(lerp(leading, trailing, x)), belowCenterY + halfSign(half) * lateral * scale];
    };
    const planOutline = (s, half) => {
        const sign = halfSign(half);
        return [
            ...byFirst(s.leading).map(([lateral, x]) => [px(x), belowCenterY + sign * lateral * scale]),
            ...byFirst(s.trailing)
                .reverse()
                .map(([lateral, x]) => [px(x), belowCenterY + sign * lateral * scale]),
        ];
    };
    return {
        belowHeight: Math.ceil(2 * belowCenterY),
        bellyPoint,
        wingUnderPoint,
        wingUnderSpan: wingTip * scale,
        tailplaneBelow: (half) => planOutline(m.stabilizer, half),
        wingBelow: (half) => planOutline(m.wing, half),
    };
}
/** A measured shape as a Geometry, a section at a time over the same frame. */
export function layoutMeasured(m) {
    const f = frameOf(m);
    const fuselage = layoutFuselage(f);
    const fin = layoutFin(f);
    const { engines, enginePoint, tailEngines } = layoutEngines(f);
    const { wingBelow, ...below } = layoutBelow(f);
    return {
        shape: approximate(m),
        windows: fuselage.windows,
        sideHeight: f.sideHeight,
        belowHeight: below.belowHeight,
        scale: f.scale,
        radius: f.radius,
        fuselageLength: f.fuselagePixels,
        centerY: f.centerY,
        belowCenterY: f.belowCenterY,
        fuselageX: f.fuselageX,
        share: f.share,
        fuselagePoint: fuselage.fuselagePoint,
        profile: fuselage.profile,
        finChord: fin.finChord,
        finSpan: fin.finSpan,
        finPoint: fin.finPoint,
        engines,
        enginePoint,
        ...layoutSurfaces(f),
        bellyPoint: below.bellyPoint,
        wingUnderPoint: below.wingUnderPoint,
        wingUnderSpan: below.wingUnderSpan,
        tailplaneBelow: below.tailplaneBelow,
        measured: {
            ...fuselage.detail,
            ...fin.detail,
            wingBelow,
            ...(tailEngines.length ? { tailEngines, finFoot: fin.foot } : {}),
        },
    };
}
