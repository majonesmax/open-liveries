import type { MeasuredShape } from './measured.js';
import type { Livery } from './scheme.js';
import type { AircraftShape } from './shape.js';
/**
 * Which of a scheme's `types` entries applies on a shape, by its key: the one keyed by the shape's id, else the first
 * keyed by one of the shape's ICAO types. Undefined on a built-in shape, or where none does.
 */
export declare function typeKeyFor(scheme: Livery, shape: AircraftShape | MeasuredShape): string | undefined;
/**
 * The scheme as painted on `shape`: where its `types` has an entry for the shape, that entry over the base (the
 * palette merged by name; each part's keys replacing the base part's, `areas` whole; `titles` and `logos` replacing
 * the base's lists whole), without `types`. Otherwise the scheme itself.
 */
export declare function schemeOn(scheme: Livery, shape: AircraftShape | MeasuredShape): Livery;
/** The scheme with its `types[key]` entry applied (as `schemeOn`), or without `types` where there's none. */
export declare function paintFor(scheme: Livery, key: string): Livery;
