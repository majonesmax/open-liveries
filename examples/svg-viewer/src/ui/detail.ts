// The detail panel for one scheme (#ICAO/id): in 3D, both sides and below, its description, parts, titles, logos,
// palette, sources, and the airframes that wear it. ‹ and › (or the arrow keys) step through the measured types.

import type { Dataset, Drawable } from '../data.js';
import { $, escapeHtml } from '../dom.js';
import { belowLabelCount, drawBelow, drawSide, shapeNamed, SHAPES } from '../draw.js';
import { isMeasuredShape, measuredShapeProblems, shapeProblems } from '../../../../renderer/dist/index.js';
import type { AircraftShape, MeasuredShape, Shape } from '../../../../renderer/dist/index.js';
import type { View3D } from '../three/view3d.js';
import type { Livery, SchemeId, SchemeSummary } from '../types.js';
import { aboutIsOpen } from './about.js';
import { airframesHtml } from './airframes.js';
import { logosHtml, paletteHtml, partsHtml, proseHtml, sourcesHtml, titlesHtml } from './detail-sections.js';
import { tagsHtml } from './tags.js';

/** The scheme id in the URL's hash, if any. */
export const hashId = (): string => decodeURIComponent(location.hash.slice(1));

/** The shape the panel draws on, remembered between visits where the browser allows it. */
const SHAPE_KEY = 'ol-shape';
function savedShape(): string {
  try {
    const name = localStorage.getItem(SHAPE_KEY) ?? '';
    return shapeNamed(name) ? name : 'narrowbody';
  } catch {
    return 'narrowbody';
  }
}

/** Whether the 3D view is on (it is unless turned off), remembered like the shape. */
const THREE_D_KEY = 'ol-3d';
function saved3d(): boolean {
  try {
    return localStorage.getItem(THREE_D_KEY) !== 'off';
  } catch {
    return true;
  }
}

export class DetailPanel {
  private readonly box = $('#detail');
  private readonly body = $('#d-body');
  private shape = savedShape();
  /** The scheme's measured type, when shapes/ has the type it was measured on (its default, "as measured"). */
  private measured: { id: string; name: string; shape: Shape } | undefined;
  /** Draw on the measured type when there is one (until a built-in shape is picked in this visit). */
  private useMeasured = true;
  /** Another measured type picked from the list (any scheme on any type: to compare them), for this visit. */
  private otherType: string | undefined;
  /** Shapes loaded from your own files (Your shape…), by name, for this visit. */
  private readonly ownShapes = new Map<string, Shape>();
  private show3d = saved3d();
  private view3d: Promise<View3D> | undefined;
  /** The scheme drawn now, for stepping through types. */
  private drawn: Livery | undefined;
  /** The scheme open now, and whether it's drawn as its airline's default: for the notes under the chips. */
  private scheme: SchemeSummary | undefined;
  private fallback = false;

  constructor(private readonly dataset: Dataset) {
    // ?shape=A359 (a measured type) or ?shape=widebody (a built-in one) picks the shape to draw on.
    const picked = new URLSearchParams(location.search).get('shape') ?? '';
    if (dataset.index.shapes.some((s) => s.id === picked)) this.otherType = picked;
    else if (shapeNamed(picked)) [this.useMeasured, this.shape] = [false, picked];
    document.addEventListener('keydown', (event) => {
      if (this.box.hidden || !this.drawn || aboutIsOpen()) return;
      if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) return;
      if (event.key === 'ArrowLeft') this.step(-1);
      if (event.key === 'ArrowRight') this.step(1);
    });
  }

  async open(id: SchemeId): Promise<void> {
    const scheme = this.dataset.summary(id);
    if (!scheme) {
      this.close();
      return;
    }
    this.box.hidden = false;
    document.body.style.overflow = 'hidden';
    this.body.innerHTML = this.headerHtml(scheme.name, scheme) + '<p class="muted">Loading…</p>';
    $('.panel', this.box).focus();

    let drawable: Drawable;
    try {
      drawable = await this.dataset.drawable(id);
    } catch (error) {
      this.body.insertAdjacentHTML(
        'beforeend',
        `<p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`,
      );
      return;
    }
    if (hashId() !== id) return; // Closed, or moved on to another scheme, while loading.
    this.drawn = undefined;
    this.scheme = scheme;
    this.fallback = !!drawable.fallbackId;

    const measured = drawable.fallbackId ? undefined : this.dataset.measuredFor(scheme);
    this.measured = measured ? { ...measured, shape: await this.dataset.shape(measured.id) } : undefined;
    if (hashId() !== id) return;
    this.body.innerHTML = this.contentHtml(scheme, drawable);
    const { drawn } = drawable;
    if (drawn) {
      this.drawn = drawn;
      this.listenForShapes(drawn);
      await this.drawViews(drawn);
    }
    this.linkSourceReferences();
    await this.showAirframes(scheme);
  }

  close(): void {
    this.drawn = undefined;
    void this.view3d?.then((view) => {
      view.stop();
    });
    this.box.hidden = true;
    document.body.style.overflow = '';
  }

  private headerHtml(name: string, scheme: SchemeSummary): string {
    return (
      `<h2 id="d-title">${escapeHtml(name)}</h2>` +
      `<p class="airline">${escapeHtml(this.dataset.airlineName(scheme.airline))}</p>` +
      `<div class="tags"><span class="mono">${escapeHtml(scheme.id)}</span> ${tagsHtml(scheme)}</div>`
    );
  }

  private contentHtml(scheme: SchemeSummary, { livery, fallbackId }: Drawable): string {
    const notice = fallbackId
      ? `<div class="notice">Described in words only: drawn as the airline’s default, ${escapeHtml(fallbackId)}.</div>`
      : '';
    return [
      this.headerHtml(livery.name, scheme),
      notice,
      livery.fuselage || livery.fin
        ? shapeChipsHtml(this.chosen(), this.measured?.name, this.typeOptions(), this.otherType, this.show3d)
        : '',
      '<div class="view-notes" id="d-notes"></div>',
      '<div class="views" id="d-views"></div>',
      proseHtml(livery),
      partsHtml(livery),
      titlesHtml(livery),
      logosHtml(livery),
      paletteHtml(livery),
      sourcesHtml(livery),
      '<h3>Airframes</h3><div id="d-air" class="muted">Loading…</div>',
    ].join('');
  }

  /** The measured types, then any shapes loaded from files: the "Other type…" list, and what ‹ › step through. */
  private typeOptions(): { id: string; name: string }[] {
    return [...this.dataset.index.shapes, ...[...this.ownShapes.keys()].map((name) => ({ id: name, name }))];
  }

  /** In 3D, the left side, right side, and from below, on the chosen shape. */
  private async drawViews(livery: Livery): Promise<void> {
    const other = this.otherType;
    const shape: Shape | undefined = other
      ? (this.ownShapes.get(other) ?? (await this.dataset.shape(other)))
      : this.chosen() === MEASURED
        ? this.measured?.shape
        : shapeNamed(this.shape);
    if (other !== this.otherType) return; // Another type was picked while this one loaded.
    $('#d-notes', this.body).innerHTML = this.notesHtml(livery, !other && this.chosen() !== MEASURED);
    const views = $('#d-views', this.body);
    views.replaceChildren();
    if (this.show3d) {
      const box = document.createElement('div');
      box.className = 'view3d';
      box.setAttribute('aria-label', 'The aircraft in 3D: drag to turn it, scroll to zoom');
      views.appendChild(box);
      void this.paint3d(box, livery, shape ?? SHAPES.narrowbody);
    }
    for (const side of ['left', 'right'] as const) {
      views.appendChild(figure(drawSide(livery, side, shape, this.measured?.shape), `${side} side`));
    }
    const caption = `from below, nose left${belowLabelCount(livery) ? '' : ' (no belly titles or logos)'}`;
    const belowFigure = figure(drawBelow(livery, shape, this.measured?.shape), caption, 'belowart');
    belowFigure.className = 'below';
    views.appendChild(belowFigure);
  }

  /** Plain notes on what the drawing can't show: a stand-in shape, and logos as dashed boxes. */
  private notesHtml(livery: Livery, onStandIn: boolean): string {
    const more = (section: string): string =>
      ` <button type="button" class="linkish" data-about="${section}">More</button>`;
    const notes: string[] = [];
    if (onStandIn) {
      const type = this.scheme?.drawnOn;
      const why = this.measured
        ? `The ${escapeHtml(this.measured.name.replace(/ with .*/, ''))} button shows its real outline.`
        : type && !this.fallback
          ? `This type (${escapeHtml(type)}) isn’t measured yet.`
          : 'It isn’t the real type.';
      notes.push(`Drawn on a simple stand-in. ${why}${more('placeholder')}`);
    }
    if (livery.logos?.length) {
      notes.push(
        'Dashed boxes are logos. Airline logos are trademarks, so they’re described below instead of drawn.' +
          more('logos'),
      );
    }
    return notes.map((note) => `<p>${note}</p>`).join('');
  }

  /** three.js loads the first time the 3D view is shown. */
  private async paint3d(box: HTMLElement, livery: Livery, shape: Shape): Promise<void> {
    this.view3d ??= import('../three/view3d.js').then(({ View3D, cameraFromUrl }) => {
      const camera = cameraFromUrl(new URLSearchParams(location.search));
      const view = new View3D(camera);
      view.spinning = !camera.still;
      return view;
    });
    try {
      const view = await this.view3d;
      const spin = this.body.querySelector('button.spin');
      spin?.setAttribute('aria-pressed', String(view.spinning));
      await view.show(box, livery, shape, this.measured?.shape);
    } catch (error) {
      box.textContent = `No 3D view: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /** Draws on the measured type `by` places on from the one drawn now. */
  private step(by: number): void {
    const types = this.typeOptions();
    const now = this.otherType ?? (this.chosen() === MEASURED ? this.measured?.id : undefined);
    const i = types.findIndex((t) => t.id === now);
    const next = types[(i < 0 && by < 0 ? 0 : i + by + types.length) % types.length];
    if (next) this.pickType(next.id);
  }

  /** Draws on another measured type (or a loaded shape), and says so in the URL. */
  private pickType(id: string): void {
    this.otherType = id;
    const pick = this.body.querySelector<HTMLSelectElement>('select.type-pick');
    if (pick) pick.value = id;
    for (const chip of this.body.querySelectorAll('button[data-shape]')) chip.setAttribute('aria-pressed', 'false');
    keepShapeInUrl(this.dataset.index.shapes.some((s) => s.id === id) ? id : '');
    if (this.drawn) void this.drawViews(this.drawn);
  }

  /** A shape from your own file, checked like the renderer checks its own. */
  private async loadShape(file: File): Promise<void> {
    const status = this.body.querySelector('.shape-status');
    let shape: unknown;
    try {
      shape = JSON.parse(await file.text());
    } catch {
      if (status) status.textContent = `${file.name} isn’t JSON`;
      return;
    }
    const problems = isMeasuredShape(shape) ? measuredShapeProblems(shape) : shapeProblems(shape);
    if (problems.length) {
      if (status) status.textContent = `${file.name}: ${problems.join('; ')}`;
      return;
    }
    const name = (shape as AircraftShape | MeasuredShape).name || file.name;
    this.ownShapes.set(name, shape as Shape);
    const pick = this.body.querySelector<HTMLSelectElement>('select.type-pick');
    if (pick && ![...pick.options].some((o) => o.value === name)) pick.add(new Option(name, name));
    if (status) status.textContent = '';
    this.pickType(name);
  }

  /** The shape chips, type list, ‹ ›, Your shape…, 3D and Spin. */
  private listenForShapes(livery: Livery): void {
    for (const chip of this.body.querySelectorAll<HTMLButtonElement>('button[data-shape]')) {
      chip.addEventListener('click', () => {
        const picked = chip.dataset.shape ?? 'narrowbody';
        this.otherType = undefined;
        keepShapeInUrl('');
        const pick = this.body.querySelector<HTMLSelectElement>('select.type-pick');
        if (pick) pick.value = '';
        if (picked === MEASURED) {
          this.useMeasured = true;
        } else {
          this.useMeasured = false;
          this.shape = picked;
          try {
            localStorage.setItem(SHAPE_KEY, this.shape);
          } catch {
            // Not remembered; it still applies to this visit.
          }
        }
        for (const other of this.body.querySelectorAll('button[data-shape]')) {
          other.setAttribute('aria-pressed', String(other === chip));
        }
        void this.drawViews(livery);
      });
    }
    const pick = this.body.querySelector<HTMLSelectElement>('select.type-pick');
    pick?.addEventListener('change', () => {
      if (pick.value) this.pickType(pick.value);
    });
    this.body.querySelector('button.previous')?.addEventListener('click', () => {
      this.step(-1);
    });
    this.body.querySelector('button.next')?.addEventListener('click', () => {
      this.step(1);
    });
    const file = this.body.querySelector<HTMLInputElement>('input.shape-file');
    file?.addEventListener('change', () => {
      const chosen = file.files?.[0];
      if (chosen) void this.loadShape(chosen);
      file.value = '';
    });
    const toggle = this.body.querySelector<HTMLButtonElement>('button.toggle3d');
    toggle?.addEventListener('click', () => {
      this.show3d = !this.show3d;
      toggle.setAttribute('aria-pressed', String(this.show3d));
      try {
        localStorage.setItem(THREE_D_KEY, this.show3d ? 'on' : 'off');
      } catch {
        // Not remembered; it still applies to this visit.
      }
      if (!this.show3d)
        void this.view3d?.then((view) => {
          view.stop();
        });
      void this.drawViews(livery);
    });
    const spin = this.body.querySelector<HTMLButtonElement>('button.spin');
    spin?.addEventListener('click', () => {
      void this.view3d?.then((view) => {
        view.spinning = !view.spinning;
        spin.setAttribute('aria-pressed', String(view.spinning));
      });
    });
  }

  /** The measured type when the scheme has one and it's wanted, else the remembered built-in shape. */
  private chosen(): string {
    return this.measured && this.useMeasured ? MEASURED : this.shape;
  }

  /** "[2]" links scroll to the source in the panel rather than changing the hash (which would close it). */
  private linkSourceReferences(): void {
    for (const link of this.body.querySelectorAll<HTMLAnchorElement>('a[data-src]')) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        this.body.querySelector(`#src-${link.dataset.src}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  private async showAirframes(scheme: SchemeSummary): Promise<void> {
    const byScheme = await this.dataset.airframesByScheme();
    if (hashId() !== scheme.id) return;
    const operators = Object.entries(this.dataset.index.operators).filter(([, o]) => o.wears === scheme.id);
    const section = $('#d-air', this.body);
    section.className = '';
    section.innerHTML = airframesHtml(scheme, byScheme.get(scheme.id) ?? [], operators);
  }
}

/** The chip for a scheme's measured type. */
const MEASURED = 'measured';

function shapeChipsHtml(
  current: string,
  measuredName: string | undefined,
  types: { id: string; name: string }[],
  otherType: string | undefined,
  show3d: boolean,
): string {
  const chip = (value: string, label: string): string =>
    `<button class="chip" data-shape="${escapeHtml(value)}" aria-pressed="${String(value === current)}">` +
    `${escapeHtml(label)}</button>`;
  const chips = Object.keys(SHAPES).map((name) => chip(name, name.charAt(0).toUpperCase() + name.slice(1)));
  // The type it was measured on first: the body's and the fin's paint meet where they do on the real aircraft.
  if (measuredName) chips.unshift(chip(MEASURED, measuredName.replace(/ with .*/, '')));
  // Any measured type, to compare: a scheme's titles and logos are placed for the type it was measured on.
  const options = types.map(
    ({ id, name }) =>
      `<option value="${escapeHtml(id)}"${id === otherType ? ' selected' : ''}>${escapeHtml(name.replace(/ with .*/, ''))}</option>`,
  );
  chips.push(
    '<button class="chip previous" aria-label="Previous type" title="Previous type (←)">‹</button>',
    `<select class="chip type-pick" aria-label="Another measured type"><option value="">Other type…</option>${options.join('')}</select>`,
    '<button class="chip next" aria-label="Next type" title="Next type (→)">›</button>',
    '<label class="chip file">Your shape…<input class="shape-file" type="file" accept=".json,application/json" /></label>',
    `<button class="chip toggle3d" aria-pressed="${String(show3d)}">3D</button>`,
    '<button class="chip spin" aria-pressed="true">Spin</button>',
  );
  return (
    `<div class="chips shapes" role="group" aria-label="Drawn on">${chips.join('')}</div>` +
    '<p class="shape-status muted" role="status"></p>'
  );
}

function figure(svg: SVGSVGElement, caption: string, artClass = ''): HTMLElement {
  const element = document.createElement('figure');
  const art = document.createElement('div');
  art.className = artClass ? `art ${artClass}` : 'art';
  art.appendChild(svg);
  const figcaption = document.createElement('figcaption');
  figcaption.textContent = caption;
  element.append(art, figcaption);
  return element;
}

/** Replaces ?shape= in the URL without adding a history entry. */
function keepShapeInUrl(shape: string): void {
  const url = new URL(location.href);
  if (shape) url.searchParams.set('shape', shape);
  else url.searchParams.delete('shape');
  history.replaceState(null, '', url);
}
