// Titles drawn as SVG text the way every browser sets them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { renderSide, renderTexture } from '../dist/index.js';

const root = new URL('../../', import.meta.url);
const scheme = (ref) => JSON.parse(readFileSync(new URL(`liveries/${ref}.json`, root)));
const shape = (id) => JSON.parse(readFileSync(new URL(`shapes/${id}.json`, root)));

// WebKit (Safari, iOS web views) ignores a <text>'s textLength when it holds <tspan>s, so a title in two
// colours would be set at its natural width: FedEx's tail would read "FedE", cut at the fin's trailing edge
// (Chrome honours it, so previews looked right). A spread title in parts is one <text> per part, each spread to
// its share of the length.
test('a title in coloured parts is spread part by part', () => {
  const s = scheme('FDX/standard');
  const b763 = shape('B763');
  for (const svg of [
    renderSide(s, { shape: b763, side: 'left' }),
    renderSide(s, { shape: b763, side: 'right' }),
    renderTexture(s, 'fin', { shape: b763, side: 'left' }),
  ]) {
    const spread = [...svg.matchAll(/<text\b[^>]*\btextLength="[^"]*"[^>]*>(.*?)<\/text>/g)];
    assert.ok(spread.length > 0, 'some spread titles');
    for (const [, inner] of spread) assert.ok(!inner.includes('<tspan'), `a spread <text> holds <tspan>s: ${inner}`);
    // FedEx's fin title: its two parts, each spread.
    assert.ok(/textLength="[^"]*"[^>]*>Fed<\/text>/.test(svg) && /textLength="[^"]*"[^>]*>Ex<\/text>/.test(svg));
  }
});

// A wordmark no typeface comes close to names a mark (Title.mark): drawn as the painter's shape in the title's box,
// baseline to cap height along its length, where the painter has it; else the text, as before.
test('a title with a mark is drawn by the painter in its box, else as text', () => {
  const s = scheme('UAL/standard');
  const title = { ...s.titles[0], mark: 'UAL/wordmark' };
  const withMark = { ...s, titles: [title] };
  const b738 = shape('B738');
  const boxes = [];
  const painter = (logo, box) => {
    if (logo.mark !== 'UAL/wordmark') return undefined;
    boxes.push(box);
    return '<path id="wordmark"/>';
  };
  for (const side of ['left', 'right']) {
    const svg = renderSide(withMark, { shape: b738, side, logo: painter });
    assert.ok(svg.includes('id="wordmark"'), `${side}: the mark drawn`);
    assert.ok(!svg.includes('>UNITED<'), `${side}: and not the text`);
  }
  for (const box of boxes) {
    assert.ok(box.fitWidth && box.width > box.height * 3, 'the box runs along the title');
    assert.equal(box.y, -box.height, 'its foot on the baseline');
  }
  assert.ok(boxes[0].x === 0 && boxes[1].x === -boxes[1].width, 'from the right it ends at the anchor');
  // A painter without the mark ('' or undefined): the text.
  for (const none of [() => '', () => undefined]) {
    assert.ok(renderSide(withMark, { shape: b738, side: 'left', logo: none }).includes('>UNITED<'));
  }
  assert.ok(renderSide(withMark, { shape: b738, side: 'left' }).includes('>UNITED<'));
});
