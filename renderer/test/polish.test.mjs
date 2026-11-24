// Polished metal (docs/COORDINATES.md, Finish): a metallic scheme's side view shows the reflections over its base;
// a painted one's doesn't, and neither does a texture (its 3D view lights it).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { renderSide, renderTexture } from '../dist/index.js';

const root = new URL('../../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root)));
const shape = read('shapes/B738.json');
// The reflections' bands: white or black, part-transparent, with no outline (a fairing's shade has one).
const bands = (svg) => (svg.match(/fill="#(?:FFFFFF|000000)" fill-opacity="[\d.]+"\/>/g) ?? []).length;

test('a metallic scheme shines in the side view, a painted one and a texture do not', () => {
  const metal = read('liveries/AAL/tri-color-1968.json');
  assert.equal(metal.finish, 'metallic');
  assert.ok(bands(renderSide(metal, { shape, side: 'left' })) >= 20, 'reflections on the metal');
  assert.equal(bands(renderSide({ ...metal, finish: 'gloss' }, { shape, side: 'left' })), 0, 'none on paint');
  assert.equal(bands(renderTexture(metal, 'fuselage', { shape })), 0, 'none in a texture');
});

// Flap track fairings (docs/SHAPES.md, Flap track fairings): a shape's measured fairings hang under the near wing in
// the side view, darkened as in its shadow; a shape without them has none.
test('a measured wing draws its flap track fairings', () => {
  const s = read('liveries/AAL/tri-color-1968.json');
  const shades = (svg) => (svg.match(/fill="#000000" fill-opacity="0.22"/g) ?? []).length;
  assert.equal(shades(renderSide(s, { shape, side: 'left' })), shape.wing.fairings.length);
  assert.equal(shades(renderSide(s, { shape: read('shapes/B712.json'), side: 'left' })), 0);
});

// Behind an engine's fan cowl (its shape's `cowlEnd`) the core and nozzle are bare metal whatever the scheme paints:
// every model had the back of its engines in the airline's color (Delta's navy to the exhaust).
test('an engine is bare metal behind its fan cowl', () => {
  const s = read('liveries/DAL/standard.json');
  const metal = (svg) => (svg.match(/fill="#9da4ac"/g) ?? []).length;
  const a320 = read('shapes/A320.json');
  assert.ok(metal(renderSide(s, { shape: a320, side: 'left' })) >= 1, 'the side view');
  assert.ok(metal(renderTexture(s, 'engine', { shape: a320 })) >= 1, 'the 3D texture');
  assert.equal(
    metal(renderTexture(s, 'engine', { shape: read('shapes/AT76.json') })),
    0,
    'a turboprop has no cowl end',
  );
});

// Lettering on an engine stays on its fan cowl, not over the bare core behind it: Southwest's "Southwest.com",
// measured to 80% of a 737's nacelle, ran onto the metal.
test('engine lettering stays on the fan cowl', () => {
  const svg = renderSide(read('liveries/SWA/standard.json'), { shape: read('shapes/B738.json'), side: 'left' });
  const text = svg.match(/<text transform="translate\(([\d.]+),[^"]*"[^>]*textLength="([\d.]+)"[^>]*>Southwest\.com</);
  assert.ok(text, 'the engine title');
  const metal = svg.match(/<polygon points="([^"]+)" fill="#9da4ac"/);
  assert.ok(metal, 'the bare core');
  const metalStart = Math.min(...metal[1].split(' ').map((p) => Number(p.split(',')[0])));
  const end = Number(text[1]) + Number(text[2]);
  assert.ok(end <= metalStart, `the title ends at ${end}, the metal starts at ${metalStart}`);
});

// The 3D model's engines wear their lettering as the side view does: Southwest's "Southwest.com" was missing on the
// card's turntable (the engine texture drew only areas). Both sides, on the cowl.
test("an engine's texture carries its lettering", () => {
  const svg = renderTexture(read('liveries/SWA/standard.json'), 'engine', { shape: read('shapes/B738.json') });
  assert.equal((svg.match(/>Southwest\.com</g) ?? []).length, 2);
});

// A logo on a winglet stays inside it (Sun Country's sun is the case to watch: it reaches the winglet's edges). Its
// placeholder's box (the renderer draws one without the mark) lies within the winglet's outline.
test("a winglet's logo stays on the winglet", () => {
  const svg = renderSide(read('liveries/SCX/standard.json'), { shape: read('shapes/B738.json'), side: 'left' });
  const clip = svg.match(/<clipPath id="[^"]*wl"><polygon points="([^"]+)"/);
  assert.ok(clip, 'the winglet');
  const outline = clip[1].split(' ').map((p) => p.split(',').map(Number));
  const inside = ([px, py]) => {
    let hit = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [xi, yi] = outline[i];
      const [xj, yj] = outline[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  // The sun nearest the winglet (the fin wears one too).
  const middle = outline.reduce((m, p) => [m[0] + p[0] / outline.length, m[1] + p[1] / outline.length], [0, 0]);
  const suns = [
    ...svg.matchAll(
      /<title>SCX\/sun-s[^<]*<\/title><rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g,
    ),
  ].map((m) => m.slice(1, 5).map(Number));
  assert.ok(suns.length, 'the sun placeholders');
  const near = (r) => Math.hypot(r[0] + r[2] / 2 - middle[0], r[1] + r[3] / 2 - middle[1]);
  const [x, y, w, h] = suns.sort((a, b) => near(a) - near(b))[0];
  const c = [x + w / 2, y + h / 2];
  // Round its circle (the sun fills its box): every point on the winglet.
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const p = [c[0] + 0.47 * w * Math.cos(a), c[1] + 0.47 * h * Math.sin(a)];
    assert.ok(inside(p), `[${p.map((v) => v.toFixed(1))}] off the winglet`);
  }
});

// A 3D winglet wears its scheme's winglet paint: Southwest's red and blue were missing (the 3D winglets were one color).
test("a winglet's texture carries its areas", () => {
  const s = read('liveries/SWA/standard.json');
  const svg = renderTexture(s, 'winglet', { shape: read('shapes/B738.json'), side: 'left' });
  for (const name of ['red', 'blue']) assert.ok(svg.includes(s.palette[name].hex), `${name} on the winglet`);
});
