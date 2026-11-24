// Clip-path ids come from the picture itself: the same drawing gives the same markup, different drawings don't share
// ids, and idPrefix leads them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { renderSide, renderTexture } from '../dist/index.js';

const root = new URL('../../', import.meta.url);
const scheme = (ref) => JSON.parse(readFileSync(new URL(`liveries/${ref}.json`, root)));
const ids = (svg) => [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);

test('the same scheme and shape always give the same markup', () => {
  const s = scheme('BAW/standard');
  assert.equal(renderSide(s), renderSide(s));
  assert.equal(renderTexture(s, 'fuselage'), renderTexture(s, 'fuselage'));
});

test('different pictures on one page do not share clip-path ids', () => {
  const a = ids(renderSide(scheme('BAW/standard'))),
    b = ids(renderSide(scheme('DAL/standard')));
  const c = ids(renderSide(scheme('BAW/standard'), { side: 'right' }));
  assert.ok(a.length > 0);
  for (const id of a) {
    assert.ok(!b.includes(id), `${id} in both`);
    assert.ok(!c.includes(id), `${id} on both sides`);
  }
});

test('idPrefix leads every id', () => {
  const svg = renderSide(scheme('BAW/standard'), { idPrefix: 'card7-' });
  assert.ok(ids(svg).every((id) => id.startsWith('card7-')));
  assert.ok(!svg.includes('⁣'));
});
