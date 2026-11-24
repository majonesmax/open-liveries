// Small DOM helpers.

/** The first element matching `selector`; throws if there's none, since the page's markup guarantees it. */
export function $(selector: string, root: ParentNode = document): HTMLElement {
  return $as(selector, HTMLElement, root);
}

/** As `$`, for an element of a particular type, e.g. `$as('#q', HTMLInputElement)`. */
export function $as<E extends Element>(selector: string, type: new () => E, root: ParentNode = document): E {
  const element = root.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`No ${type.name} matches ${selector}`);
  return element;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text for HTML content and quoted attribute values. */
export const escapeHtml = (value: string | number | undefined): string =>
  String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
