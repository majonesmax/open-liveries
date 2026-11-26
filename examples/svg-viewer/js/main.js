// Open Liveries viewer: wires the search box, filters and URL to the list and the detail panel.
// URL: ?q=search keeps the search; #ICAO/id opens a scheme; #air-ICAO scrolls to an airline.
import { Dataset } from './data.js';
import { $, $as, escapeHtml } from './dom.js';
import { aboutIsOpen, setUpAbout } from './ui/about.js';
import { DetailPanel, hashId } from './ui/detail.js';
import { SchemeList } from './ui/list.js';
import { KINDS } from './ui/search.js';
// An airline's ICAO code, or a departed airline's two characters and founding year (BN1984), as schema/ has it.
const SCHEME_ID = /^([A-Z]{3}|[A-Z0-9]{2}[0-9]{4})\/[a-z0-9-]+$/;
/** Wait this long after the last keystroke before searching. */
const SEARCH_DELAY_MS = 120;
const isKind = (value) => KINDS.includes(value);
async function main() {
    const dataset = await Dataset.load();
    const list = new SchemeList(dataset);
    const detail = new DetailPanel(dataset);
    const filters = {
        query: new URLSearchParams(location.search).get('q') ?? '',
        kinds: new Set(),
        drawnOnly: false,
    };
    const render = () => {
        list.render(filters);
    };
    const route = () => {
        const hash = hashId();
        if (SCHEME_ID.test(hash)) {
            void detail.open(hash);
            return;
        }
        detail.close();
        if (hash.startsWith('air-'))
            document.getElementById(hash)?.scrollIntoView();
    };
    const closeDetail = () => {
        history.pushState(null, '', location.pathname + location.search);
        route();
    };
    const search = $as('#q', HTMLInputElement);
    search.value = filters.query;
    let searchTimer;
    search.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            filters.query = search.value;
            keepQueryInUrl(filters.query);
            render();
        }, SEARCH_DELAY_MS);
    });
    for (const chip of document.querySelectorAll('.chip[data-kind]')) {
        chip.addEventListener('click', () => {
            const kind = chip.dataset.kind;
            if (!isKind(kind))
                return;
            if (!filters.kinds.delete(kind))
                filters.kinds.add(kind);
            chip.setAttribute('aria-pressed', String(filters.kinds.has(kind)));
            render();
        });
    }
    const drawnOnly = $as('#drawn', HTMLButtonElement);
    drawnOnly.addEventListener('click', () => {
        filters.drawnOnly = !filters.drawnOnly;
        drawnOnly.setAttribute('aria-pressed', String(filters.drawnOnly));
        render();
    });
    const jump = $as('#jump', HTMLSelectElement);
    jump.addEventListener('change', () => {
        if (jump.value)
            document.getElementById(`air-${jump.value}`)?.scrollIntoView();
    });
    const detailBox = $('#detail');
    detailBox.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('[data-close]'))
            closeDetail();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !detailBox.hidden && !aboutIsOpen())
            closeDetail();
    });
    window.addEventListener('hashchange', route);
    render();
    route();
    setUpAbout(dataset);
    document.body.dataset.ready = '1';
}
/** Replaces ?q= in the URL without adding a history entry. */
function keepQueryInUrl(query) {
    const url = new URL(location.href);
    if (query)
        url.searchParams.set('q', query);
    else
        url.searchParams.delete('q');
    history.replaceState(null, '', url);
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    $('#main').innerHTML =
        `<p class="empty">Couldn’t load the index: ${escapeHtml(message)}. ` +
            'Serve the repository root (python3 -m http.server) and open /examples/svg-viewer/.</p>';
});
