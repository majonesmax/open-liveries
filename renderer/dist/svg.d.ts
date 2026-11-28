import type { Area, Livery, Logo, Point, Side } from './scheme.js';
/** Attribute values; undefined leaves the attribute out. */
export type Attributes = Record<string, string | number | undefined>;
/** An element being built: its attributes, children, and text. `raw` is markup inserted as is (a logo). */
export declare class Element {
    readonly name: string;
    readonly attributes: Attributes;
    readonly children: (Element | {
        raw: string;
    })[];
    textContent: string;
    constructor(name: string, attributes: Attributes);
    appendRaw(markup: string): void;
    toString(): string;
}
export declare function svgElement(name: string, attributes?: Attributes, parent?: Element): Element;
/** Rounds to a tenth of a pixel, which keeps the markup short. */
export declare const round1: (n: number) => number;
/**
 * Adds points along each edge, so a straight edge in a part's space stays on the part when mapped onto a
 * curved surface (the fuselage's sides, the sheared fin). An open polyline keeps its last point.
 */
export declare function densify(polygon: readonly Point[], closed?: boolean, steps?: number): Point[];
/**
 * An area as a polygon in its part's space. A line paints only over its own x-range: `below` paints down to
 * yMin, `above` up to yMax, and with both the band between them (`below` its upper edge, `above` its lower).
 * With `smooth: true` its outline is a smooth curve through its points, sharp at its corners and where it meets
 * the part's edges (`edges`: the part's lowest and highest y, by default yMin and yMax); otherwise straight.
 *
 * `heights` (the fuselage): its areas' edges run straight (or curve) as seen from the side, so the outline is shaped
 * in side-view heights (`toHeight`) and returned in them too; densify it, then turn each point back with `fromHeight`.
 */
export declare function areaPolygon(area: Area, yMin: number, yMax: number, edges?: readonly [number, number], heights?: boolean): readonly Point[];
/**
 * An area's polygon with points added along its long edges only (a straight edge in a part's space stays on a
 * curved part), up to `densify`'s 12 per edge: the curves' own points are close already.
 */
export declare function densifyArea(polygon: readonly Point[]): Point[];
/** Whether an area, title or logo appears on this side. */
export declare const showsOn: (item: {
    side?: Side;
}, side: "left" | "right") => boolean;
/** Where a logo goes, in the picture's pixels: its box, upright. */
export interface LogoBox {
    x: number;
    y: number;
    width: number;
    height: number;
    /**
     * A title drawn as its mark (Title.mark): the box runs from the baseline (its foot) up the cap height and along the
     * title's length, and the mark is stretched to its width (when it has one) rather than centered at its own.
     */
    fitWidth?: boolean;
}
/**
 * Draws a logo the dataset only describes (docs/LOGOS.md): SVG markup to put in its place, or undefined for the
 * renderer's placeholder. `side` is the view it's in; on the right side a fin logo reads mirrored unless the
 * scheme says otherwise.
 */
export type LogoPainter = (logo: Logo, box: LogoBox, view: 'left' | 'right' | 'below') => string | undefined;
/** One drawing: its SVG, and helpers that resolve the livery's colors and keep clip-path ids unique. */
export interface Canvas {
    svg: Element;
    /** A palette name or hex to a hex (`colorOf`); `fallback` (by default `MISSING_COLOR`) when it's absent or not in the palette. */
    color: (name: string | undefined, fallback?: string) => string;
    polygon: (points: readonly Point[], fill: string, parent: Element, attributes?: Attributes) => Element;
    /** Defines a clip path with this outline and returns the value for a `clip-path` attribute. */
    clipTo: (name: string, outline: readonly Point[]) => string;
    /**
     * Defines a linear gradient from `from` to `to` in the drawing's own units ([offset, hex] stops) and returns the value
     * for a `fill` attribute.
     */
    gradient: (stops: readonly (readonly [number, string])[], from: Point, to: Point) => string;
    logoPainter: LogoPainter | undefined;
}
/** How a view or texture is drawn: its clip-path ids' prefix, and the caller's logo painter. */
export interface DrawOptions {
    idPrefix?: string | undefined;
    logo?: LogoPainter | undefined;
}
export declare function createCanvas(livery: Livery, label: string, height: number, options: {
    idPrefix?: string | undefined;
    logo?: LogoPainter | undefined;
    width?: number;
    /** Part of the side view only (a winglet's texture): its box, x, y, width and height in the view's pixels. */
    crop?: [number, number, number, number];
}): Canvas;
