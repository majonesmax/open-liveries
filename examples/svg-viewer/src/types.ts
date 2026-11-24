// The dataset's files as the viewer reads them: schemes' types come from the renderer (renderer/src/scheme.ts);
// the rest are modeled on schema/airframes.schema.json, schema/airlines.schema.json and the index.json that
// tools/index.py writes. The schemas are the authority: these types only describe what they already guarantee.

import type { AirlineCode, Confidence, Kind, PartialDate, SchemeId, Source } from '../../../renderer/dist/index.js';

export type * from '../../../renderer/dist/index.js';

export type ArtFamily =
  | 'bear'
  | 'deer'
  | 'canine'
  | 'cat'
  | 'songbird'
  | 'raptor'
  | 'waterbird'
  | 'marine'
  | 'fish'
  | 'whale'
  | 'sheep'
  | 'bison'
  | 'small'
  | 'reptile'
  | 'horse'
  | 'other';

/** Artwork that differs on every airframe of a scheme (Frontier's tail animals). */
export interface AirframeArt {
  name?: string;
  subject: string;
  family: ArtFamily;
  colors?: string[];
  place?: 'fin';
}

export interface Airframe {
  registration: string;
  /** ICAO 24-bit address, lowercase hex. */
  hex?: string;
  /** ICAO type designator, e.g. "B738". */
  type?: string;
  /** "id" for the file's own airline's scheme, or "ICAO/id" for another airline's. */
  livery: string;
  from?: PartialDate;
  to?: PartialDate;
  lastSeen?: PartialDate;
  confidence: 'high' | 'medium' | 'low';
  sources: Source[];
  notes?: string;
  hexSource?: string;
  status?: string;
  art?: AirframeArt;
}

/** airframes/<airline>.json */
export interface AirframesFile {
  $schema?: string;
  airline: AirlineCode;
  airframes: Airframe[];
}

/** An entry in airlines.json. */
export interface Airline {
  name: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
}

/** An operator flying in another airline's paint (operators.json). */
export interface Operator {
  wears: SchemeId;
  note?: string;
}

/** One scheme's line in index.json. */
export interface SchemeSummary {
  id: SchemeId;
  airline: AirlineCode;
  name: string;
  kind: Kind;
  confidence: Confidence;
  from?: PartialDate;
  to?: PartialDate;
  commonest: boolean;
  /** Has colored areas to draw (a fuselage, or fin areas). */
  drawn: boolean;
  /** The aircraft type it was measured on (ICAO designator), when recorded. */
  drawnOn?: string;
  /** Its first fuselage title, e.g. "American". */
  title?: string;
  /** The scheme an app showing one per airline uses (docs/COORDINATES.md). */
  default: boolean;
  /** How many airframes currently listed as wearing it. */
  airframes: number;
}

/** index.json at the repository root, written by tools/index.py. */
export interface DatasetIndex {
  schemes: SchemeSummary[];
  airlines: Record<AirlineCode, Airline>;
  operators: Record<AirlineCode, Operator>;
  /** The airlines with a file in airframes/. */
  airframeFiles: AirlineCode[];
  /** Each current registration and the scheme it wears. */
  registrations: Record<string, SchemeId>;
  /** Per airline, other airlines' schemes its tagged jets fly in, most-flown first. */
  alsoFlies: Record<AirlineCode, { scheme: SchemeId; airframes: number }[]>;
  /** The measured types in shapes/, each with the type designators it's for. */
  shapes: { id: string; name: string; types: string[] }[];
}
