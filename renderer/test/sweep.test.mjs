// Every scheme draws on every built-in shape, and one scheme on every measured shape in every view, with no NaN or
// missing number in the markup. A cut-down `npm run check` (which renders everything on everything) for npm test.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { renderBelow, renderSide, renderTexture, SHAPES } from '../dist/index.js';

const root = new URL('../../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root)));
const schemes = readdirSync(new URL('liveries/', root)).flatMap((airline) =>
  readdirSync(new URL(`liveries/${airline}/`, root)).map((file) => read(`liveries/${airline}/${file}`)),
);
const broken = (svg) => /NaN|undefined|Infinity/.test(svg);

test('every scheme on every built-in shape', () => {
  const bad = [];
  for (const scheme of schemes)
    for (const [name, shape] of Object.entries(SHAPES))
      if (broken(renderSide(scheme, { shape })) || broken(renderSide(scheme, { shape, side: 'right' })))
        bad.push(`${scheme.airline}/${scheme.id} on ${name}`);
  assert.deepEqual(bad, []);
});

test('every measured shape in every view and texture', () => {
  const scheme = read('liveries/BAW/standard.json');
  const bad = [];
  for (const file of readdirSync(new URL('shapes/', root))) {
    const shape = read(`shapes/${file}`);
    const drawn = [
      renderSide(scheme, { shape }),
      renderSide(scheme, { shape, side: 'right' }),
      renderBelow(scheme, { shape }),
      ...['fuselage', 'fin', 'engine', 'winglet'].map((part) => renderTexture(scheme, part, { shape })),
    ];
    if (drawn.some(broken)) bad.push(file);
  }
  assert.deepEqual(bad, []);
});
