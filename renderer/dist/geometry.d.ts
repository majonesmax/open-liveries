import type { AreaPoint, Point } from './scheme.js';
import type { AircraftShape } from './shape.js';
export declare const VIEW_WIDTH = 1000;
export declare const NOSE_X = 50;
export declare const FUSELAGE_PIXELS = 900;
export declare const MARGIN = 14;
/** A parametric shape's cabin windows: their bottom and top in fuselage y. */
export declare const WINDOW_BAND: readonly [0.05, 0.2];
export declare const clamp: (v: number, min: number, max: number) => number;
export declare const lerp: (a: number, b: number, t: number) => number;
export declare const lerpPoint: (a: Point, b: Point, t: number) => Point;
/**
 * Round the fuselage, y is an angle and a side view draws it at height sin(y·90°) (COORDINATES.md): `toHeight` is
 * that height as a share of the radius, `fromHeight` turns one back to y.
 */
export declare const toHeight: (y: number) => number;
export declare const fromHeight: (h: number) => number;
/** Maps a part's own coordinates to pixels. */
export type Mapping = (x: number, y: number) => Point;
/** A rectangle in a part's own coordinates. */
export declare const rect: (x0: number, y0: number, x1: number, y1: number) => Point[];
/** Whether a point is inside a polygon (even-odd); an area's corner flags are ignored. */
export declare function inside([px, py]: AreaPoint, poly: readonly AreaPoint[]): boolean;
/** Which half of the below view: the aircraft's left side (top) or right side (bottom). */
export type Half = 'left' | 'right';
export declare const HALVES: readonly Half[];
/** +1 for the bottom half of the below view, −1 for the top. */
export declare const halfSign: (half: Half) => number;
/** One engine, in pixels: nacelle front and back x, center y in the side view, half height, lateral in the below view. */
export interface EngineGeometry {
    x0: number;
    x1: number;
    centerY: number;
    halfHeight: number;
    lateral: number;
    /** Hung under the wing (with a pylon up to it), rather than on the fuselage. */
    underWing: boolean;
    /**
     * Where the fan cowl ends, as a share of the nacelle from its inlet (0) to its exhaust (1): behind it the core and
     * nozzle, bare metal whatever the scheme paints (a measured shape's `cowlEnd`).
     */
    cowlEnd?: number;
    /** Where the pylon meets the wing, in side-view pixels. */
    wingY: number;
    /** The wing's leading edge at the engine's lateral, in pixels (the below view's pylon reaches it). */
    wingLeadingX: number;
    /**
     * On the fuselage (a rear-engined type): its stub pylon, from the fuselage's side out into the nacelle. `side` is
     * its outline in the side view (left side, pixels), mostly behind the nacelle; `below` its plan in the below view;
     * `root` where its trailing part meets the fuselage, in fuselage space (whose paint it takes, unless the scheme
     * names its colour).
     */
    stubPylon?: {
        side: Point[];
        below: (half: Half) => Point[];
        root: Point;
    };
    /**
     * A propeller ahead of the nacelle (a turboprop's), in pixels: its disc seen edge on (a thin lens, drawn faint) and
     * its spinner, in the side view (left side) and in the below view.
     */
    propeller?: {
        disc: Point[];
        spinner: Point[];
        below: (half: Half) => {
            disc: Point[];
            spinner: Point[];
        };
    };
    /** From below, the nacelle's half width in pixels, where it isn't round (a turboprop's); else 0.8 of its half height. */
    belowHalfWidth?: number;
}
/** A shape laid out in pixels, with the mappings from each part's space. */
export interface Geometry {
    shape: AircraftShape;
    sideHeight: number;
    belowHeight: number;
    /** Pixels per meter. */
    scale: number;
    radius: number;
    fuselageLength: number;
    centerY: number;
    belowCenterY: number;
    /** Fuselage x (0 nose → 1 tail) to pixels. */
    fuselageX: (x: number) => number;
    /** Meters back from the nose, as fuselage x. */
    share: (meters: number) => number;
    fuselagePoint: (x: number, y: number) => Point;
    /** The crown's and the belly's heights above the centerline at fuselage x, in meters (the belly's is negative). */
    profile: (x: number) => {
        crown: number;
        belly: number;
    };
    finChord: (fy: number) => Point;
    finSpan: number;
    finPoint: (fx: number, fy: number) => Point;
    engines: EngineGeometry[];
    enginePoint: (engine: EngineGeometry, nx: number, ny: number) => Point;
    wingSide: Point[];
    /** The near wing's flap track fairings from the side (a measured shape's; none on a built-in one). */
    fairingsSide: Point[][];
    stabilizerSide: Point[];
    winglet?: {
        height: number;
        chord: number;
        point: (x: number, y: number) => Point;
    };
    bellyPoint: (x: number, y: number, half: Half) => Point;
    wingUnderPoint: (x: number, y: number, half: Half) => Point;
    wingUnderSpan: number;
    tailplaneBelow: (half: Half) => Point[];
    /**
     * The cabin windows' band in fuselage y (bottom, top): the main deck's (none on a freighter without them), and a
     * second deck's where it's on the main tube, with the fuselage x it runs over (the A380's whole length, a 747's
     * front). A scheme drawn on another type is fitted to these. A measured shape's main row is at one height in
     * meters all along (`heights`, as `profile`'s), so its band in y moves where the body tapers. `line`: where they
     * are, or would be on a type without them that says (a freighter: its passenger version's), in meters.
     */
    windows: {
        main?: [number, number];
        heights?: [number, number];
        line?: [number, number];
        /** A type without windows: where its first and last would run (fuselage x), its passenger version's. */
        wouldBe?: [number, number];
        /** The flight deck's lowest pane, in meters (a measured shape's). */
        flightDeck?: number;
        upper?: {
            band: [number, number];
            along: [number, number];
        };
    };
    /** What a measured shape (shapes/, measured.ts) has that a parametric one leaves to the views' defaults. */
    measured?: MeasuredDetail;
}
export interface MeasuredDetail {
    /** Fuselage x positions (0 nose → 1 tail) its outline is drawn through: every measured point. */
    fuselageSamples: number[];
    /** The fin's outline in side-view pixels (left side), its fillet included, from inside the fuselage round. */
    finOutline: Point[];
    /** It has a dorsal fillet: paint at the fin's leading edge (x 0) carries forward over it. */
    finFillet?: true;
    /** The rudder's hinge as a share of the fin's chord at each height (else about 0.7). */
    rudderShare?: (fy: number) => number;
    /** The wing's plan outline in the below view. */
    wingBelow: (half: Half) => Point[];
    /** Each cabin window and cockpit pane as measured, in fuselage space. */
    glass: {
        cabin: Point[][];
        cockpit: Point[][];
    };
    /** Each door as measured: its kind and its outline in fuselage space. */
    doors: Door[];
    /**
     * An upper deck above the main tube (a 747's hump), in the side view's pixels (left side): its x range as shares
     * of the fuselage, its outline (its top, then back along the main crown), and the glass and doors on it.
     */
    hump?: {
        from: number;
        to: number;
        outline: Point[];
        glass: {
            cabin: Point[][];
            cockpit: Point[][];
        };
        doors: Door[];
    };
    /** Engines on the tail's centerline (the MD-11's, the 727's): see TailEngine. */
    tailEngines?: TailEngine[];
}
/**
 * An engine on the tail's centerline, in pixels (the side view's left side, the below view's): drawn over the fuselage
 * and the fin's foot, wearing the fin's paint carried down (docs/COORDINATES.md).
 */
export interface TailEngine {
    /** Through its nacelle (`straight`: the MD-11's, the fin on its top), or an S-duct's intake on the crown (`s`). */
    duct: 'straight' | 's';
    /** From the side: the nacelle with the fairing over its nozzle and its strut down to the crown, or the intake. */
    outline: Point[];
    /** From the side: a band over its foremost 4%, the inlet lip. */
    lip: Point[];
    /** From the side: the bare exhaust, where it shows. */
    nozzle?: Point[];
    /** From below: the nacelle's plan ahead of its cowl's end, and the bare core and nozzle behind it. */
    below?: Point[];
    belowNozzle?: Point[];
    /** Its outline's forward and aft ends, in pixels. */
    x: [number, number];
}
export interface Door {
    kind: 'door' | 'exit' | 'cargo';
    /** The one side it's on, where it isn't on both. */
    side?: 'left' | 'right';
    /** Its outline in fuselage space, corners rounded. */
    outline: Point[];
    /** A main door's small window, in fuselage space. */
    window?: Point[];
}
/**
 * A door's outline from its edges (metres back, metres up), its corners rounded by `round` metres, each point turned
 * into fuselage space by `toFuselage`. A main door gets its small window, high and centred.
 */
export declare function doorShape(kind: Door['kind'], [x0, x1]: [number, number], [z0, z1]: [number, number], toFuselage: (p: Point) => Point): Door;
/** The fuselage's half height at fuselage x, in meters. */
export declare const fuselageRadiusAt: (g: Geometry, x: number) => number;
/** The upper deck's window band, if it runs over any of fuselage x0 to x1 (the A380's whole length, a 747's front). */
export declare function deckAt(g: Geometry, [x0, x1]: [number, number]): [number, number] | undefined;
export declare function layout(shape: AircraftShape): Geometry;
