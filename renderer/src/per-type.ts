// Paint for one type (a scheme's `types`, docs/COORDINATES.md › Paint for one type): the scheme as drawn on a
// measured shape, with the entry for that shape's type laid over its base paint.

import { isMeasuredShape } from './measured.js';
import type { MeasuredShape } from './measured.js';
import type { Livery, TypePaint } from './scheme.js';
import type { AircraftShape } from './shape.js';

const PARTS = ['fuselage', 'fin', 'stabilizer', 'wings', 'winglets', 'engines'] as const;

/**
 * Which of a scheme's `types` entries applies on a shape, by its key: the one keyed by the shape's id, else the first
 * keyed by one of the shape's ICAO types. Undefined on a built-in shape, or where none does.
 */
export function typeKeyFor(scheme: Livery, shape: AircraftShape | MeasuredShape): string | undefined {
  const types = scheme.types;
  if (!types || !isMeasuredShape(shape)) return undefined;
  if (types[shape.id]) return shape.id;
  return shape.types.find((type) => types[type]);
}

/**
 * The scheme as painted on `shape`: where its `types` has an entry for the shape, that entry over the base (the
 * palette merged by name; each part's keys replacing the base part's, `areas` whole; `titles` and `logos` replacing
 * the base's lists whole), without `types`. Otherwise the scheme itself.
 */
export function schemeOn(scheme: Livery, shape: AircraftShape | MeasuredShape): Livery {
  const key = typeKeyFor(scheme, shape);
  if (key === undefined) return scheme;
  return paintFor(scheme, key);
}

/** The scheme with its `types[key]` entry applied (as `schemeOn`), or without `types` where there's none. */
export function paintFor(scheme: Livery, key: string): Livery {
  const { types, ...base } = scheme;
  const paint: TypePaint | undefined = types?.[key];
  if (!paint) return base;
  const merged: Livery = { ...base };
  if (paint.palette) merged.palette = { ...base.palette, ...paint.palette };
  for (const part of PARTS) {
    const over = paint[part];
    if (over) Object.assign(merged, { [part]: { ...base[part], ...over } });
  }
  if (paint.titles) merged.titles = paint.titles;
  if (paint.logos) merged.logos = paint.logos;
  return merged;
}
