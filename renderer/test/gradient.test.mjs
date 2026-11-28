// An area's gradient (docs/COORDINATES.md › Gradients): drawn as an SVG linear gradient whose lines of one paint are
// the part's own, on both sides, in the textures and fitted onto other types; its `color` where there's none.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { renderBelow, renderSide, renderTexture } from '../dist/index.js';

const root = new URL('../../', import.meta.url);
const shape = (id) => JSON.parse(readFileSync(new URL(`shapes/${id}.json`, root)));

const scheme = {
  id: 'test',
  airline: 'TST',
  name: 'test',
  kind: 'standard',
  palette: { white: { hex: '#FFFFFF' }, teal: { hex: '#00A3AD' }, navy: { hex: '#1C2272' } },
  fuselage: {
    base: 'white',
    areas: [
      {
        color: 'teal',
        points: [
          [0.6, -1],
          [0.9, 1],
          [1, 1],
          [1, -1],
        ],
        gradient: {
          from: [0.6, -1],
          to: [0.6, 1],
          stops: [
            [0, 'navy'],
            [1, 'teal'],
          ],
        },
      },
    ],
  },
  fin: {
    base: 'navy',
    areas: [
      {
        color: 'teal',
        points: [
          [0, 0.3],
          [1, 0.3],
          [1, 0.9],
          [0, 0.9],
        ],
        gradient: {
          from: [0.5, 0.3],
          to: [0.5, 0.9],
          stops: [
            [0, 'teal'],
            [0.5, '#80D0D6'],
            [1, 'white'],
          ],
        },
      },
    ],
  },
};

const gradients = (svg) =>
  [...svg.matchAll(/<linearGradient ([^>]*)>(.*?)<\/linearGradient>/g)].map(([, attributes, stops]) => {
    const n = (k) => Number(attributes.match(new RegExp(`${k}="([-\\d.]+)"`))[1]);
    return {
      id: attributes.match(/id="([^"]+)"/)[1],
      x1: n('x1'),
      y1: n('y1'),
      x2: n('x2'),
      y2: n('y2'),
      stops: [...stops.matchAll(/stop-color="([^"]+)"/g)].map((m) => m[1]),
    };
  });

for (const side of ['left', 'right']) {
  test(`a fin's fade root to tip runs straight up the side view (${side})`, () => {
    for (const type of ['B38M', 'B789']) {
      const svg = renderSide(scheme, { shape: shape(type), side });
      const found = gradients(svg);
      assert.equal(found.length, 2, type);
      const fin = found.find((g) => g.stops.length === 3);
      assert.deepEqual(fin.stops, ['#00A3AD', '#80D0D6', '#FFFFFF']);
      // Fin space's y is height above the root: its lines of one paint are level, whatever the sweep.
      assert.ok(Math.abs(fin.x2 - fin.x1) < 0.15 * Math.abs(fin.y2 - fin.y1), `${type}: ${JSON.stringify(fin)}`);
      assert.ok(fin.y2 < fin.y1, 'white toward the tip, up the picture');
      for (const g of found) assert.match(svg, new RegExp(`fill="url\\(#${g.id}\\)"`));
    }
  });
}

test('textures and the view from below carry the fade', () => {
  const s = shape('B38M');
  assert.equal(gradients(renderTexture(scheme, 'fin', { shape: s, side: 'left' })).length, 1);
  assert.equal(gradients(renderTexture(scheme, 'fuselage', { shape: s })).length, 2);
  assert.equal(gradients(renderBelow(scheme, { shape: s })).length, 2);
});

test('fitted onto another type, the fade stays inside its area', () => {
  const svg = renderSide({ ...scheme, drawnOn: 'B38M' }, { shape: shape('B789') });
  assert.equal(gradients(svg).length, 2);
  assert.doesNotMatch(svg, /NaN|Infinity/);
});

test('without a gradient an area is its color, as before', () => {
  const plain = structuredClone(scheme);
  for (const part of [plain.fuselage, plain.fin]) for (const a of part.areas) delete a.gradient;
  const svg = renderSide(plain, { shape: shape('B38M') });
  assert.equal(gradients(svg).length, 0);
});
