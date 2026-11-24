// The detail panel's airframes section: who wears the scheme, and operators flying in its paint.

import type { ListedAirframe } from '../data.js';
import { escapeHtml } from '../dom.js';
import type { Operator, SchemeSummary } from '../types.js';
import { dateRange } from './tags.js';

/** Rows shown before the rest fold under "N more". */
const SHOWN_AT_FIRST = 20;

const HEAD =
  '<table><thead><tr><th>Reg.</th><th>Address</th><th>Type</th><th>Wore it</th><th>Confidence</th>' +
  '<th>Sources</th><th>Notes</th></tr></thead><tbody>';
const TAIL = '</tbody></table>';

/** Current airframes first, then by registration. */
const byCurrentThenRegistration = (a: ListedAirframe, b: ListedAirframe): number =>
  (a.to ? 1 : 0) - (b.to ? 1 : 0) || a.registration.localeCompare(b.registration);

export function airframesHtml(
  scheme: SchemeSummary,
  airframes: ListedAirframe[],
  operators: [code: string, operator: Operator][],
): string {
  let html = airframes.length ? airframeTableHtml(scheme, airframes) : noAirframesText(scheme);
  if (operators.length) {
    const list = operators.map(
      ([code, operator]) => `<b>${escapeHtml(code)}</b> <span class="muted">${escapeHtml(operator.note)}</span>`,
    );
    html += `<p>Also flown by operators in this paint: ${list.join('; ')}</p>`;
  }
  return html;
}

function noAirframesText(scheme: SchemeSummary): string {
  return scheme.default
    ? 'Not listed one by one: every airframe of the airline that isn’t listed under another scheme wears this one.'
    : 'None listed.';
}

function airframeTableHtml(scheme: SchemeSummary, unsorted: ListedAirframe[]): string {
  const airframes = [...unsorted].sort(byCurrentThenRegistration);
  const row = (a: ListedAirframe): string => airframeRowHtml(a, scheme.airline);
  const current = airframes.filter((a) => !a.to).length;
  const past = airframes.length - current;
  let html = `<p>${current} current${past ? `, ${past} past` : ''}.</p>`;
  html += HEAD + airframes.slice(0, SHOWN_AT_FIRST).map(row).join('') + TAIL;
  if (airframes.length > SHOWN_AT_FIRST) {
    const rest = airframes.slice(SHOWN_AT_FIRST);
    html += `<details><summary>${rest.length} more</summary>${HEAD}${rest.map(row).join('')}${TAIL}</details>`;
  }
  return html;
}

function airframeRowHtml(a: ListedAirframe, schemeAirline: string): string {
  // Listed in another airline's file: a regional or an operator wearing this airline's scheme.
  const listedBy = a.listedBy !== schemeAirline ? ` <span class="muted">${escapeHtml(a.listedBy)}</span>` : '';
  const sources = a.sources
    .map((s, i) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${i + 1}</a>`)
    .join(' ');
  const notes = a.art ? `${a.art.name ?? ''} (${a.art.subject})` : (a.status ?? a.notes ?? '');
  return (
    `<tr><td><b>${escapeHtml(a.registration)}</b>${listedBy}</td><td class="mono">${escapeHtml(a.hex)}</td>` +
    `<td>${escapeHtml(a.type)}</td><td>${escapeHtml(dateRange(a.from, a.to))}</td><td>${escapeHtml(a.confidence)}</td>` +
    `<td>${sources}</td><td>${escapeHtml(notes)}</td></tr>`
  );
}
