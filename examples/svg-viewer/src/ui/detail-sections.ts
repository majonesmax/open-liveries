// The detail panel's sections for one scheme: its words, parts, titles, logos, palette and sources.

import { escapeHtml } from '../dom.js';
import type { Color, Evidence, Livery } from '../types.js';

const hexOf = (livery: Livery, color: Color): string =>
  color.startsWith('#') ? color : (livery.palette?.[color]?.hex ?? '');

/** A color swatch and its name. */
function colorCell(livery: Livery, color: Color | undefined): string {
  if (!color) return '';
  return `<span class="sw" style="background:${escapeHtml(hexOf(livery, color))}"></span>${escapeHtml(color)}`;
}

/** A color swatch alone, named in its tooltip. */
const swatch = (livery: Livery, color: Color): string =>
  `<span class="sw" title="${escapeHtml(color)}" style="background:${escapeHtml(hexOf(livery, color))}"></span>`;

/** Links to the scheme's numbered sources. */
const sourceLinks = (refs: number[] | undefined): string =>
  (refs ?? []).map((i) => `<a href="#src-${i}" data-src="${i}">[${i + 1}]</a>`).join(' ');

const sideNote = (side: string | undefined): string => (side && side !== 'both' ? `, ${escapeHtml(side)} side` : '');

const externalLink = (url: string, text: string): string =>
  `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${text}</a>`;

function table(headings: string[], rows: string[]): string {
  const head = headings.map((h) => `<th>${h}</th>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

export function proseHtml(livery: Livery): string {
  const paragraphs: string[] = [];
  if (livery.commemorates) paragraphs.push(`<p><b>Recreates:</b> ${escapeHtml(livery.commemorates)}</p>`);
  if (livery.description) paragraphs.push(`<p>${escapeHtml(livery.description)}</p>`);
  if (livery.notes) paragraphs.push(`<p class="muted">${escapeHtml(livery.notes)}</p>`);
  for (const [type, paint] of Object.entries(livery.types ?? {})) {
    const differs = paint.note ?? 'Painted differently.';
    paragraphs.push(`<p class="muted"><b>On the ${escapeHtml(type)}:</b> ${escapeHtml(differs)}</p>`);
  }
  if (livery.history) paragraphs.push(`<p class="muted"><b>History:</b> ${escapeHtml(livery.history)}</p>`);
  return `<div class="prose">${paragraphs.join('')}</div>`;
}

/** Each described part: its colors, confidence, how many areas and its sources. */
export function partsHtml(livery: Livery): string {
  const rows: string[] = [];
  const row = (
    name: string,
    part: (Evidence & { areas?: unknown[] }) | undefined,
    colors: (string | false | undefined)[],
  ): void => {
    if (!part) return;
    const areaCount = part.areas?.length ?? 0;
    rows.push(
      `<tr><td>${name}</td><td>${colors.filter(Boolean).join('<br>')}</td><td>${escapeHtml(part.confidence)}</td>` +
        `<td>${areaCount > 0 ? areaCount : ''}</td><td>${sourceLinks(part.sourceRefs)}</td></tr>`,
    );
  };
  const named = (label: string, color: Color | undefined): string | undefined =>
    color && `${label} ${colorCell(livery, color)}`;
  const { fuselage, fin, engines, wings, stabilizer, winglets } = livery;

  row('Fuselage', fuselage, [
    named('base', fuselage?.base),
    named('radome', fuselage?.radome?.color),
    fuselage?.windows && `windows ${escapeHtml(fuselage.windows)}`,
  ]);
  row('Fin', fin, [
    named('base', fin?.base),
    named('rudder', fin?.rudder),
    fin?.mirrored === false && 'right face not mirrored',
  ]);
  row('Engines', engines, [
    named('cowling', engines?.cowling),
    named('lip', engines?.inletLip),
    named('pylon', engines?.pylon),
  ]);
  row('Wings', wings, [named('top', wings?.top), named('under', wings?.under)]);
  row('Stabilizer', stabilizer, [named('top', stabilizer?.top), named('under', stabilizer?.under)]);
  row('Winglets', winglets, [named('outer', winglets?.outer), named('inner', winglets?.inner)]);
  if (!rows.length) return '';
  return `<h3>Parts</h3>${table(['Part', 'Colors', 'Confidence', 'Areas', 'Sources'], rows)}`;
}

export function titlesHtml(livery: Livery): string {
  if (!livery.titles?.length) return '';
  const rows = livery.titles.map((title) => {
    const similar = title.type?.similar
      ? `<br><span class="muted">like ${escapeHtml(title.type.similar.join(', '))}</span>`
      : '';
    return (
      `<tr><td>${colorCell(livery, title.color)}<br><b>${escapeHtml(title.text)}</b></td>` +
      `<td>${escapeHtml(title.place)}${sideNote(title.side)}</td>` +
      `<td>${escapeHtml(title.style)}${similar}</td>` +
      `<td>${escapeHtml(title.confidence)} ${sourceLinks(title.sourceRefs)}</td></tr>`
    );
  });
  return `<h3>Titles</h3>${table(['Text', 'Where', 'Lettering', 'Confidence'], rows)}`;
}

export function logosHtml(livery: Livery): string {
  if (!livery.logos?.length) return '';
  const rows = livery.logos.map((logo) => {
    const swatches = (logo.colors ?? []).map((c) => swatch(livery, c)).join('');
    const reference = logo.reference ? ` ${externalLink(logo.reference, 'see it')}` : '';
    return (
      `<tr><td class="mono">${escapeHtml(logo.mark)}<br>${swatches}</td>` +
      `<td>${escapeHtml(logo.place)}${sideNote(logo.side)}</td>` +
      `<td>${escapeHtml(logo.description)}${reference}</td>` +
      `<td>${escapeHtml(logo.confidence)} ${sourceLinks(logo.sourceRefs)}</td></tr>`
    );
  });
  return `<h3>Logos</h3>${table(['Mark', 'Where', 'What it looks like', 'Confidence'], rows)}`;
}

export function paletteHtml(livery: Livery): string {
  const entries = Object.entries(livery.palette ?? {});
  if (!entries.length) return '';
  const official = (value: boolean | undefined): string =>
    value === true ? 'yes' : value === false ? 'from photos' : '';
  const rows = entries.map(([name, color]) => {
    const pantone = color.pantone ? ` <span class="muted">Pantone ${escapeHtml(color.pantone)}</span>` : '';
    return (
      `<tr><td><span class="sw" style="background:${escapeHtml(color.hex)}"></span>${escapeHtml(name)}</td>` +
      `<td class="mono">${escapeHtml(color.hex)}</td>` +
      `<td>${escapeHtml(color.name)}${pantone}</td><td>${official(color.official)}</td></tr>`
    );
  });
  return `<h3>Palette</h3>${table(['Name', 'Hex', 'Airline’s name', 'Official'], rows)}`;
}

export function sourcesHtml(livery: Livery): string {
  const items = livery.sources.map((source, i) => {
    const accessed = source.accessed ? ` <span class="muted">(accessed ${escapeHtml(source.accessed)})</span>` : '';
    const note = source.note ? `<br><span class="muted">${escapeHtml(source.note)}</span>` : '';
    return `<li id="src-${i}">${externalLink(source.url, escapeHtml(source.title ?? source.url))}${accessed}${note}</li>`;
  });
  return `<h3>Sources</h3><ol class="sources">${items.join('')}</ol>`;
}
