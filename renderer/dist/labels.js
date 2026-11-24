// Titles (lettering) and logos. The dataset places logos but doesn't carry their artwork (docs/LOGOS.md): a logo
// is drawn by the caller's painter if it has one, else as a labeled placeholder square.
import { clamp } from './geometry.js';
import { round1, svgElement } from './svg.js';
/** A font's em size is about this many cap heights: titles are measured by cap height. */
export const CAP_HEIGHT_PER_EM = 0.71;
/** A stand-in typeface's lowercase height as a share of its cap height (Helvetica, Arial: ~0.73). */
const STAND_IN_X_HEIGHT = 0.73;
/** A bold sans letter's average advance, in ems: an estimate of how wide a title sets before it's spread. */
export const ADVANCE_PER_EM = 0.58;
/** A title spread wider than its stand-in typeface sets it gets this much stroke (per em, per unit of spread). */
const STROKE_PER_SPREAD = 0.07;
/** A CSS font list from the typefaces the title says come close, then common fallbacks. */
function fontFamilyFor(title) {
    const type = title.type ?? {};
    const families = (type.similar ?? []).map((family) => `'${family.replace(/ (Bold|Light|Medium|Semibold|Black|Oblique|Italic|Pro)\b/gi, '').trim()}'`);
    const generic = type.strokes === 'brush' ? 'cursive' : type.strokes === 'contrast' ? 'serif' : 'sans-serif';
    return [...new Set(families), 'Helvetica Neue', 'Arial', generic].join(', ');
}
function fontStretchFor(title) {
    if (title.type?.width === 'condensed')
        return 'condensed';
    if (title.type?.width === 'extended')
        return 'expanded';
    return undefined;
}
/**
 * On the right side a title covers the same stretch and reads normally, so it's anchored at its aft end, and a
 * turned title takes the mirrored angle (docs/COORDINATES.md › Right side).
 */
export function drawTitle(title, placement, parent, canvas) {
    const { at, capHeight, length, side, centeredOnLine = false } = placement;
    // Too small to read; also skips a NaN from a degenerate placement.
    if (!(capHeight > 0.5))
        return;
    const type = title.type ?? {};
    const rotation = title.rotationDeg ?? 0;
    const angle = side === 'right' ? rotation : -rotation;
    // A wordmark drawn as its mark, where the painter has it: in the title's box, turned with it, its slant its own.
    if (title.mark && canvas.logoPainter) {
        const baseline = centeredOnLine ? capHeight / 2 : 0;
        const box = {
            x: side === 'right' ? -length : 0,
            y: round1(baseline - capHeight),
            width: round1(length),
            height: round1(capHeight),
            fitWidth: true,
        };
        const colors = [title.color, ...(title.parts ?? []).map((p) => p.color)];
        const logo = { mark: title.mark, place: title.place, at: title.at, height: title.height, colors };
        const painted = canvas.logoPainter(logo, box, side);
        if (painted) {
            svgElement('g', { transform: `translate(${round1(at[0])},${round1(at[1])}) rotate(${round1(angle)})` }, parent).appendRaw(painted);
            return;
        }
    }
    const transform = `translate(${round1(at[0])},${round1(at[1])}) rotate(${round1(angle)})` +
        (type.slantDeg ? ` skewX(${-type.slantDeg})` : '');
    // A mostly lowercase wordmark with tall lowercase (easyJet's 0.8) reads small set by its cap height in a stand-in
    // with ordinary lowercase: size it so the lowercase matches, the capitals a little over.
    const lower = Array.from(title.text).filter((c) => c !== c.toUpperCase()).length;
    const letters = Array.from(title.text).filter((c) => c.toLowerCase() !== c.toUpperCase()).length;
    const xMatch = type.xHeight && lower * 2 > letters ? type.xHeight / STAND_IN_X_HEIGHT : 1;
    const fontSize = (capHeight / CAP_HEIGHT_PER_EM) * xMatch;
    // Spread to its measured length, a stand-in typeface's letters are stretched and their upright strokes stay thin:
    // a wide display face (easyJet's Cooper Black, Lufthansa's own) came out thin and spaced. Thicken them to match.
    const spread = length ? length / (title.text.length * ADVANCE_PER_EM * fontSize) : 1;
    const stroke = spread > 1.1 ? Math.min((spread - 1) * STROKE_PER_SPREAD, 0.06) * fontSize : 0;
    const attributes = (color, x, spreadTo) => ({
        x: round1(x),
        y: centeredOnLine ? round1(capHeight / 2) : 0,
        fill: color,
        'font-family': fontFamilyFor(title),
        'font-size': round1(fontSize),
        'font-weight': type.weight ?? 600,
        'font-stretch': fontStretchFor(title),
        textLength: spreadTo ? round1(spreadTo) : undefined,
        lengthAdjust: spreadTo ? 'spacingAndGlyphs' : undefined,
        stroke: stroke ? color : undefined,
        'stroke-width': stroke ? round1(stroke) : undefined,
        'stroke-linejoin': stroke ? 'round' : undefined,
    });
    const parts = title.parts ?? [];
    // Spread in coloured parts: one <text> per part, each spread to its share of the length by its letters. WebKit
    // (Safari, iOS web views) ignores a <text>'s textLength when it holds <tspan>s, so a title in two colours would be
    // set at its natural width there (FedEx's tail would read "FedE", cut at the fin's trailing edge).
    // Laid end to end from the title's left end, in reading order from either side.
    if (parts.length && length) {
        const group = svgElement('g', { transform }, parent);
        const letters = parts.reduce((sum, part) => sum + Array.from(part.text).length, 0);
        let x = side === 'right' ? -length : 0;
        for (const part of parts) {
            const share = (length * Array.from(part.text).length) / letters;
            svgElement('text', attributes(canvas.color(part.color), x, share), group).textContent = part.text;
            x += share;
        }
        return;
    }
    const text = svgElement('text', {
        transform,
        ...attributes(canvas.color(title.color), 0, length),
        'text-anchor': side === 'right' ? 'end' : 'start',
    }, parent);
    // Set naturally, parts are one run of text, so they can't overlap and read in order from either side.
    if (parts.length) {
        for (const part of parts) {
            const color = canvas.color(part.color);
            svgElement('tspan', { fill: color, stroke: stroke ? color : undefined }, text).textContent = part.text;
        }
    }
    else {
        text.textContent = title.text;
    }
}
/** A logo centered on its place, upright and undistorted: the caller's drawing, or a placeholder named by its mark. */
export function drawLogo(logo, center, height, view, parent, canvas) {
    if (!(height > 1))
        return;
    const [cx, cy] = center;
    const width = height;
    const box = { x: round1(cx - width / 2), y: round1(cy - height / 2), width: round1(width), height: round1(height) };
    const group = svgElement('g', { class: 'ol-logo' }, parent);
    svgElement('title', {}, group).textContent = logo.description ? `${logo.mark}: ${logo.description}` : logo.mark;
    const painted = canvas.logoPainter?.(logo, box, view);
    if (painted !== undefined) {
        group.appendRaw(painted);
        return;
    }
    svgElement('rect', {
        ...box,
        rx: 2,
        // No fill: a tinted box over the paint read as paint (United's globe tinted the tail's base).
        fill: 'none',
        stroke: '#111',
        'stroke-width': 1,
        'stroke-dasharray': '3 2',
    }, group);
    const fontSize = clamp(height / 4, 6, 11);
    const label = svgElement('text', {
        x: round1(cx),
        y: round1(cy + fontSize / 3),
        'text-anchor': 'middle',
        'font-size': round1(fontSize),
        'font-family': 'Helvetica Neue, Arial, sans-serif',
        fill: '#111',
        'paint-order': 'stroke',
        stroke: '#fff',
        'stroke-width': 2,
    }, group);
    label.textContent = logo.mark.split('/')[1] ?? logo.mark;
}
