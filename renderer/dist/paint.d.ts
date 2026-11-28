import type { EngineGeometry, Geometry, Mapping } from './geometry.js';
import type { Area, Livery, Point, Title } from './scheme.js';
import type { Attributes, Canvas, Element } from './svg.js';
type Side = 'left' | 'right';
/** Paints a part's areas, in order, mapped through its own coordinates. */
export declare function drawAreas(areas: Area[] | undefined, side: Side, yRange: [number, number], mapping: Mapping, canvas: Canvas, parent: Element, 
/** Moves the area's own points before they're drawn (a tail engine's: the fin's space carried down, side.ts). */
adjust?: (p: Point, area: Area) => Point, 
/** The part's lowest and highest y, where an area's outline stays sharp (default: `yRange`). */
edges?: [number, number], 
/** The fuselage: edges straight as seen from the side, not in y (an angle round it). */
heights?: boolean): void;
/**
 * An area's fill: its color, or its gradient (docs/COORDINATES.md › Gradients) laid over the drawing. `outline` is
 * the area's outline in its part's space (side-view heights on the fuselage, `heights`) and `drawn` the same points
 * where they're drawn. The part's space is mapped to the drawing by the affine map that fits those points best, so
 * the fade's lines across it fall where they are in the part's space: exactly where the mapping is affine (a flat
 * texture, a straight-edged fin's band), within the area's bend elsewhere.
 */
export declare function areaFill(area: Area, outline: readonly Point[], drawn: readonly Point[], canvas: Canvas, heights?: boolean): string;
/**
 * Where a gradient from `from` to `to` in a part's space runs in a drawing, given points of the part (`source`) and
 * where they're drawn (`drawn`): through the best-fitting affine map, so its lines of one paint stay those of the
 * part's space. Undefined when the points don't span an area or the gradient has no length.
 */
export declare function gradientEnds(source: readonly Point[], drawn: readonly Point[], from: Point, to: Point): [Point, Point] | undefined;
/**
 * A rear-mounted engine's stub pylon, as the scheme names its paint: `engines.pylon`, else the fuselage's paint where
 * it meets the fuselage (it's faired into the body: QantasLink's red tail runs onto it).
 */
export declare function stubPylonPaint(livery: Livery, side: Side, engine: EngineGeometry): string | undefined;
/** Where the paint changes along a line of fuselage y from x `from` to `to`: each run's start and colour. */
export declare function runs(livery: Livery, side: Side, canvas: Canvas, y: number, from: number, to: number, step: number): {
    x: number;
    color: string;
}[];
export declare function polish(canvas: Canvas, mapping: Mapping, group: Element): void;
/**
 * The fuselage's paint over its base: areas, radome, and the paint round the glass (a cockpit mask, a dark window
 * band), through any mapping of fuselage space: the side view's, or a texture's.
 */
export declare function paintFuselage(livery: Livery, side: Side, canvas: Canvas, geometry: Geometry, mapping: Mapping, group: Element): void;
/** A cockpit mask round the panes, in the picture: their convex outline (straight between panes) grown by `m`. */
export declare function maskAround(points: readonly Point[], m: number): Point[];
/** How far ahead of the paint's end (a share of the part's x) lettering and logos stop. */
export declare const PAINT_MARGIN = 0.03;
/**
 * A title on a part whose paint ends short of its end (an engine's fan cowl: its core behind is bare metal) kept on
 * the paint: made smaller from its start, kept about its middle up the part, until it ends `PAINT_MARGIN` short of
 * `end`, to 40% of its size. Southwest's "Southwest.com", measured to 80% of a 737's nacelle, stays on the cowl of a
 * nacelle whose cowl is shorter.
 */
export declare function onThePaint(title: Title, end: number): Title;
/** A door's seam (`kind` its kind) as stroke attributes, at `perMetre` pixels to a meter. */
export declare function doorSeam(kind: 'door' | 'exit' | 'cargo', perMetre: number): Attributes;
/**
 * The doors, over the paint and the windows: each one's outline as a thin dark seam, and a main door's small
 * window. Where they are comes from the shape (a measured type's doors exactly; a built-in shape's door gaps at a
 * standard height), never the scheme. A door on one side only (a cargo door on the right) is drawn on that side.
 */
export declare function paintDoors(canvas: Canvas, geometry: Geometry, side: Side, mapping: Mapping, group: Element): void;
/** The cabin and cockpit windows, through any mapping of fuselage space. */
export declare function paintGlass(livery: Livery, canvas: Canvas, geometry: Geometry, mapping: Mapping, group: Element): void;
export {};
