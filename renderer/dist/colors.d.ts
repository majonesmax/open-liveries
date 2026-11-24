import type { Livery } from './scheme.js';
/** Parts a scheme leaves out aren't known yet: drawn in neutral grays, not the base color. */
export declare const NEUTRAL: {
    engines: string;
    wings: string;
    winglets: string;
};
/**
 * A propeller (docs/COORDINATES.md): its blades are dark and never painted, drawn as a faint disc where they turn;
 * its spinner wears the engines' cowling.
 */
export declare const PROPELLER: {
    blades: string;
    discOpacity: number;
};
export declare const spinnerPaint: (livery: Livery) => string | undefined;
/** A scheme with no fuselage (only a fin) is drawn on a plain light gray one. */
export declare const UNPAINTED_FUSELAGE = "#e8eaee";
/** Bare exhaust metal, never painted: a tail engine's, and every engine's core and nozzle behind its fan cowl. */
export declare const NOZZLE = "#9da4ac";
/** Shown where a scheme names a color its palette lacks: loud, so the mistake is seen rather than guessed round. */
export declare const MISSING_COLOR = "#ff00ff";
export declare const WINDOW_GLASS = "#2b3442";
export declare const COCKPIT_GLASS = "#1f2733";
/**
 * A light rim round each cockpit pane, as real glass catches the sky at its edges: it keeps the panes visible on a
 * dark cockpit mask (Air Canada's black), where dark glass alone would leave the nose looking windowless.
 */
export declare const COCKPIT_FRAME: {
    stroke: string;
    'stroke-opacity': number;
    'stroke-width': number;
    'stroke-linejoin': string;
};
/** A part's outline: a faint darkening of whatever it's drawn over. */
export declare const OUTLINE = "#0003";
/** A nearer part's outline (an engine, a winglet, the fuselage), a little darker. */
export declare const OUTLINE_DARK = "#0004";
/** A scheme's color by palette name (or a hex written directly), else `fallback`. */
export declare function colorOf(scheme: Livery, name: string | undefined, fallback: string): string;
