import type { Geometry } from './geometry.js';
import type { Livery } from './scheme.js';
/** Fuselage x on `from` to fuselage x on `to`, piecewise between the landmarks both have (for areas, `paint`). */
export declare function alongBody(from: Geometry, to: Geometry, paint?: boolean): (x: number) => number;
/**
 * The scheme with its fuselage's paint, lettering and logos (and the belly's positions along the body) fitted from
 * the type it was measured on (`from`) to `to`. Lettering and logos are placed by their middles, sized with the
 * body and kept clear of the windows where they were; each title keeps its proportions in meters, its length on `to`
 * following its height there. Fin, wings, engines and winglets are in
 * their own parts' spaces and stay as they are.
 */
export declare function fitScheme(scheme: Livery, from: Geometry, to: Geometry): Livery;
