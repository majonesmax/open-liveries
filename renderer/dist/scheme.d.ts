/** A three-letter ICAO airline code, e.g. "BAW". */
export type AirlineCode = string;
/** A scheme's id across the dataset: "ICAO/id", e.g. "BAW/standard" (liveries/BAW/standard.json). */
export type SchemeId = string;
/** A year, a year and month, or a day: "2019", "2019-04", "2019-04-22". */
export type PartialDate = string;
/** A palette name (e.g. "engineAqua") or a hex value written directly ("#1a2b3c"). */
export type Color = string;
/** [x, y] in the space of the part it's on (docs/COORDINATES.md). */
export type Point = readonly [x: number, y: number];
export type Kind = 'standard' | 'special' | 'retro' | 'alliance';
export type Confidence = 'high' | 'medium' | 'low' | 'approximate';
export type Side = 'both' | 'left' | 'right';
export interface Source {
    url: string;
    title?: string;
    accessed?: PartialDate;
    note?: string;
}
/** How sure a part or label is, and which of the livery's `sources` (by index) back it. */
export interface Evidence {
    confidence?: Confidence;
    sourceRefs?: number[];
}
export interface PaletteColor {
    hex: string;
    /** The airline's own name for it, if published. */
    name?: string;
    pantone?: string;
    ral?: string;
    /** True when published by the airline or its designers; false when matched from photos. */
    official?: boolean;
}
/** A point of an area's outline: [x, y], or [x, y, 1] for a sharp corner (docs/COORDINATES.md). */
export type AreaPoint = readonly [x: number, y: number, corner?: 1];
/**
 * A smooth fade across an area: the paint goes from stop to stop along the line from `from` to `to` in the part's own
 * space (on the fuselage as seen from the side, as its edges run), the same along every line square to it there.
 */
export interface Gradient {
    from: readonly [x: number, y: number];
    to: readonly [x: number, y: number];
    /** [offset, color]: offsets from 0 (at `from`) to 1 (at `to`), ascending. */
    stops: readonly (readonly [offset: number, color: Color])[];
}
interface AreaCommon extends Evidence {
    name?: string;
    /** Its paint; with a `gradient`, what a renderer without gradients (and the paint under lettering) uses. */
    color: Color;
    gradient?: Gradient;
    side?: Side;
    /** true: a smooth curve through the points, sharp at the part's edges and at [x, y, 1]. Default: straight lines. */
    smooth?: boolean;
}
/** A region painted over its part's base: a polygon, or everything under and/or over a line. */
export type Area = AreaCommon & ({
    points: AreaPoint[];
    below?: never;
    above?: never;
} | {
    points?: never;
    below: AreaPoint[];
    above?: AreaPoint[];
} | {
    points?: never;
    below?: AreaPoint[];
    above: AreaPoint[];
});
export interface Fuselage extends Evidence {
    base: Color;
    areas?: Area[];
    radome?: {
        color: Color;
        to?: number;
    };
    cockpitWindows?: {
        mask?: Color;
    };
    windows?: 'plain' | 'lined' | 'hidden';
}
export interface Fin extends Evidence {
    base: Color;
    rudder?: Color;
    /** The dorsal fillet's paint, where it isn't what the fin's leading edge carries forward. */
    fillet?: Color;
    areas?: Area[];
    /** False when the right face shows the left face's picture unreversed. Default true. */
    mirrored?: boolean;
}
/** A wing or the tailplane. */
export interface Surface extends Evidence {
    top?: Color;
    under?: Color;
    areas?: Area[];
}
export interface Winglets extends Evidence {
    outer?: Color;
    inner?: Color;
    areas?: Area[];
}
export interface Engines extends Evidence {
    cowling?: Color;
    inletLip?: Color;
    pylon?: Color;
    areas?: Area[];
}
export type LogoPlace = 'fin' | 'fuselage' | 'engines' | 'winglets' | 'wingUnder' | 'belly';
export type TitlePlace = 'fin' | 'fuselage' | 'engines' | 'belly';
/** Where a logo sits and how big it is. The artwork itself isn't in the dataset (docs/LOGOS.md). */
export interface Logo extends Evidence {
    /** An id shared across liveries, e.g. "DAL/widget". */
    mark: string;
    /** Whose artwork it is when it's licensed from someone other than the airline ("Disney"): never drawn from here. */
    licensed?: string;
    place: LogoPlace;
    /** The logo's center. */
    at: Point;
    height: number;
    colors?: Color[];
    description?: string;
    reference?: string;
    side?: Side;
}
/** The lettering, measured from photos: what to set it in to look right. */
export interface TitleType {
    similar?: string[];
    official?: string;
    weight?: number;
    slantDeg?: number;
    width?: 'condensed' | 'normal' | 'extended';
    strokes?: 'uniform' | 'contrast' | 'brush';
    case?: 'upper' | 'lower' | 'mixed';
    /** Lowercase height as a share of the cap height, measured (about 0.7 in most typefaces). */
    xHeight?: number;
}
export interface TitlePart {
    text: string;
    color: Color;
}
export interface Title extends Evidence {
    text: string;
    place: TitlePlace;
    /** The left end of the baseline as seen from the left side (on the belly: the start of its middle line). */
    at: Point;
    /** Cap height. */
    height: number;
    color: Color;
    /** A name lettered in more than one color ("Fed" purple, "Ex" orange): runs that spell `text`, each its own color. */
    parts?: TitlePart[];
    style?: string;
    side?: Side;
    /** How far the text is spread to run, as a share of the part's x. */
    length?: number;
    type?: TitleType;
    rotationDeg?: number;
    /**
     * A wordmark no typeface comes close to, drawn as a mark (an id as a logo's) in the title's box where the renderer's
     * logo painter has it: its baseline at the box's foot, its cap height the box's, stretched to `length`. Else the
     * text, as any title.
     */
    mark?: string;
    /**
     * The aircraft's own registration or number is lettered here (a military or government aircraft's serial): `text`
     * is the measured aircraft's; an app that knows the aircraft's registration letters that instead.
     */
    registration?: boolean;
}
/**
 * Paint that differs on one type (a scheme's `types`, keyed by a shape id from shapes/, which is also the type the
 * entry's shares were measured on): laid over the scheme's own paint where it's drawn on that type. Each part given
 * replaces the base part's keys it names (`areas` whole); `titles` and `logos` replace the base's lists whole; the
 * palette merges by name.
 */
export interface TypePaint extends Evidence {
    /** What differs on this type, and from which photos. */
    note?: string;
    palette?: Record<string, PaletteColor>;
    fuselage?: Partial<Fuselage>;
    fin?: Partial<Fin>;
    stabilizer?: Surface;
    wings?: Surface;
    winglets?: Winglets;
    engines?: Engines;
    logos?: Logo[];
    titles?: Title[];
}
/** One paint scheme: liveries/<airline>/<id>.json. Without `fuselage` it's described in words only. */
export interface Livery {
    $schema?: string;
    /** Unique within the airline, e.g. "standard-2019". */
    id: string;
    airline: AirlineCode;
    name: string;
    kind: Kind;
    from?: PartialDate;
    to?: PartialDate;
    commemorates?: string;
    description?: string;
    confidence: Confidence;
    sources: Source[];
    palette?: Record<string, PaletteColor>;
    finish?: 'gloss' | 'matte' | 'metallic' | 'bareMetal';
    fuselage?: Fuselage;
    fin?: Fin;
    stabilizer?: Surface;
    wings?: Surface;
    winglets?: Winglets;
    engines?: Engines;
    logos?: Logo[];
    titles?: Title[];
    notes?: string;
    history?: string;
    commonest?: boolean;
    /** The aircraft type (ICAO designator) the geometry was measured on; draw on shapes/ for it where there is one. */
    drawnOn?: string;
    /** Paint that differs on a type, by shape id (or ICAO type): see `TypePaint`. */
    types?: Record<string, TypePaint>;
}
export {};
