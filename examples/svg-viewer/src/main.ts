// Open Liveries viewer: wires the search box, filters and URL to the list and the detail panel.
// URL: ?q=search keeps the search; #ICAO/id opens a scheme; #air-ICAO scrolls to an airline.

import { Dataset } from './data.js';
import { $, $as, escapeHtml } from './dom.js';
import type { Kind } from './types.js';
import { DetailPanel, hashId } from './ui/detail.js';
import { SchemeList } from './ui/list.js';
import { KINDS } from './ui/search.js';
import type { Filters } from './ui/search.js';

const SCHEME_ID = /^[A-Z]{3}\/[a-z0-9-]+$/;
/** Wait this long after the last keystroke before searching. */
const SEARCH_DELAY_MS = 120;

const isKind = (value: string | undefined): value is Kind => KINDS.includes(value as Kind);

async function main(): Promise<void> {
  const dataset = await Dataset.load();
  const list = new SchemeList(dataset);
  const detail = new DetailPanel(dataset);
  const filters: Filters = {
    query: new URLSearchParams(location.search).get('q') ?? '',
    kinds: new Set(),
    drawnOnly: false,
  };
  const render = (): void => {
    list.render(filters);
  };

  const route = (): void => {
    const hash = hashId();
    if (SCHEME_ID.test(hash)) {
      void detail.open(hash);
      return;
    }
    detail.close();
    if (hash.startsWith('air-')) document.getElementById(hash)?.scrollIntoView();
  };
  const closeDetail = (): void => {
    history.pushState(null, '', location.pathname + location.search);
    route();
  };

  const search = $as('#q', HTMLInputElement);
  search.value = filters.query;
  let searchTimer: number | undefined;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filters.query = search.value;
      keepQueryInUrl(filters.query);
      render();
    }, SEARCH_DELAY_MS);
  });

  for (const chip of document.querySelectorAll<HTMLButtonElement>('.chip[data-kind]')) {
    chip.addEventListener('click', () => {
      const kind = chip.dataset.kind;
      if (!isKind(kind)) return;
      if (!filters.kinds.delete(kind)) filters.kinds.add(kind);
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
    if (jump.value) document.getElementById(`air-${jump.value}`)?.scrollIntoView();
  });

  const detailBox = $('#detail');
  detailBox.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-close]')) closeDetail();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !detailBox.hidden) closeDetail();
  });
  window.addEventListener('hashchange', route);

  render();
  route();
  document.body.dataset.ready = '1';
}

/** Replaces ?q= in the URL without adding a history entry. */
function keepQueryInUrl(query: string): void {
  const url = new URL(location.href);
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  history.replaceState(null, '', url);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  $('#main').innerHTML =
    `<p class="empty">Couldn’t load the index: ${escapeHtml(message)}. ` +
    'Serve the repository root (python3 -m http.server) and open /examples/svg-viewer/.</p>';
});
