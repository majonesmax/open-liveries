// Which schemes match the search box and filters, and their order within an airline.

import type { Dataset } from '../data.js';
import type { AirlineCode, Kind, SchemeId, SchemeSummary } from '../types.js';

export const KINDS: readonly Kind[] = ['standard', 'special', 'retro', 'alliance'];

export interface Filters {
  query: string;
  /** Kinds to show; empty shows every kind. */
  kinds: Set<Kind>;
  drawnOnly: boolean;
}

export interface Match {
  scheme: SchemeSummary;
  /** Registrations the query matched that currently wear this scheme. */
  registrations: string[];
  /** Set when it's another airline's scheme listed under this one, which flies `airframes` jets in it. */
  flownBy?: { airline: AirlineCode; airframes: number };
}

/** Case, spaces and hyphens don't count: "n317as", "N317AS" and "N-317AS" are the same. */
const normalize = (s: string | undefined): string => (s ?? '').toLowerCase().replace(/[-\s]/g, '');

/**
 * Each airline's own schemes, then the ones it also flies in (index.json's alsoFlies), listed under it too.
 *
 * A scheme matches on its id, name, title, airline code or airline name (an exact airline code matches only that
 * airline); on a registration (three characters or more) currently wearing it; or on the exact code of an
 * operator that flies in it.
 */
export function findMatches(dataset: Dataset, filters: Filters): Match[] {
  const query = normalize(filters.query.trim());
  const byRegistration = query.length >= 3 ? registrationsMatching(dataset, query) : new Map<SchemeId, string[]>();
  const worn = query.length === 3 ? schemesWornByOperator(dataset, query) : new Set<SchemeId>();
  // An airline's exact code ("asa") means that airline, not every name with those letters in it (Atlas Air).
  const code = query.toUpperCase();
  const exactAirline = query.length === 3 && code in dataset.index.airlines;

  const matches: Match[] = [];
  for (const scheme of dataset.index.schemes) {
    if (filters.kinds.size && !filters.kinds.has(scheme.kind)) continue;
    if (filters.drawnOnly && !scheme.drawn) continue;
    const registrations = byRegistration.get(scheme.id);
    const text = exactAirline ? scheme.airline === code : schemeMatches(dataset, scheme, query);
    const hit = !query || text || !!registrations || worn.has(scheme.id);
    if (hit) matches.push({ scheme, registrations: registrations ?? [] });
  }
  // Under the airline that flies it, a borrowed scheme matches on that airline as well as on itself.
  const matched = new Set(matches.map((m) => m.scheme.id));
  for (const [airline, flown] of Object.entries(dataset.index.alsoFlies)) {
    const airlineHit = exactAirline ? airline === code : textMatches(dataset, airline, query);
    for (const { scheme: id, airframes } of flown) {
      const scheme = dataset.summary(id);
      if (!scheme) continue;
      if (filters.kinds.size && !filters.kinds.has(scheme.kind)) continue;
      if (filters.drawnOnly && !scheme.drawn) continue;
      if (query && !airlineHit && !matched.has(id)) continue;
      matches.push({ scheme, registrations: [], flownBy: { airline, airframes } });
    }
  }
  return matches;
}

function schemeMatches(dataset: Dataset, scheme: SchemeSummary, query: string): boolean {
  const fields = [scheme.id, scheme.name, scheme.title, scheme.airline, dataset.airlineName(scheme.airline)];
  return fields.map(normalize).join('|').includes(query);
}

function textMatches(dataset: Dataset, airline: AirlineCode, query: string): boolean {
  return [airline, dataset.airlineName(airline)].map(normalize).join('|').includes(query);
}

function registrationsMatching(dataset: Dataset, query: string): Map<SchemeId, string[]> {
  const bySchemeId = new Map<SchemeId, string[]>();
  for (const [registration, id] of Object.entries(dataset.index.registrations)) {
    if (!normalize(registration).includes(query)) continue;
    const list = bySchemeId.get(id) ?? [];
    list.push(registration);
    bySchemeId.set(id, list);
  }
  return bySchemeId;
}

function schemesWornByOperator(dataset: Dataset, query: string): Set<SchemeId> {
  const worn = new Set<SchemeId>();
  for (const [code, operator] of Object.entries(dataset.index.operators)) {
    if (code.toLowerCase() === query) worn.add(operator.wears);
  }
  return worn;
}

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The default scheme first, then by kind, current before retired, then by name. */
export function compareMatches({ scheme: a }: Match, { scheme: b }: Match): number {
  return (
    Number(b.default) - Number(a.default) ||
    KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) ||
    Number(!!a.to) - Number(!!b.to) ||
    compareText(a.name.toLowerCase(), b.name.toLowerCase())
  );
}
