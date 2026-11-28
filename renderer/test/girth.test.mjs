// The fuselage texture keeps a logo's side-view proportions on a tapering tail: rows are a share of the way round,
// so a logo there is squeezed along the fuselage by the local radius over the cabin's (Blue Bravest's Maltese cross).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { renderTexture } from '../dist/index.js';

const root = new URL('../../', import.meta.url);
const shape = JSON.parse(readFileSync(new URL('shapes/A320.json', root)));
const scheme = (x) => ({
  id: 't',
  airline: 'TST',
  name: 'Test',
  kind: 'special',
  palette: { red: { hex: '#C3162A' } },
  fuselage: { base: 'red' },
  logos: [{ mark: 'TST/disc', place: 'fuselage', at: [x, 0], height: 1, colors: ['red'] }],
});
const squeeze = (svg) => [...svg.matchAll(/scale\(([\d.]+),1\)/g)].map((m) => Number(m[1]));

test('a logo on the tail cone is squeezed along the fuselage by its girth there', () => {
  const tail = squeeze(renderTexture(scheme(0.9), 'fuselage', { shape }));
  assert.equal(tail.length, 2, 'once on each side');
  for (const k of tail) assert.ok(k > 0.3 && k < 0.9, `squeezed by ${k}`);
});

test('a logo on the cabin is drawn as it always was', () => {
  assert.deepEqual(squeeze(renderTexture(scheme(0.5), 'fuselage', { shape })), []);
});
