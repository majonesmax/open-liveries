// A fin's logos and lettering stay on the fin (and its fillet): drawn over the fuselage, they were clipped only to the
// fin's outline, which runs on down inside the body, so United's globe ran off the fin's root onto the tail cone.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { renderSide, sideProjection } from '../dist/index.js';

const root = new URL('../../', import.meta.url);
const shapes = readdirSync(new URL('shapes/', root)).map((f) => JSON.parse(readFileSync(new URL(`shapes/${f}`, root))));
const byType = (t) => shapes.find((s) => s.id === t) ?? shapes.find((s) => s.types.includes(t));
const united = JSON.parse(readFileSync(new URL('liveries/UAL/standard.json', root)));

/** The polygons of every clip path round the first element whose markup starts with `marker`. */
function clipsAround(svg, marker) {
  const at = svg.indexOf(marker);
  assert.ok(at >= 0, `no ${marker}`);
  const stack = [];
  for (const [tag] of svg.slice(0, at).matchAll(/<\/?g\b[^>]*>/g)) {
    if (tag.startsWith('</')) stack.pop();
    else if (!tag.endsWith('/>')) stack.push(tag.match(/clip-path="url\(#([^)]+)\)"/)?.[1]);
  }
  return stack.flatMap((id) => {
    if (!id) return [];
    const m = svg.match(new RegExp(`<clipPath id="${id}"><polygon points="([^"]+)"`));
    assert.ok(m, `no clip ${id}`);
    return [m[1].split(' ').map((p) => p.split(',').map(Number))];
  });
}

function inside([x, y], polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const crownAt = (shape, x) => {
  const c = shape.fuselage.crown;
  const k = c.findIndex(([cx]) => cx >= x);
  const [[x0, z0], [x1, z1]] = [c[k - 1], c[k]];
  return z0 + ((z1 - z0) * (x - x0)) / (x1 - x0);
};

test("a fin's logo stays off the body below the fin's root", () => {
  for (const type of ['B738', 'B39M', 'A320']) {
    const shape = byType(type);
    const projection = sideProjection(shape);
    const lead = shape.fin.leading[0];
    const trail = shape.fin.trailing[0];
    const mid = (lead[0] + trail[0]) / 2;
    for (const side of ['left', 'right']) {
      const svg = renderSide(united, { shape, side });
      const clips = clipsAround(svg, '<g class="ol-logo"><title>UAL/globe');
      const pixel = (x, z) => {
        const [u, v] = projection.uv(x, z);
        const px = u * projection.width;
        return [side === 'right' ? projection.width - px : px, (1 - v) * projection.height];
      };
      const shows = (x, z) => clips.every((polygon) => inside(pixel(x, z), polygon));
      const name = `United on ${shape.id}, ${side}`;
      assert.ok(shows(mid, (lead[1] + shape.fin.leading.at(-1)[1]) / 3), `${name}: the globe is on the fin`);
      // On the body under the fin, a little below the crown.
      assert.ok(!shows(mid, crownAt(shape, mid) - 0.25), `${name}: the globe is on the body under the fin`);
      // Just behind the trailing edge's root, under the rudder: the tail cone's top.
      assert.ok(!shows(trail[0] - 0.1, Math.min(trail[1], lead[1]) - 0.05), `${name}: the globe is under the root`);
    }
  }
});

/** The polygons drawn inside the group clipped to the clip path whose id ends with `name`, with their fills. */
function drawnIn(svg, name) {
  const id = svg.match(new RegExp(`<clipPath id="([^"]*${name})"`))?.[1];
  assert.ok(id, `no ${name} clip`);
  const start = svg.indexOf(`clip-path="url(#${id})"`);
  const end = svg.indexOf('</g>', start);
  return [...svg.slice(start, end).matchAll(/<polygon points="([^"]+)" fill="([^"]+)"/g)].map(([, points, fill]) => ({
    polygon: points.split(' ').map((p) => p.split(',').map(Number)),
    fill,
  }));
}

test("under the fin's root, where the crown falls away, the body's paint shows, not the fin's", () => {
  for (const type of ['B772', 'A320']) {
    const shape = byType(type);
    const projection = sideProjection(shape);
    const root = shape.fin.leading[0][1];
    const x = shape.fin.trailing[0][0] - 0.3;
    assert.ok(crownAt(shape, x) < root - 0.1, `${type}: the crown falls away under the fin`);
    const svg = renderSide(united, { shape, side: 'left' });
    const [u, v] = projection.uv(x, (root + crownAt(shape, x)) / 2);
    const point = [u * projection.width, (1 - v) * projection.height];
    const paint = drawnIn(svg, 'finfoot').filter(({ polygon }) => inside(point, polygon));
    assert.ok(paint.length > 0, `${type}: the body's paint is under the fin's root`);
    assert.equal(paint.at(-1).fill.toUpperCase(), united.palette.white.hex, `${type}: in the body's white`);
  }
});
