// "About this viewer": what Open Liveries is, what the pictures are, what you can do and what it can't do yet.
// It opens by itself on a first visit (remembered where the browser allows it) and from any [data-about] button,
// which names the section to show ("logos", "placeholder" or "top").
import { $as } from '../dom.js';
const SEEN_KEY = 'ol-about-seen';
function seen() {
    try {
        return localStorage.getItem(SEEN_KEY) === '1';
    }
    catch {
        return false;
    }
}
function markSeen() {
    try {
        localStorage.setItem(SEEN_KEY, '1');
    }
    catch {
        // Not remembered: it opens again on the next visit.
    }
}
/** Whether the About dialog is showing (Escape and the arrow keys are its, not the scheme panel's). */
export const aboutIsOpen = () => document.querySelector('dialog.about[open]') !== null;
export function setUpAbout(dataset) {
    const dialog = $as('#about', HTMLDialogElement);
    const { schemes, shapes } = dataset.index;
    for (const span of dialog.querySelectorAll('[data-count]')) {
        const count = span.dataset.count === 'shapes' ? shapes.length : schemes.filter((s) => !s.drawn).length;
        span.textContent = String(count);
    }
    const open = (section) => {
        if (!dialog.open)
            dialog.showModal();
        const target = section === 'top' ? null : dialog.querySelector(`#about-${CSS.escape(section)}`);
        if (target)
            target.scrollIntoView({ block: 'start' });
        else
            dialog.scrollTop = 0;
    };
    // Buttons in the page and in each scheme's panel (drawn after this runs), so listen on the document.
    document.addEventListener('click', (event) => {
        const button = event.target instanceof Element ? event.target.closest('[data-about]') : null;
        if (!button)
            return;
        event.preventDefault();
        open(button.dataset.about ?? 'top');
    });
    for (const close of dialog.querySelectorAll('[data-about-close]')) {
        close.addEventListener('click', () => {
            dialog.close();
        });
    }
    // A click on the backdrop (the dialog itself, outside its content) closes it too.
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog)
            dialog.close();
    });
    dialog.addEventListener('close', markSeen);
    if (!seen())
        open('top');
}
