// Which schemes match the search box and filters, and their order within an airline.
export const KINDS = ['standard', 'special', 'retro', 'alliance'];
/** Case, spaces and hyphens don't count: "n317as", "N317AS" and "N-317AS" are the same. */
const normalize = (s) => (s ?? '').toLowerCase().replace(/[-\s]/g, '');
/**
 * Each airline's own schemes, then the ones it also flies in (index.json's alsoFlies), listed under it too.
 *
 * A scheme matches on its id, name, title, airline code or airline name (an exact airline code matches only that
 * airline); on a registration (three characters or more) currently wearing it; or on the exact code of an
 * operator that flies in it.
 */
export function findMatches(dataset, filters) {
    const query = normalize(filters.query.trim());
    const byRegistration = query.length >= 3 ? registrationsMatching(dataset, query) : new Map();
    const worn = query.length === 3 ? schemesWornByOperator(dataset, query) : new Set();
    // An airline's exact code ("asa") means that airline, not every name with those letters in it (Atlas Air).
    const code = query.toUpperCase();
    const exactAirline = query.length === 3 && code in dataset.index.airlines;
    const matches = [];
    for (const scheme of dataset.index.schemes) {
        if (filters.kinds.size && !filters.kinds.has(scheme.kind))
            continue;
        if (filters.drawnOnly && !scheme.drawn)
            continue;
        const registrations = byRegistration.get(scheme.id);
        const text = exactAirline ? scheme.airline === code : schemeMatches(dataset, scheme, query);
        const hit = !query || text || !!registrations || worn.has(scheme.id);
        if (hit)
            matches.push({ scheme, registrations: registrations ?? [] });
    }
    // Under the airline that flies it, a borrowed scheme matches on that airline as well as on itself.
    const matched = new Set(matches.map((m) => m.scheme.id));
    for (const [airline, flown] of Object.entries(dataset.index.alsoFlies)) {
        const airlineHit = exactAirline ? airline === code : textMatches(dataset, airline, query);
        for (const { scheme: id, airframes } of flown) {
            const scheme = dataset.summary(id);
            if (!scheme)
                continue;
            if (filters.kinds.size && !filters.kinds.has(scheme.kind))
                continue;
            if (filters.drawnOnly && !scheme.drawn)
                continue;
            if (query && !airlineHit && !matched.has(id))
                continue;
            matches.push({ scheme, registrations: [], flownBy: { airline, airframes } });
        }
    }
    return matches;
}
function schemeMatches(dataset, scheme, query) {
    const fields = [scheme.id, scheme.name, scheme.title, scheme.airline, dataset.airlineName(scheme.airline)];
    return fields.map(normalize).join('|').includes(query);
}
function textMatches(dataset, airline, query) {
    return [airline, dataset.airlineName(airline)].map(normalize).join('|').includes(query);
}
function registrationsMatching(dataset, query) {
    const bySchemeId = new Map();
    for (const [registration, id] of Object.entries(dataset.index.registrations)) {
        if (!normalize(registration).includes(query))
            continue;
        const list = bySchemeId.get(id) ?? [];
        list.push(registration);
        bySchemeId.set(id, list);
    }
    return bySchemeId;
}
function schemesWornByOperator(dataset, query) {
    const worn = new Set();
    for (const [code, operator] of Object.entries(dataset.index.operators)) {
        if (code.toLowerCase() === query)
            worn.add(operator.wears);
    }
    return worn;
}
const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** The default scheme first, then by kind, current before retired, then by name. */
export function compareMatches({ scheme: a }, { scheme: b }) {
    return (Number(b.default) - Number(a.default) ||
        KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) ||
        Number(!!a.to) - Number(!!b.to) ||
        compareText(a.name.toLowerCase(), b.name.toLowerCase()));
}
