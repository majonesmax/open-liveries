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

// A title spread wider than its stand-in sets it is thickened by a stroke, and a stroke grows a letter all round:
// half of it over the cap line and half under the baseline. Two lines set close (FedEx's retro FEDERAL over EXPRESS,
// a tenth of a cap height apart on the aircraft) ran together. The stroked letters are set smaller and lifted, so the
// ink stays between the baseline and the measured cap height.
test("a stroked title's ink stays within its measured cap height", () => {
  const CAP = 0.71;
  const s = scheme('FDX/federal-express-retro');
  const unspread = { ...s, titles: s.titles.map((t) => ({ ...t, length: undefined })) };
  const b77l = shape('B77L');
  const texts = (svg) =>
    [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map(([, attrs, text]) => {
      const num = (name) => Number(attrs.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? 0);
      return { text, y: num('y'), size: num('font-size'), stroke: num('stroke-width') };
    });
  for (const side of ['left', 'right']) {
    const plain = Object.fromEntries(texts(renderSide(unspread, { shape: b77l, side })).map((t) => [t.text, t]));
    const lettering = new Set(s.titles.map((t) => t.text));
    const set = texts(renderSide(s, { shape: b77l, side })).filter((t) => lettering.has(t.text));
    assert.ok(
      set.some((t) => t.stroke > 0),
      `${side}: a stroked title`,
    );
    for (const t of set) {
      // Its ink: from the cap line less half the stroke to the baseline plus half the stroke.
      assert.ok(t.y + t.stroke / 2 <= 0.06, `${side} ${t.text}: ink below its baseline (${t.y}, stroke ${t.stroke})`);
      const ink = t.size * CAP + t.stroke;
      const cap = plain[t.text].size * CAP;
      assert.ok(
        Math.abs(ink - cap) < 0.15,
        `${side} ${t.text}: ink ${ink.toFixed(2)} tall for a cap height of ${cap.toFixed(2)}`,
      );
    }
  }
});
