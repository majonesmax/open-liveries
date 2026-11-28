// Titles and logos in the side view, on the fuselage, the fin, each engine and the winglet: placed through each
// part's mapping, sized by its measure, and kept on its paint (an engine's cowl) or inside its outline (a winglet's).
import { inside } from './geometry.js';
import { drawLogo, drawTitle } from './labels.js';
import { onThePaint, PAINT_MARGIN } from './paint.js';
import { finFaceX, finLabelClips } from './side-parts.js';
import { showsOn, svgElement } from './svg.js';
/**
 * A logo on a small part (a winglet) kept inside its outline: about as wide as it's tall (its mark's width isn't known
 * here), clear of the edges by a twentieth of its height, moved toward the part's middle and made smaller (to 40%) if
 * it must be (Sun Country's sun stays on a winglet's face).
 */
function insideOutline(center, height, outline) {
    const edge = (p) => {
        let best = Infinity;
        for (let i = 0; i < outline.length; i++) {
            const a = outline[i] ?? p;
            const b = outline[(i + 1) % outline.length] ?? p;
            const [vx, vy] = [b[0] - a[0], b[1] - a[1]];
            const t = Math.min(Math.max(((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1), 0), 1);
            best = Math.min(best, Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t));
        }
        return best;
    };
    const middle = [
        outline.reduce((s, p) => s + p[0], 0) / (outline.length || 1),
        outline.reduce((s, p) => s + p[1], 0) / (outline.length || 1),
    ];
    for (let k = 1; k >= 0.4 - 1e-9; k -= 0.05) {
        const h = height * k;
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            const p = [center[0] + (middle[0] - center[0]) * t, center[1] + (middle[1] - center[1]) * t];
            if (inside(p, outline) && edge(p) >= h * 0.55)
                return { at: p, height: h };
        }
    }
    return { at: middle, height: height * 0.4 };
}
/** How labels are placed on each part, with `engine` the one whose labels these are (if there are any engines). */
function labelGeometry(parts, outlines, engine) {
    const { geometry } = parts;
    // On the fuselage, heights follow the curve: measure between the two mapped points.
    const fuselageSpan = (x, y0, y1) => Math.abs(parts.fuselage(x, y0)[1] - parts.fuselage(x, y1)[1]);
    const out = {
        fuselage: {
            point: parts.fuselage,
            capHeight: (t) => fuselageSpan(t.at[0], t.at[1], t.at[1] + t.height),
            logoHeight: (l) => fuselageSpan(l.at[0], l.at[1] - l.height / 2, l.at[1] + l.height / 2),
            length: (_t, share) => share * geometry.fuselageLength,
        },
        fin: {
            point: parts.fin,
            capHeight: (t) => t.height * geometry.finSpan,
            logoHeight: (l) => l.height * geometry.finSpan,
            length: (t, share) => {
                const [leading, trailing] = geometry.finChord(t.at[1]);
                return share * (trailing - leading) * geometry.fuselageLength;
            },
        },
    };
    if (engine) {
        const { halfHeight, x0, x1 } = engine.engine;
        out.engines = {
            point: engine.point,
            // The nacelle's height counts as 2 (bottom −1 to top 1).
            capHeight: (t) => t.height * halfHeight,
            logoHeight: (l) => l.height * halfHeight,
            length: (_t, share) => share * (x1 - x0),
            ...(engine.engine.cowlEnd !== undefined ? { paintedTo: engine.engine.cowlEnd } : {}),
        };
    }
    const { winglet } = geometry;
    if (winglet && parts.winglet) {
        out.winglets = {
            point: parts.winglet,
            outline: outlines.winglet,
            capHeight: (t) => t.height * winglet.height,
            logoHeight: (l) => l.height * winglet.height,
            length: (_t, share) => share * winglet.chord,
        };
    }
    return out;
}
/**
 * Titles, then logos. Fuselage and fin labels are clipped to their part: paint stays on the skin. Drawn flat, a
 * big title's tallest letters (Alaska's l and k) would rise past the crown, where on the aircraft they curve
 * over it. Engine and winglet labels are returned to be drawn after those parts, on every engine seen from this
 * side. Belly and under-wing labels belong to the below view. With more than one engine a side, the nearest
 * (outboard) engine's labels are drawn last with the winglet's; each one behind it has its labels in `behind`, by
 * engine, to be drawn straight after that engine, so the nearer nacelle covers them as it covers the engine.
 */
export function drawLabels(livery, side, canvas, parts, outlines, only, finParent) {
    const faceX = finFaceX(livery, side);
    // Each part's layer is made when first drawn on; `finParent` (a tail engine's, clipped to its nacelle) takes the
    // fin's labels in place of the fin's own layer.
    let fuselageLayer;
    let finLayer = finParent;
    const layer = (part) => {
        if (part === 'fuselage') {
            fuselageLayer ??= svgElement('g', { 'clip-path': canvas.clipTo('fusLabels', outlines.fuselage) }, canvas.svg);
            return fuselageLayer;
        }
        finLayer ??= svgElement('g', { 'clip-path': canvas.clipTo('finLabels', outlines.fin) }, finLabelClips(parts).reduce((parent, clip, i) => svgElement('g', { 'clip-path': canvas.clipTo(`finShown${i}`, clip) }, parent), canvas.svg));
        return finLayer;
    };
    const deferred = Object.assign([], {
        behind: parts.engines.slice(0, -1).map(() => []),
    });
    // One geometry per engine: fuselage and fin labels are drawn once, engine labels on each engine.
    const geometries = parts.engines.length
        ? parts.engines.map((engine) => labelGeometry(parts, outlines, engine))
        : [labelGeometry(parts, outlines, undefined)];
    const each = (part, draw) => {
        if (only && part !== only)
            return;
        if (part === 'fuselage' || part === 'fin') {
            const g = geometries[0]?.[part];
            if (g)
                draw(g, layer(part));
            return;
        }
        const perEngine = part === 'engines' ? geometries : geometries.slice(0, 1);
        perEngine.forEach((geometry, i) => {
            const g = geometry[part];
            if (g) {
                (part === 'engines' ? (deferred.behind[i] ?? deferred) : deferred).push((parent) => {
                    draw(g, parent);
                });
            }
        });
    };
    for (const title of livery.titles ?? []) {
        if (!showsOn(title, side) || title.place === 'belly')
            continue;
        each(title.place, (g, parent) => {
            const fitted = g.paintedTo !== undefined ? onThePaint(title, g.paintedTo) : title;
            const placement = {
                at: g.point(fitted.at[0], fitted.at[1]),
                capHeight: g.capHeight(fitted),
                length: fitted.length ? g.length(fitted, fitted.length) : 0,
                side,
            };
            drawTitle(fitted, placement, parent, canvas);
        });
    }
    for (const logo of livery.logos ?? []) {
        if (!showsOn(logo, side) || logo.place === 'belly' || logo.place === 'wingUnder')
            continue;
        const x = logo.place === 'fin' ? faceX(logo.at[0]) : logo.at[0];
        each(logo.place, (g, parent) => {
            // On paint that ends short of the part's end (an engine's cowl), moved forward to stay on it: about as wide as
            // it's tall (its mark's width isn't known here).
            const across = Math.abs(g.point(1, 0)[0] - g.point(0, 0)[0]) || 1;
            const half = g.paintedTo !== undefined ? g.logoHeight(logo) / 2 / across : 0;
            const at = g.paintedTo !== undefined ? Math.min(x, g.paintedTo - PAINT_MARGIN - half) : x;
            if (g.outline) {
                const fit = insideOutline(g.point(at, logo.at[1]), g.logoHeight(logo), g.outline);
                drawLogo(logo, fit.at, fit.height, side, parent, canvas);
                return;
            }
            drawLogo(logo, g.point(at, logo.at[1]), g.logoHeight(logo), side, parent, canvas);
        });
    }
    return deferred;
}
