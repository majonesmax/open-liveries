// Each public export does what renderer/README.md says, on real schemes and shapes from the dataset.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as api from '../dist/index.js';

const root = new URL('../../', import.meta.url);
const scheme = (ref) => JSON.parse(readFileSync(new URL(`liveries/${ref}.json`, root)));
const shape = (id) => JSON.parse(readFileSync(new URL(`shapes/${id}.json`, root)));
const svgOk = (svg) => {
  assert.match(svg, /^<svg [^>]*viewBox="[\d. -]+"/);
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
};

test('exports exactly the documented API', () => {
  assert.deepEqual(Object.keys(api).sort(), [
    'NARROWBODY',
    'NEUTRAL',
    'PROPELLER',
    'REGIONAL',
    'SHAPES',
    'UNPAINTED_FUSELAGE',
    'WIDEBODY',
    'belowLabelCount',
    'colorOf',
    'fuselageProfile',
    'isMeasuredShape',
    'measuredShapeProblems',
    'renderBelow',
    'renderSide',
    'renderTexture',
    'schemeOn',
    'shapeNamed',
    'shapeProblems',
    'sideProjection',
    'spinnerPaint',
    'stubPylonColor',
    'wingletBox',
  ]);
});

test('renderSide and renderBelow draw a scheme on built-in and measured shapes', () => {
  const s = scheme('BAW/standard');
  for (const options of [{}, { shape: api.WIDEBODY, side: 'right' }, { shape: shape('A320') }])
    svgOk(api.renderSide(s, options));
  svgOk(api.renderBelow(s));
  svgOk(api.renderBelow(scheme('AIC/standard'), { shape: api.WIDEBODY }));
});

test('belowLabelCount counts belly and under-wing lettering', () => {
  assert.ok(api.belowLabelCount(scheme('AIC/standard')) > 0);
  assert.equal(api.belowLabelCount({ ...scheme('BAW/standard'), titles: [], logos: [] }), 0);
});

test('renderTexture paints every part', () => {
  const s = scheme('BAW/standard');
  for (const part of ['fuselage', 'fin', 'engine', 'winglet'])
    svgOk(api.renderTexture(s, part, { shape: shape('A320') }));
});

test('shapes: built-in by name, problems found, measured ones told apart', () => {
  assert.equal(api.shapeNamed('widebody'), api.WIDEBODY);
  assert.equal(api.shapeNamed('no-such-shape'), undefined);
  assert.deepEqual(Object.keys(api.SHAPES).sort(), ['narrowbody', 'regional', 'widebody']);
  for (const s of Object.values(api.SHAPES)) assert.deepEqual(api.shapeProblems(s), []);
  assert.ok(api.shapeProblems({}).length > 0);
  assert.ok(api.isMeasuredShape(shape('A320')));
  assert.ok(!api.isMeasuredShape(api.NARROWBODY));
  for (const f of readdirSync(new URL('shapes/', root)))
    assert.deepEqual(api.measuredShapeProblems(shape(f.replace('.json', ''))), [], f);
  assert.ok(api.measuredShapeProblems({}).length > 0);
});

test('a bad shape is refused with what is wrong', () => {
  assert.throws(() => api.renderSide(scheme('BAW/standard'), { shape: { name: 'broken' } }), /broken/);
});

test('3D helpers: projection, profile, winglet box', () => {
  const p = api.sideProjection();
  assert.equal(p.width, 1000);
  const [u, v] = p.uv(0, 0);
  assert.ok(u >= 0 && u <= 1 && v >= 0 && v <= 1);
  const profile = api.fuselageProfile(shape('A320'));
  const mid = profile(0.5);
  assert.ok(mid.crown > 0 && mid.belly < 0, 'crown above the centerline, belly below');
  const box = api.wingletBox(shape('A320'));
  assert.equal(box.length, 4);
  assert.ok(box[0] < box[2] && box[1] < box[3]);
});

test('colors: palette names, hexes and fallbacks', () => {
  const s = scheme('BAW/standard');
  const name = Object.keys(s.palette)[0];
  assert.equal(api.colorOf(s, name, '#000'), s.palette[name].hex);
  assert.equal(api.colorOf(s, '#123456', '#000'), '#123456');
  assert.equal(api.colorOf(s, 'not-in-the-palette', '#abcdef'), '#abcdef');
  assert.equal(api.colorOf(s, undefined, '#abcdef'), '#abcdef');
  for (const c of [...Object.values(api.NEUTRAL), api.PROPELLER.blades, api.UNPAINTED_FUSELAGE])
    assert.match(c, /^#[0-9a-f]{6}$/i);
});

test('rear engines and propellers: stub pylon and spinner colors', () => {
  const b712 = shape('B712');
  const engine = b712.engines.findIndex((e) => e.pylon);
  assert.match(api.stubPylonColor(scheme('BAW/standard'), b712, engine), /^#[0-9a-f]{6}$/i);
  assert.equal(api.stubPylonColor(scheme('BAW/standard'), shape('A320'), 0), undefined);
  const spinner = api.spinnerPaint(scheme('BAW/standard'));
  assert.ok(spinner === undefined || typeof spinner === 'string');
});

test('schemeOn lays a type entry over the scheme', () => {
  const s = scheme('BAW/standard');
  assert.equal(api.schemeOn(s, api.NARROWBODY).id, s.id);
  const typed = Object.keys(s.types ?? {});
  if (typed.length) assert.notDeepEqual(api.schemeOn(s, shape(typed[0])), s);
});

test('titles are escaped', () => {
  const s = {
    ...scheme('BAW/standard'),
    titles: [{ text: 'A & B <"C">', place: 'fuselage', at: [0.3, 0.2], height: 0.1 }],
  };
  const svg = api.renderSide(s);
  assert.ok(svg.includes('A &amp; B &lt;&quot;C&quot;&gt;'));
  assert.ok(!svg.includes('<"C">'));
});
