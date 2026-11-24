// The renderer's own colors, for what a scheme doesn't paint (parts it leaves out, glass, bare metal, outlines), and
// the one lookup from a scheme's palette names to hexes.
/** Parts a scheme leaves out aren't known yet: drawn in neutral grays, not the base color. */
export const NEUTRAL = { engines: '#d6d9dd', wings: '#a7adb5', winglets: '#a7adb5' };
/**
 * A propeller (docs/COORDINATES.md): its blades are dark and never painted, drawn as a faint disc where they turn;
 * its spinner wears the engines' cowling.
 */
export const PROPELLER = { blades: '#2b2f36', discOpacity: 0.2 };
export const spinnerPaint = (livery) => livery.engines?.cowling;
/** A scheme with no fuselage (only a fin) is drawn on a plain light gray one. */
export const UNPAINTED_FUSELAGE = '#e8eaee';
/** Bare exhaust metal, never painted: a tail engine's, and every engine's core and nozzle behind its fan cowl. */
export const NOZZLE = '#9da4ac';
/** Shown where a scheme names a color its palette lacks: loud, so the mistake is seen rather than guessed round. */
export const MISSING_COLOR = '#ff00ff';
export const WINDOW_GLASS = '#2b3442';
export const COCKPIT_GLASS = '#1f2733';
/**
 * A light rim round each cockpit pane, as real glass catches the sky at its edges: it keeps the panes visible on a
 * dark cockpit mask (Air Canada's black), where dark glass alone would leave the nose looking windowless.
 */
export const COCKPIT_FRAME = {
    stroke: '#c9d3df',
    'stroke-opacity': 0.55,
    'stroke-width': 0.8,
    'stroke-linejoin': 'round',
};
/** A part's outline: a faint darkening of whatever it's drawn over. */
export const OUTLINE = '#0003';
/** A nearer part's outline (an engine, a winglet, the fuselage), a little darker. */
export const OUTLINE_DARK = '#0004';
/** A scheme's color by palette name (or a hex written directly), else `fallback`. */
export function colorOf(scheme, name, fallback) {
    if (!name)
        return fallback;
    if (name.startsWith('#'))
        return name;
    return scheme.palette?.[name]?.hex ?? fallback;
}
