import type { Geometry } from './geometry.js';
import type { Area, Livery, Logo, Title } from './scheme.js';
/** Points over a title's box (its run and cap height) in fuselage space: along its foot, middle and top. */
export declare function titleBox(t: Title): [number, number][];
/**
 * The wing's outline from the side (its near half, in front of the body) in fuselage space: where a title would run
 * into it. Both layouts draw the side view linearly, so its pixels map straight back.
 */
export declare function wingOnBody(g: Geometry): [number, number][];
/**
 * A title clear of the wing where it was measured stays clear of it (Asiana's, under the windows on its A321neo, on a
 * 747's or an A380's longer wing root): moved forward until it clears, not past the cockpit's end, then made
 * smaller about its start if that isn't enough, to half its size.
 */
export declare function clearOfTheWing(measured: readonly Title[], fitted: Title[], from: Geometry, to: Geometry): Title[];
/**
 * The topmost area (seen from the left) under all of `points`, by index, if one is: where a title sits on one painted
 * area. An area drawn by `below` or `above` a line isn't counted.
 */
export declare function areaUnder(areas: readonly Area[], points: readonly [number, number][]): number | undefined;
/**
 * A title on one painted area where it was measured stays on it (Sun Country's white name on its orange): where the
 * fitted body has it running off the area, it's made smaller about the start of its foot until it fits, down to half
 * its size; one that crosses areas on purpose is left as it is.
 */
export declare function onTheirAreas(scheme: Livery, fitted: Title[], areas: readonly Area[]): Title[];
/**
 * Titles fitted one by one can run into each other where they grew (Qantas' name and "Spirit of Australia" on an
 * A380): a fuselage title that followed another on its row, with a gap, keeps that gap (in meters, grown with the
 * body as the titles are), moved aft if it has to.
 */
export declare function spaced(measured: Title[], fitted: Title[], from: Geometry, to: Geometry): Title[];
/** How far a fuselage title is from the paint, in meters up the side (docs/COORDINATES.md, Landmarks). */
export declare function paintClearance(g: Geometry, t: Title, areas: readonly Area[]): number;
/**
 * A title on the bare body where it was measured stays off the paint, with at least half its gap to it (in meters,
 * grown with the body): moved away from the nearer paint, up to just under an upper deck's windows (or short of the
 * crown) or down short of the belly, then made smaller about its middle if that isn't enough, to half its size
 * (American's red name, above the tri-color's stripes on the 737, stays off the blue's top edge on an A380).
 */
export declare function offThePaint(scheme: Livery, fitted: Title[], areas: readonly Area[], from: Geometry, to: Geometry): Title[];
/**
 * How far a fin title or logo is from the fin's leading edge, trailing edge and tip, in meters (negative where it's
 * past one); its foot may sit on the root, which the body covers.
 */
export declare function finClearance(g: Geometry, item: Title | Logo): number;
/**
 * A fin title or logo keeps clear of the fin's edges (and of a T-tail's tailplane across its top) as it was where measured (in meters, grown with the fin): a fin
 * swept or proportioned otherwise puts the same shares nearer an edge (Spirit's diagonal name, clear on its A320,
 * would crowd a 747's leading edge). Moved the least it takes, then made smaller (and moved) if that isn't enough, to
 * 30% of its size (a 727's fin, under its T-tail, is half an A320's height; Southwest's long diagonal name needs
 * that).
 */
export declare function clearOnTheFin<T extends Title | Logo>(item: T, from: Geometry, to: Geometry): T;
