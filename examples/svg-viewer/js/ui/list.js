// The main list: one section of cards per airline, the sidebar's airline links (a select on phones) and the
// count. Cards draw their scheme only as they come near the viewport.
import { $, escapeHtml } from '../dom.js';
import { drawSide } from '../draw.js';
import { compareMatches, findMatches } from './search.js';
import { flownTagHtml, registrationsTagHtml, tagsHtml } from './tags.js';
/** Start drawing a card this far before it scrolls into view. */
const PRELOAD_MARGIN = '600px 0px';
export class SchemeList {
    dataset;
    observer;
    constructor(dataset) {
        this.dataset = dataset;
    }
    render(filters) {
        const main = $('#main');
        for (const group of main.querySelectorAll('.group'))
            group.remove();
        this.observer?.disconnect();
        this.observer = new IntersectionObserver((entries) => {
            this.drawVisible(entries);
        }, { rootMargin: PRELOAD_MARGIN });
        const matches = findMatches(this.dataset, filters);
        const groups = groupByAirline(matches);
        $('#empty').hidden = matches.length > 0;
        const sections = document.createDocumentFragment();
        for (const [airline, group] of groups)
            sections.appendChild(this.renderGroup(airline, group));
        main.appendChild(sections);
        this.renderAirlineLinks(groups);
        this.renderStats(matches.filter((m) => !m.flownBy).length);
    }
    renderGroup(airline, matches) {
        const section = document.createElement('section');
        section.className = 'group';
        section.id = `air-${airline}`;
        section.innerHTML = `<h2><code>${escapeHtml(airline)}</code><span>${escapeHtml(this.dataset.airlineName(airline))}</span></h2>
      <div class="cards own"></div><h3 class="also" hidden>Also flies in</h3><div class="cards flown"></div>`;
        const own = $('.cards.own', section);
        const flown = $('.cards.flown', section);
        for (const match of matches)
            (match.flownBy ? flown : own).appendChild(this.renderCard(match));
        // An airline flying only in others' paint (SkyWest) has no schemes of its own to head the section.
        $('.also', section).hidden = !own.childElementCount || !flown.childElementCount;
        return section;
    }
    renderCard({ scheme, registrations, flownBy }) {
        const card = document.createElement('button');
        card.className = 'card';
        card.dataset.id = scheme.id;
        card.innerHTML = `<div class="art" aria-hidden="true"></div>
      <h3>${escapeHtml(scheme.name)}</h3>
      <div class="tags">${flownBy ? flownTagHtml(flownBy.airframes) : tagsHtml(scheme)}${registrationsTagHtml(registrations)}</div>`;
        card.addEventListener('click', () => {
            location.hash = scheme.id;
        });
        this.observer?.observe(card);
        return card;
    }
    drawVisible(entries) {
        for (const entry of entries) {
            if (!entry.isIntersecting || !(entry.target instanceof HTMLElement))
                continue;
            this.observer?.unobserve(entry.target);
            void this.drawCard(entry.target);
        }
    }
    async drawCard(card) {
        const art = $('.art', card);
        try {
            const { drawn } = await this.dataset.drawable(card.dataset.id ?? '');
            if (drawn)
                art.appendChild(drawSide(drawn, 'left'));
        }
        catch {
            // A scheme that fails to load keeps an empty picture; the rest of the list still works.
            art.textContent = '';
        }
    }
    renderAirlineLinks(groups) {
        const links = [];
        const options = ['<option value="">Jump to airline…</option>'];
        for (const [airline, matches] of groups) {
            const code = escapeHtml(airline);
            const name = escapeHtml(this.dataset.airlineName(airline));
            links.push(`<a href="#air-${code}" data-air="${code}"><code>${code}</code><span class="hint">${name}</span><span class="n">${matches.length}</span></a>`);
            options.push(`<option value="${code}">${code} ${name}</option>`);
        }
        $('#airlines').innerHTML = links.join('');
        $('#jump').innerHTML = options.join('');
    }
    renderStats(matchCount) {
        const total = this.dataset.index.schemes.length;
        $('#stats').textContent =
            matchCount === total
                ? `${total} schemes, ${this.dataset.airlineCount} airlines`
                : `${matchCount} of ${total} schemes`;
    }
}
/**
 * Matches by airline (a borrowed scheme under the airline flying it), airlines in code order, each airline's
 * schemes in display order and the ones it also flies in after them.
 */
function groupByAirline(matches) {
    const groups = new Map();
    for (const match of matches) {
        const airline = match.flownBy?.airline ?? match.scheme.airline;
        const list = groups.get(airline) ?? [];
        list.push(match);
        groups.set(airline, list);
    }
    const airlines = [...groups.keys()].sort();
    const order = (a, b) => Number(!!a.flownBy) - Number(!!b.flownBy) ||
        (b.flownBy?.airframes ?? 0) - (a.flownBy?.airframes ?? 0) ||
        compareMatches(a, b);
    return new Map(airlines.map((airline) => [airline, (groups.get(airline) ?? []).sort(order)]));
}
