// The dorsal fillet is the body's (docs/COORDINATES.md, The fillet): its region is the same part of the aircraft on
// both sides, whatever the fin's design does. Sun Country's fin isn't mirrored (`mirrored: false`), and its right
// side took the fillet's region from behind the trailing edge, leaving the real fillet in the fin's navy.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { renderSide } from '../dist/index.js';

const root = new URL('../../', import.meta.url);
const shapes = readdirSync(new URL('shapes/', root)).map((f) => JSON.parse(readFileSync(new URL(`shapes/${f}`, root))));
const byType = (t) => shapes.find((s) => s.id === t) ?? shapes.find((s) => s.types.includes(t));

/** The x range of a clip path's polygon (by the end of its id) in a side view. */
function clipRange(svg, name) {
  const m = svg.match(new RegExp(`<clipPath id="[^"]*${name}"><polygon points="([^"]+)"`));
  assert.ok(m, `no ${name} clip`);
  const xs = m[1].split(' ').map((p) => Number(p.split(',')[0]));
  return [Math.min(...xs), Math.max(...xs)];
}

test('the fillet is the same part of the body on both sides, an unmirrored fin too', () => {
  const schemes = readdirSync(new URL('liveries/', root)).flatMap((a) =>
    readdirSync(new URL(`liveries/${a}/`, root)).map((f) =>
      JSON.parse(readFileSync(new URL(`liveries/${a}/${f}`, root))),
    ),
  );
  const unmirrored = schemes.filter((s) => s.fin?.mirrored === false && s.drawnOn && byType(s.drawnOn)?.fin.fillet);
  assert.ok(unmirrored.length > 0, 'a scheme to check (Sun Country)');
  for (const scheme of unmirrored) {
    const shape = byType(scheme.drawnOn);
    const left = renderSide(scheme, { shape, side: 'left' });
    const width = Number(left.match(/viewBox="0 0 ([\d.]+)/)[1]);
    const [l0, l1] = clipRange(left, 'fillet');
    const [r0, r1] = clipRange(renderSide(scheme, { shape, side: 'right' }), 'fillet');
    const name = `${scheme.airline}/${scheme.id} on ${shape.id}`;
    assert.ok(
      Math.abs(width - l1 - r0) < 1 && Math.abs(width - l0 - r1) < 1,
      `${name}: left ${l0}–${l1}, right ${r0}–${r1}`,
    );
  }
});
