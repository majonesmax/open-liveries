// Paint fitted to another type by its landmarks (docs/COORDINATES.md, Landmarks).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { areaUnder, finClearance, paintClearance, titleBox, wingOnBody } from '../dist/fit-labels.js';
import { alongBody, fitScheme } from '../dist/landmarks.js';
import { layoutMeasured } from '../dist/measured.js';

const root = new URL('../../', import.meta.url);
const shape = (id) => layoutMeasured(JSON.parse(readFileSync(new URL(`shapes/${id}.json`, root))));
const scheme = (ref) => JSON.parse(readFileSync(new URL(`liveries/${ref}.json`, root)));
const shapeIds = readdirSync(new URL('shapes/', root)).map((f) => f.replace('.json', ''));
const shapeFiles = shapeIds.map((id) => JSON.parse(readFileSync(new URL(`shapes/${id}.json`, root))));
/** The shape measured for a designator: of that id, else the first serving it. */
const byId = (t) => (shapeIds.includes(t) ? t : shapeFiles.find((f) => f.types.includes(t))?.id);

// A title on one painted area where it was measured stays on it on every other type: Sun Country's white
// "sun country" ran off its orange onto the white body on a 747-400.
test('a title on one area stays on it', () => {
  const s = scheme('SCX/standard');
  const from = shape('B738');
  for (const id of shapeIds) {
    const to = shape(id);
    const fitted = fitScheme(s, from, to);
    s.titles.forEach((t, i) => {
      if (t.place !== 'fuselage') return;
      const under = areaUnder(s.fuselage.areas, titleBox(t));
      if (under === undefined) return;
      const f = fitted.titles[i];
      for (const p of titleBox(f))
        assert.equal(
          areaUnder(fitted.fuselage.areas, [p]),
          under,
          `${t.text} on ${id}: [${p.map((v) => v.toFixed(3))}] off its area`,
        );
    });
  }
});

// Along the body, paint keeps to its part of the aircraft: a position can't jump the length of it. A windowless
// freighter's missing cabin windows were taken as landmarks at its nose, and a 767F's titles (ABX, DHL, Amazon)
// went to the tail of every other type.
test('along the body, nothing jumps: every pair of shapes', () => {
  const all = shapeIds.map((id) => [id, shape(id)]);
  for (const [a, from] of all)
    for (const [b, to] of all) {
      const X = alongBody(from, to);
      let last = -Infinity;
      for (let x = 0; x <= 1.0001; x += 0.02) {
        const y = X(x);
        assert.ok(Math.abs(y - x) < 0.25, `${a} → ${b}: ${x.toFixed(2)} went to ${y.toFixed(2)}`);
        assert.ok(y > last, `${a} → ${b}: not increasing at ${x.toFixed(2)}`);
        last = y;
      }
    }
});

// A title clear of the wing where it was measured stays clear of it: Asiana's, under the windows on its A321neo,
// ran into the 747's and A380's wing roots.
test('a title clear of the wing stays clear of it', () => {
  const hits = (g, t) => {
    const wing = wingOnBody(g);
    return titleBox(t).some(([x, y]) => {
      let hit = false;
      for (let i = 0, j = wing.length - 1; i < wing.length; j = i++) {
        const [xi, yi] = wing[i];
        const [xj, yj] = wing[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    });
  };
  for (const ref of ['AAR/standard', 'SCX/standard', 'UAL/standard', 'DLH/standard']) {
    const s = scheme(ref);
    const from = shape(byId(s.drawnOn));
    for (const id of shapeIds) {
      const fitted = fitScheme(s, from, shape(id));
      s.titles.forEach((t, i) => {
        if (t.place !== 'fuselage' || !t.length || hits(from, t)) return;
        assert.ok(!hits(shape(id), fitted.titles[i]), `${ref} "${t.text}" on ${id}: into the wing`);
      });
    }
  }
});

/** Fuselage y at fuselage x of a height in meters, on a laid-out shape. */
const yAt = (g, x, z) => {
  const { crown, belly } = g.profile(x);
  const v = (z - (crown + belly) / 2) / ((crown - belly) / 2);
  return (Math.asin(Math.max(-1, Math.min(1, v))) * 2) / Math.PI;
};
const inside = ([px, py], poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

// Paint near the windows keeps to them where they go, and stays the stripe it is: American's tri-color, measured on
// the 737-800, had its windows hanging below the blue at a 747's nose and tail and an A380's, its blue climbing round
// the regional jets' windshields and up to a 747's flight deck, and starting behind a 747's first main-deck windows
// (its cockpit, a landmark, is upstairs). On a freighter, where its passenger version's windows are.
test('a stripe along the windows stays along them, and a stripe', () => {
  const s = scheme('AAL/tri-color-1968');
  const blue = s.fuselage.areas.findIndex((a) => a.color === 'blue');
  const from = shape('B738');
  for (const id of shapeIds) {
    const file = shapeFiles.find((f) => f.id === id);
    const to = shape(id);
    if (!to.windows.line) continue; // no windows, and no passenger version's to go by (the 727F, the C-17)
    const poly = fitScheme(s, from, to).fuselage.areas[blue].points;
    const xs = poly.map(([x]) => x);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [z0, z1] = file.cabin.windows.z;
    const [w0, w1] = file.cabin.windows.wouldBe ?? [0, 0];
    const windows = file.cabin.windows.x.length
      ? file.cabin.windows.x.map((m) => to.share(m))
      : Array.from({ length: 21 }, (_, k) => to.share(w0 + ((w1 - w0) * k) / 20));
    // Behind the cockpit, where the blue starts; all of them under a 747's upstairs flight deck.
    const { line, flightDeck } = to.windows;
    const upstairs = flightDeck - line[1] > 0.4 * to.shape.fuselage.radius;
    const behind = upstairs ? 0 : to.share(to.shape.cockpit.to);
    for (const x of windows.filter((x) => x > behind && x < x1 - 0.01)) {
      const [lo, hi] = [yAt(to, x, z0), yAt(to, x, z1)];
      for (const y of [lo + 0.25 * (hi - lo), hi - 0.25 * (hi - lo)])
        assert.ok(inside([x, y], poly), `${id}: the window at ${x.toFixed(3)} (y ${y.toFixed(3)}) outside the blue`);
    }
    // Its height in meters anywhere along it: no more than half as much again as along the cabin.
    const tall = (x) => {
      const ys = [];
      for (let y = -1; y <= 1; y += 0.005) if (inside([x, y], poly)) ys.push(y);
      if (!ys.length) return 0;
      const { crown, belly } = to.profile(x);
      const r = (crown - belly) / 2;
      const s = (v) => Math.sin((v * Math.PI) / 2);
      return r * (s(Math.max(...ys)) - s(Math.min(...ys)));
    };
    const cabin = tall(
      file.cabin.windows.x.length ? to.share((file.cabin.windows.x.at(0) + file.cabin.windows.x.at(-1)) / 2) : 0.4,
    );
    for (let x = x0 + 0.002; x < x1; x += 0.004)
      assert.ok(
        tall(x) <= cabin * 1.5,
        `${id}: the blue ${tall(x).toFixed(2)} m tall at ${x.toFixed(3)}, ${cabin.toFixed(2)} m along the cabin`,
      );
  }
});

// A title on the bare body where it was measured stays off the paint, with at least half its gap to it (in meters,
// grown with the body): American's red name, above the tri-color's stripes on the 737, sat on the blue's top edge on
// an A380.
test('a title on the bare body keeps clear of the paint', () => {
  const s = scheme('AAL/tri-color-1968');
  const from = shape('B738');
  s.titles.forEach((t) => assert.equal(areaUnder(s.fuselage.areas, titleBox(t)), undefined));
  const measured = s.titles.map((t) => paintClearance(from, t, s.fuselage.areas));
  for (const id of shapeIds) {
    const to = shape(id);
    const fitted = fitScheme(s, from, to);
    fitted.titles.forEach((f, i) => {
      if (f.place !== 'fuselage') return;
      const grown = to.shape.fuselage.radius / from.shape.fuselage.radius;
      const gap = paintClearance(to, f, fitted.fuselage.areas);
      assert.ok(
        gap >= measured[i] * grown * 0.5 - 1e-6,
        `${f.text} on ${id}: ${gap.toFixed(2)} m from the paint, measured ${measured[i].toFixed(2)} m`,
      );
    });
  }
});

// Paint over the crown toward the tail stays over it: Lufthansa's navy tail, from the A320, had a bare sliver along
// its top on a 747 and an A380 where the crown comes down near the windows.
test('paint over the crown stays over it', () => {
  const s = scheme('DLH/standard');
  const from = shape('A320');
  for (const id of shapeIds) {
    const to = shape(id);
    const poly = fitScheme(s, from, to).fuselage.areas[0].points;
    const X = alongBody(from, to);
    for (const x of [0.82, 0.87, 0.92])
      assert.ok(inside([X(x), 0.97], poly), `${id}: bare under the crown at ${X(x).toFixed(3)}`);
  }
});

// A title keeps its size, grown with the body: Sun Country's name, just behind a 737's cockpit, went to a 747's nose
// at a sixth of its size when its upstairs flight deck was left out of the landmarks for lettering too.
test('a title keeps its size on every type', () => {
  const from = shape('B738');
  const s = (v) => Math.sin((v * Math.PI) / 2);
  const meters = (g, t) => {
    const { crown, belly } = g.profile(t.at[0]);
    return ((crown - belly) / 2) * (s(t.at[1] + t.height) - s(t.at[1]));
  };
  for (const ref of ['SCX/standard', 'AAL/tri-color-1968']) {
    const sc = scheme(ref);
    const t = sc.titles.find((t) => t.place === 'fuselage');
    for (const id of shapeIds) {
      const to = shape(id);
      const f = fitScheme(sc, from, to).titles.find((t) => t.place === 'fuselage');
      const grown = to.shape.fuselage.radius / from.shape.fuselage.radius;
      assert.ok(meters(to, f) >= 0.5 * grown * meters(from, t), `${ref} on ${id}: ${meters(to, f).toFixed(2)} m tall`);
    }
  }
});

// The cockpit's windows are on bare metal on American's tri-color, the blue starting behind them (N921NN's photo):
// on every type no stripe runs over a cockpit pane. Drawn from the windshield back, the blue had wrapped a CRJ200's
// big, low cockpit windows.
test('no stripe over the cockpit windows', () => {
  const s = scheme('AAL/tri-color-1968');
  const from = shape('B738');
  for (const id of shapeIds) {
    const to = shape(id);
    if (!to.windows.line) continue; // drawn as written: no windows, nor a passenger version's (the 727F, the C-17)
    const fitted = fitScheme(s, from, to).fuselage.areas;
    for (const pane of to.measured?.glass.cockpit ?? []) {
      const xs = pane.map(([x]) => x);
      const ys = pane.map(([, y]) => y);
      const middle = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
      for (const a of fitted)
        assert.ok(
          !inside(middle, a.points),
          `${id}: the ${a.color} over a cockpit pane at ${middle.map((v) => v.toFixed(3))}`,
        );
    }
  }
});

// Fin lettering and logos keep clear of the fin's edges as where they were measured (grown with the fin): Spirit's
// diagonal name, clear of its A320's edges, crowded a 747's leading edge. Every scheme on every type.
test('fin lettering and logos keep clear of the fin edges', () => {
  const all = readdirSync(new URL('liveries/', root)).flatMap((a) =>
    readdirSync(new URL(`liveries/${a}/`, root)).map((f) => scheme(`${a}/${f.replace('.json', '')}`)),
  );
  const span = (g) => g.finSpan / g.scale;
  const problems = [];
  for (const s of all) {
    const id = s.drawnOn && byId(s.drawnOn);
    if (!id) continue;
    const from = shape(id);
    const items = [...(s.titles ?? []), ...(s.logos ?? [])].filter((i) => i.place === 'fin');
    if (!items.length) continue;
    for (const to of shapeIds) {
      const g = shape(to);
      const fitted = fitScheme(s, from, g);
      const after = [...(fitted.titles ?? []), ...(fitted.logos ?? [])].filter((i) => i.place === 'fin');
      items.forEach((item, k) => {
        const measured = finClearance(from, item);
        if (measured <= 0) return;
        const got = finClearance(g, after[k]);
        if (got < measured * 0.75 * (span(g) / span(from)) - 1e-6)
          problems.push(
            `${s.airline}/${s.id} ${item.text ?? item.mark} on ${to}: ${got.toFixed(2)} m, measured ${measured.toFixed(2)} m`,
          );
      });
    }
  }
  assert.deepEqual(problems.slice(0, 15), [], `${problems.length} too near a fin edge`);
});

// On a T-tail, fin lettering keeps clear of the tailplane drawn across the fin's top as of the fin's edges: Spirit's
// name, kept clear of a 717's fin edges, came within 7 cm of its tailplane.
test('fin lettering keeps clear of a T-tail tailplane', () => {
  const s = scheme('NKS/standard');
  const [from, t] = [shape('A320'), shape('B712')];
  const measured = s.titles.find((x) => x.place === 'fin');
  const fitted = fitScheme(s, from, t).titles.find((x) => x.place === 'fin');
  const meters = ([px, py]) => [(px - t.fuselageX(0)) / t.scale, (t.centerY - py) / t.scale];
  const tailplane = t.stabilizerSide.map(meters);
  const distance = (p) => {
    let best = Infinity;
    for (let i = 0; i < tailplane.length; i++) {
      const [a, b] = [tailplane[i], tailplane[(i + 1) % tailplane.length]];
      const [vx, vy] = [b[0] - a[0], b[1] - a[1]];
      const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
      best = Math.min(best, Math.hypot(p[0] - a[0] - vx * u, p[1] - a[1] - vy * u));
    }
    return best;
  };
  const [ax, ay] = meters(t.finPoint(fitted.at[0], fitted.at[1]));
  const [leading, trailing] = t.finChord(fitted.at[1]);
  const run = fitted.length * (trailing - leading) * (t.fuselageLength / t.scale);
  const h = fitted.height * (t.finSpan / t.scale);
  const turn = (fitted.rotationDeg * Math.PI) / 180;
  const need = finClearance(from, measured) * 0.75 * (t.finSpan / t.scale / (from.finSpan / from.scale));
  for (let i = 0; i <= 8; i++)
    for (const k of [0, 0.5, 1]) {
      const along = (run * i) / 8;
      const p = [
        ax + Math.cos(turn) * along - Math.sin(turn) * h * k,
        ay + Math.sin(turn) * along + Math.cos(turn) * h * k,
      ];
      assert.ok(
        !inside(p, tailplane) && distance(p) >= need - 1e-6,
        `spirit ${distance(p).toFixed(2)} m from the 717's tailplane, ${need.toFixed(2)} kept from its fin's edges`,
      );
    }
});

// A twin's fin, root to tip, covers a trijet's tail from the crown up: American's flag fin on a 727, a DC-10 and an
// L-1011 covered only the fin above the center engine or its S-duct's fairing (about a quarter of the tail seen
// from the side). Between two twins, two trijets or from a trijet to a twin, the fin's areas stay as they are.
test("a twin's fin covers a trijet's tail down to the crown", () => {
  const s = scheme('AAL/standard');
  const from = shape(s.drawnOn);
  const lowest = (fin) => Math.min(...fin.areas.flatMap((a) => a.points.map((p) => p[1])));
  for (const id of ['B722', 'B722-passenger', 'DC10', 'L101', 'L101-500', 'MD11']) {
    const to = shape(id);
    const foot = to.measured.finFoot;
    assert.ok(foot < -0.4, `${id}: the crown under its fin at y ${foot}`);
    const fitted = fitScheme(s, from, to).fin;
    // The flag's lowest red stripe, at y 0.117 on the A321neo's fin, is as far up from the crown on the trijet.
    const stripe = fitted.areas[3];
    const bottom = Math.min(...stripe.points.map((p) => p[1]));
    assert.ok(Math.abs(bottom - (1 - 0.883 * (1 - foot))) < 1e-9, `${id}: lowest stripe at ${bottom}`);
    // The top stays at the tip.
    assert.equal(Math.max(...fitted.areas[0].points.map((p) => p[1])), 1);
    assert.ok(lowest(fitted) < 0, id);
  }
  for (const [a, b] of [
    ['A321', 'B738'],
    ['B722', 'L101'],
    ['B722', 'B738'],
  ])
    assert.deepEqual(fitScheme(s, shape(a), shape(b)).fin, s.fin, `${a} → ${b}`);
  for (const id of ['B738', 'A321', 'B752']) assert.equal(shape(id).measured.finFoot, undefined, id);
});
