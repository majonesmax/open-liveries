// The small tags under a scheme's name: default, kind, confidence, dates, airframes, described only.
import { escapeHtml } from '../dom.js';
/** "2013-01–", "?–2020", or "" with neither date. */
export function dateRange(from, to) {
    return from || to ? `${from ?? '?'}–${to ?? ''}` : '';
}
const tag = (text, variant = '') => `<span class="tag${variant ? ` ${variant}` : ''}">${escapeHtml(text)}</span>`;
export function tagsHtml(scheme) {
    const tags = [];
    if (scheme.default)
        tags.push(tag('default', 'def'));
    tags.push(tag(scheme.kind), tag(scheme.confidence));
    const dates = dateRange(scheme.from, scheme.to);
    if (dates)
        tags.push(tag(dates));
    if (scheme.airframes)
        tags.push(tag(`${scheme.airframes} airframe${scheme.airframes > 1 ? 's' : ''}`));
    if (!scheme.drawn)
        tags.push(tag('described only', 'warn'));
    return tags.join('');
}
/** "Flies 8 jets in it", on another airline's scheme listed under the airline that flies it. */
export function flownTagHtml(airframes) {
    return tag(`flies ${airframes} jet${airframes > 1 ? 's' : ''} in it`, 'def');
}
/** A tag listing up to three registrations the search matched. */
export function registrationsTagHtml(registrations) {
    if (!registrations.length)
        return '';
    const shown = registrations.slice(0, 3).join(', ') + (registrations.length > 3 ? '…' : '');
    return tag(shown, 'warn');
}
