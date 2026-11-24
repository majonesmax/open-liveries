// Loading the dataset. The site is static and can't list folders, so it reads index.json (tools/index.py)
// first, then each scheme's JSON when it's needed. Paths are from the repository root.

import type { Shape } from '../../../renderer/dist/index.js';
import type { AirframesFile, Airframe, AirlineCode, DatasetIndex, Livery, SchemeId, SchemeSummary } from './types.js';

/** The repository root, relative to examples/svg-viewer/. */
const ROOT = '../../';

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(ROOT + path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** The index and lookups over it. */
export class Dataset {
  private readonly schemesById: Map<SchemeId, SchemeSummary>;
  private readonly liveries = new Map<SchemeId, Promise<Livery>>();
  private readonly shapes = new Map<string, Promise<Shape>>();
  private airframes: Promise<Map<SchemeId, ListedAirframe[]>> | undefined;

  private constructor(readonly index: DatasetIndex) {
    this.schemesById = new Map(index.schemes.map((s) => [s.id, s]));
  }

  static async load(): Promise<Dataset> {
    return new Dataset(await fetchJson<DatasetIndex>('index.json'));
  }

  summary(id: SchemeId): SchemeSummary | undefined {
    return this.schemesById.get(id);
  }

  /** The airline's default scheme (docs/COORDINATES.md › The airline's default scheme). */
  defaultScheme(airline: AirlineCode): SchemeSummary | undefined {
    return this.index.schemes.find((s) => s.airline === airline && s.default);
  }

  /** The airline's name from airlines.json; failing that, its default scheme's title, e.g. "American". */
  airlineName(airline: AirlineCode): string {
    return this.index.airlines[airline]?.name ?? this.defaultScheme(airline)?.title ?? '';
  }

  /** How many airlines have schemes. */
  get airlineCount(): number {
    return new Set(this.index.schemes.map((s) => s.airline)).size;
  }

  /** The measured shape (shapes/) for the type a scheme was measured on, if there is one: its id and name. */
  measuredFor(scheme: SchemeSummary): { id: string; name: string } | undefined {
    const type = scheme.drawnOn;
    if (!type) return undefined;
    // The shape whose id is the designator first (B763, the 767-300F, before B763-passenger), then any serving it.
    return this.index.shapes.find((s) => s.id === type) ?? this.index.shapes.find((s) => s.types.includes(type));
  }

  /** A measured shape's JSON, fetched once. */
  shape(id: string): Promise<Shape> {
    let shape = this.shapes.get(id);
    if (!shape) {
      shape = fetchJson<Shape>(`shapes/${id}.json`);
      this.shapes.set(id, shape);
    }
    return shape;
  }

  /** A scheme's full JSON, fetched once. */
  livery(id: SchemeId): Promise<Livery> {
    let livery = this.liveries.get(id);
    if (!livery) {
      livery = fetchJson<Livery>(`liveries/${id}.json`);
      this.liveries.set(id, livery);
    }
    return livery;
  }

  /**
   * The scheme and what to draw for it: itself, or, when it's described in words only (no fuselage), its
   * airline's default. A scheme with only a fin is drawn as it is; `drawn` is undefined when there's nothing.
   */
  async drawable(id: SchemeId): Promise<Drawable> {
    const livery = await this.livery(id);
    if (livery.fuselage) return { livery, drawn: livery };
    const fallback = this.defaultScheme(livery.airline);
    if (fallback && fallback.id !== id) {
      const drawn = await this.livery(fallback.id);
      if (drawn.fuselage) return { livery, drawn, fallbackId: fallback.id };
    }
    return livery.fin ? { livery, drawn: livery } : { livery };
  }

  /** Every listed airframe, keyed by the scheme it wears. All the files load on first use. */
  airframesByScheme(): Promise<Map<SchemeId, ListedAirframe[]>> {
    this.airframes ??= Promise.all(
      this.index.airframeFiles.map((code) => fetchJson<AirframesFile>(`airframes/${code}.json`).catch(() => undefined)),
    ).then(groupAirframes);
    return this.airframes;
  }
}

export interface Drawable {
  livery: Livery;
  drawn?: Livery;
  /** Set when `drawn` is the airline's default standing in for a scheme described in words only. */
  fallbackId?: SchemeId;
}

/** An airframe and the airline whose file lists it (a regional can wear its mainline's scheme). */
export interface ListedAirframe extends Airframe {
  listedBy: AirlineCode;
}

function groupAirframes(files: (AirframesFile | undefined)[]): Map<SchemeId, ListedAirframe[]> {
  const bySchemeId = new Map<SchemeId, ListedAirframe[]>();
  for (const file of files) {
    if (!file) continue;
    for (const airframe of file.airframes) {
      // "id" is the file's own airline's scheme; "ICAO/id" another airline's.
      const id = airframe.livery.includes('/') ? airframe.livery : `${file.airline}/${airframe.livery}`;
      const list = bySchemeId.get(id) ?? [];
      list.push({ ...airframe, listedBy: file.airline });
      bySchemeId.set(id, list);
    }
  }
  return bySchemeId;
}
