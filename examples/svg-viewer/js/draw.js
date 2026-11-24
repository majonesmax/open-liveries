// The renderer's pictures as elements for the page.
import { belowLabelCount, renderBelow, renderSide, shapeNamed, SHAPES } from '../../../renderer/dist/index.js';
export { belowLabelCount, shapeNamed, SHAPES };
/** Markup from the renderer as an element: it's our own output, drawn from the dataset's files. */
function toElement(markup) {
    const template = document.createElement('template');
    template.innerHTML = markup;
    const svg = template.content.firstElementChild;
    if (!(svg instanceof SVGSVGElement))
        throw new Error('The renderer returned no <svg>');
    return svg;
}
/** `drawnOn`: the measured shape the scheme was drawn on, to fit it to `shape` by their landmarks. */
export const drawSide = (livery, side, shape, drawnOn) => toElement(renderSide(livery, shape ? { side, shape, drawnOn } : { side }));
export const drawBelow = (livery, shape, drawnOn) => toElement(renderBelow(livery, shape ? { shape, drawnOn } : {}));
