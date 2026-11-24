// An aircraft built in three.js from a measured shape (shapes/<type>.json, docs/SHAPES.md), wearing a scheme. The
// same frame as model.ts: meters, x back from the nose, y up from the fuselage's centerline, z out to the left.
//
// - **Fuselage:** a loft round the measured crown, belly and half-width: at each x, two quarter-ellipses a side
//   from the widest line up to the crown and down to the belly (docs/SHAPES.md). Texture coordinates along it and
//   round it from the belly up the left side, so `renderTexture(scheme, 'fuselage')` fits it as is.
// - **Fin:** flat, its fillet included; each face wears the fin as seen from that side, through `sideProjection`.
// - **Wings, tailplane:** airfoils between their measured edges at their measured heights; wingtips thin. A T-tail's
//   tailplane (`stabilizer.mount: 'fin'`) is built the same way, at its height on the fin.
// - **Engines:** nacelles turned round their measured top and bottom wearing `renderTexture(scheme, 'engine')`, with
//   an inlet lip, a fan and a pylon: under a wing as the side view draws it; on the fuselage (`mount: 'fuselage'`)
//   its stub pylon, a thick airfoil from the fuselage's side to the nacelle's middle between its measured edges; with a
//   propeller (a turboprop's), the nacelle as wide as its plan, the spinner, blades and a faint disc, and no pylon.

import * as THREE from 'three';
import {
  colorOf,
  NEUTRAL,
  PROPELLER,
  sideProjection,
  wingletBox,
  spinnerPaint,
  stubPylonColor,
  UNPAINTED_FUSELAGE,
} from '../../../../renderer/dist/index.js';
import type { Livery, MeasuredShape } from '../../../../renderer/dist/index.js';
import { finMaterial, finUv, lerp, paint, surface } from './model.js';
import { liftingSurface, nacelle, propeller, pylon } from './parts.js';
import type { Station } from './parts.js';
import type { Grid, Textures } from './model.js';

type Line = readonly (readonly [number, number])[];

/** b at a along a line of [a, b] points, held level beyond its ends. */
function at(line: Line, a: number): number {
  const sorted = [...line].sort((p, q) => p[0] - q[0]);
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return 0;
  if (a <= first[0]) return first[1];
  if (a >= last[0]) return last[1];
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i - 1];
    const q = sorted[i];
    if (p && q && a <= q[0]) return q[0] === p[0] ? q[1] : p[1] + ((q[1] - p[1]) * (a - p[0])) / (q[0] - p[0]);
  }
  return last[1];
}

/** A line's points as [b, a]: to look up x by height on a side-view line given as [x, z]. */
const flip = (line: Line): Line => line.map(([a, b]) => [b, a]);
const ends = (line: Line, i: 0 | 1): [number, number] => {
  const values = line.map((p) => p[i]);
  return [Math.min(...values), Math.max(...values)];
};

export function buildMeasuredAircraft(scheme: Livery, shape: MeasuredShape, textures: Textures): THREE.Group {
  const group = new THREE.Group();
  const { fuselage, fin, wing, stabilizer, wingtip } = shape;
  const L = fuselage.length;
  const color = (name: string | undefined, fallback: string): string => colorOf(scheme, name, fallback);
  const crown = (x: number): number => at(fuselage.crown, x);
  const belly = (x: number): number => at(fuselage.belly, x);
  const half = (x: number): number => at(fuselage.halfWidth, x);

  // The widest line sits `widest` above the middle where the fuselage is a full tube; toward the nose and the tail
  // it's carried at the same share of the radius.
  let tube = 0;
  let tubeMiddle = 0;
  for (const [x] of fuselage.crown) {
    const r = (crown(x) - belly(x)) / 2;
    if (r > tube) [tube, tubeMiddle] = [r, (crown(x) + belly(x)) / 2];
  }
  const widestOffset = (fuselage.widest ?? tubeMiddle) - tubeMiddle;
  /** The widest line's height at x. */
  const widestAt = (x: number): number => {
    const top = crown(x);
    const bottom = belly(x);
    const r = (top - bottom) / 2;
    return (top + bottom) / 2 + (tube > 0 ? (widestOffset * r) / tube : 0);
  };

  // An upper deck above the main tube (a 747's hump) is part of the same section, so the fuselage's texture runs on
  // over it. Where the deck stands highest its section is the drawing's own (hump.section, the front view's outline
  // from its top down to where it meets the tube): the deck adds to the tube's height at each lateral what that
  // outline has over the tube there. Along the fuselage that addition is scaled by the hump's height over the main
  // crown (its side-view line), and across by the fuselage's width, so the silhouette follows the hump's crown from
  // the nose, where it starts at the crown, and the deck's sides curve continuously into its top and the tube.
  const hump = fuselage.hump;
  const humpEnds = hump ? [Math.min(...hump.crown.map(([x]) => x)), Math.max(...hump.crown.map(([x]) => x))] : [];
  const tubeUpper = (x: number, lateral: number): number => {
    const top = crown(x);
    const widest = widestAt(x);
    const t = Math.min(Math.abs(lateral) / (half(x) || 1), 1);
    return widest + (top - widest) * Math.sqrt(1 - t * t);
  };
  // The station where the deck stands highest over the main crown, where its section is drawn.
  let refX = humpEnds[0] ?? 0;
  if (hump)
    for (const [x] of hump.crown) if (at(hump.crown, x) - crown(x) > at(hump.crown, refX) - crown(refX)) refX = x;
  const refRise = hump ? at(hump.crown, refX) - crown(refX) : 0;
  const section = hump?.section ? [...hump.section].sort((p, q) => p[0] - q[0]) : undefined;
  const sectionEnd = section ? Math.max(...section.map(([y]) => y)) : 0;
  /** What the deck adds to the tube's height at a lateral, where it stands highest. */
  const deckRise = (lateral: number): number => {
    const a = Math.abs(lateral);
    if (section) return a >= sectionEnd ? 0 : Math.max(0, at(section, a) - tubeUpper(refX, a));
    // No drawn section: a rounded lobe of the deck's width.
    const t = Math.min(a / ((hump?.width ?? 0) / 2 || 1), 1);
    return refRise * (1 - t * t) ** 0.6;
  };
  const withHump = (x: number, lateral: number, height: number): number => {
    if (!hump || refRise <= 0 || x < (humpEnds[0] ?? 0) || x > (humpEnds[1] ?? 0)) return height;
    const scale = Math.max(at(hump.crown, x) - crown(x), 0) / refRise;
    return scale > 0 ? height + scale * deckRise((lateral * half(refX)) / (half(x) || 1)) : height;
  };

  // The fuselage: u along it, v round it from the belly up the left side and down the right.
  const body = surface(
    (u, v) => {
      const x = u * L;
      const top = crown(x);
      const bottom = belly(x);
      const widest = widestAt(x);
      const angle = v * 2 * Math.PI; // 0 at the belly, π at the crown
      const c = Math.cos(angle);
      const y = c > 0 ? widest - (widest - bottom) * c : widest - (top - widest) * c;
      const lateral = half(x) * Math.sin(angle);
      return new THREE.Vector3(x, c < 0 ? withHump(x, lateral, y) : y, lateral);
    },
    [400, hump ? 384 : 96],
    new THREE.Vector3(0, 0, 1),
    // Where the deck lifts the surface, the texture follows the height: a point takes the row the main tube has at
    // that height (the crown's above it), so the deck's sides wear the paint and windows at their height, unstretched,
    // and the texture runs on into the tube's. Elsewhere this gives each point's own row.
    hump
      ? (u, v, p) => {
          if (v <= 0.25 || v >= 0.75) return [u, v];
          const x = u * L;
          const top = crown(x);
          const widest = widestAt(x);
          const angle = Math.acos(-Math.min(Math.max((p.y - widest) / (top - widest || 1), 0), 1));
          return [u, (v < 0.5 ? angle : 2 * Math.PI - angle) / (2 * Math.PI)];
        }
      : undefined,
  );
  group.add(new THREE.Mesh(body, paint('#ffffff', { map: textures.fuselage })));
  const endGap = (crown(L) - belly(L)) / 2;
  if (endGap > 0.05) {
    const cap = new THREE.Mesh(
      new THREE.CircleGeometry(endGap, 32),
      paint(color(scheme.fuselage?.base, UNPAINTED_FUSELAGE)),
    );
    cap.position.set(L, (crown(L) + belly(L)) / 2, 0);
    cap.rotation.y = Math.PI / 2;
    group.add(cap);
  }

  // The fin, from a little inside the fuselage to its tip; ahead of the leading edge, the fillet where there is one.
  const projection = sideProjection(shape);
  const [leadingLow, tip] = ends(fin.leading, 1);
  const [trailingLow] = ends(fin.trailing, 1);
  const fillet = fin.fillet && fin.fillet.length > 1 ? flip(fin.fillet) : undefined;
  const [filletLow, filletHigh] = fin.fillet ? ends(fin.fillet, 1) : [0, 0];
  const bottom = Math.min(leadingLow, trailingLow, fillet ? filletLow : Infinity) - 0.4;
  const finPoint: Grid = (u, v) => {
    const z = lerp(bottom, tip, v);
    let leading = at(flip(fin.leading), z);
    if (fillet && z >= filletLow && z <= filletHigh) leading = Math.min(leading, at(fillet, z));
    const trailing = at(flip(fin.trailing), z);
    return new THREE.Vector3(lerp(leading, trailing, u), z, 0);
  };
  // Each face stands off the middle by half a 10% airfoil's thickness, so the fin has an edge and catches the light.
  const finFace =
    (face: number): Grid =>
    (u, v) => {
      const p = finPoint(u, v);
      const chord = finPoint(1, v).x - finPoint(0, v).x;
      const a = Math.min(Math.max(u, 0), 1);
      const half = 5 * 0.1 * (0.2969 * Math.sqrt(a) - 0.126 * a - 0.3516 * a ** 2 + 0.2843 * a ** 3 - 0.1036 * a ** 4);
      return p.setZ(face * half * chord);
    };
  group.add(
    new THREE.Mesh(
      surface(finFace(1), [32, 48], new THREE.Vector3(0, 0, 1), finUv(projection, 'left')),
      finMaterial(textures.finLeft),
    ),
  );
  group.add(
    new THREE.Mesh(
      surface(finFace(-1), [32, 48], new THREE.Vector3(0, 0, -1), finUv(projection, 'right')),
      finMaterial(textures.finRight),
    ),
  );

  const wingTop = color(scheme.wings?.top ?? scheme.wings?.under, NEUTRAL.wings);
  const wingUnder = color(scheme.wings?.under ?? scheme.wings?.top, NEUTRAL.wings);
  const tail = scheme.stabilizer ?? {};
  const tailTop = color(tail.top ?? tail.under ?? scheme.wings?.top, NEUTRAL.wings);
  const tailUnder = color(tail.under ?? tail.top ?? scheme.wings?.under, NEUTRAL.wings);
  const winglets = scheme.winglets ?? {};
  const wingletOuter = color(winglets.outer, NEUTRAL.winglets);
  const wingletInner = color(winglets.inner ?? winglets.outer, NEUTRAL.winglets);
  const engines = scheme.engines ?? {};
  const cowling = color(engines.cowling, NEUTRAL.engines);

  for (const side of [1, -1]) {
    // Wings and tailplane: between their edges from above, at their heights from the front, with an airfoil's
    // thickness (a top and an underside).
    const lifting = (part: typeof wing, thickness: { root: number; tip: number }, top: string, under: string): void => {
      const [root, span] = ends(part.leading, 0);
      const station = (v: number): Station => {
        const y = lerp(root, span, v);
        return { leading: at(part.leading, y), trailing: at(part.trailing, y), height: at(part.z, y), out: y };
      };
      group.add(liftingSurface(station, thickness, { top, under }, side));
      // Inboard of its root (measured at the fuselage's widest), the root's section carried in to the centerline:
      // a low or high wing meets the fuselage where its section is narrower than its widest, and the fuselage
      // hides the rest.
      if (root > 0) {
        const inner = { ...station(0), out: 0 };
        const stub = (v: number): Station => ({ ...inner, out: lerp(0, root, v) });
        group.add(liftingSurface(stub, { root: thickness.root, tip: thickness.root }, { top, under }, side, 2, false));
      }
    };
    lifting(wing, { root: 0.14, tip: 0.1 }, wingTop, wingUnder);

    // The flap track fairings: canoes under the wing (docs/SHAPES.md), from inside it down to their depth below its
    // lower surface, deepest a little aft of their middle and closing to a point behind the trailing edge, as the side
    // view draws them; round in section, their width from the front view (as deep as they are where not measured).
    for (const f of wing.fairings ?? []) {
      const [front, back] = f.x;
      const top = at(wing.z, f.y);
      const chord = at(wing.trailing, f.y) - at(wing.leading, f.y);
      // From the wing's middle: half its thickness (about a tenth of the chord) and the fairing's depth below that.
      const drop = 0.05 * chord + f.depth;
      const width = f.width ?? f.depth;
      const along = (t: number): number =>
        t < 0.55 ? Math.sin((t / 0.55) * (Math.PI / 2)) ** 0.7 : Math.cos(((t - 0.55) / 0.45) * (Math.PI / 2)) ** 1.4;
      const point: Grid = (u, v) => {
        const k = along(u);
        const a = v * 2 * Math.PI;
        return new THREE.Vector3(
          lerp(front, back, u),
          top - (drop * k) / 2 - ((drop * k) / 2) * Math.cos(a),
          side * (f.y + ((width * k) / 2) * Math.sin(a)),
        );
      };
      group.add(
        new THREE.Mesh(
          surface(point, [24, 16], new THREE.Vector3(0, -1, 0)),
          paint(wingUnder, { side: THREE.DoubleSide }),
        ),
      );
    }
    lifting(stabilizer, { root: 0.1, tip: 0.08 }, tailTop, tailUnder);

    // A wingtip device: its edges from the side by height, from its root on the wing's tip (docs/SHAPES.md) to its
    // tip, out from the centerline along its front-view line.
    if (wingtip && wingtip.leading.length > 1 && wingtip.trailing.length > 1) {
      const [, span] = ends(wing.leading, 0);
      const [low, high] = ends(wingtip.leading, 1);
      const point: Grid = (u, v) => {
        const z = lerp(low, high, v);
        const y = wingtip.front && wingtip.front.length > 1 ? at(flip(wingtip.front), z) : span;
        return new THREE.Vector3(lerp(at(flip(wingtip.leading), z), at(flip(wingtip.trailing), z), u), z, side * y);
      };
      // Its outer face wears the winglet as seen from that side (its areas and logos), mapped through the side view
      // into the picture's box (`wingletBox`), as the fin's face is; plain in its paint without a picture.
      const map = side > 0 ? textures.wingletLeft : textures.wingletRight;
      const box = wingletBox(shape);
      if (map && box) {
        const [u0, v0, u1, v1] = box;
        const uv = (_u: number, _v: number, p: THREE.Vector3): [number, number] => {
          const [pu, pv] = projection.uv(p.x, p.y);
          return [side > 0 ? (pu - u0) / (u1 - u0) : (u1 - pu) / (u1 - u0), (pv - v0) / (v1 - v0)];
        };
        group.add(
          new THREE.Mesh(surface(point, [2, 16], new THREE.Vector3(0, 0, side), uv), paint('#ffffff', { map })),
        );
      } else {
        group.add(new THREE.Mesh(surface(point, [2, 16], new THREE.Vector3(0, 0, side)), paint(wingletOuter)));
      }
      group.add(new THREE.Mesh(surface(point, [2, 16], new THREE.Vector3(0, 0, -side)), paint(wingletInner)));
    }

    // Engines: turned round the middle of their top and bottom lines, wearing the engine texture; an inlet lip and
    // fan; a pylon up into the wing, as the side view draws it.
    for (const [listed, e] of shape.engines.entries()) {
      // A tail engine is built once, below; the others are counted without it (the renderer's engines).
      if (e.mount === 'tail') continue;
      const index = listed - shape.engines.slice(0, listed).filter((t) => t.mount === 'tail').length;
      const [nose, back] = e.x;
      const centre = (x: number): number => (at(e.top, x) + at(e.bottom, x)) / 2;
      const radius = (x: number): number => Math.max((at(e.top, x) - at(e.bottom, x)) / 2, 0.05);
      // The nacelle starts at its lip: the first station within its first meter that opens to 85% of the widest
      // there (a traced outline's top and bottom meet at a point ahead of it, which would close the intake). A
      // turboprop's starts where its spinner's base meets it, its traced front.
      const stations = Array.from({ length: 21 }, (_, i) => nose + i * 0.05);
      const open = Math.max(...stations.map(radius));
      const front = e.propeller ? nose : (stations.find((x) => radius(x) >= 0.85 * open) ?? nose);
      const plan = e.halfWidth && e.halfWidth.length > 1 ? e.halfWidth : undefined;
      const halfWidth = plan ? (x: number): number => Math.max(at(plan, x), 0.05) : undefined;
      group.add(nacelle(front, back, centre, radius, side * e.y, textures.engine, halfWidth));
      // A propeller (a turboprop's) in place of an inlet and fan; its nacelle holds the wing, so no pylon.
      if (e.propeller) {
        const spinner = color(spinnerPaint(scheme), NEUTRAL.engines);
        group.add(propeller(e.propeller, side * e.y, spinner, PROPELLER.blades));
        continue;
      }
      const r0 = radius(front);
      if (engines.inletLip) {
        const lip = new THREE.Mesh(
          new THREE.TorusGeometry(r0 * 0.95, r0 * 0.06, 12, 40),
          paint(color(engines.inletLip, cowling), { metalness: 0.6, roughness: 0.3 }),
        );
        lip.rotation.y = Math.PI / 2;
        lip.position.set(front, centre(front), side * e.y);
        group.add(lip);
      }
      const fan = new THREE.Mesh(new THREE.CircleGeometry(r0 * 0.9, 40), paint('#2a2e35'));
      fan.rotation.y = -Math.PI / 2;
      fan.position.set(front + 0.15, centre(front), side * e.y);
      group.add(fan);
      if (e.mount === 'fuselage') {
        if (e.pylon) {
          // From inside the fuselage's side to the nacelle's middle, held level past its measured ends.
          const p = e.pylon;
          const [root] = ends([...p.leading, ...p.trailing], 0);
          const chord = (y: number): number => at(p.trailing, y) - at(p.leading, y);
          const ratio = p.thickness / Math.max(chord((root + e.y) / 2), 0.5);
          // The body's paint where it meets the fuselage, unless the scheme names it (docs/COORDINATES.md).
          const pylonColor = stubPylonColor(scheme, shape, index, side > 0 ? 'left' : 'right') ?? UNPAINTED_FUSELAGE;
          const station = (v: number): Station => {
            const y = lerp(root, e.y, v);
            return { leading: at(p.leading, y), trailing: at(p.trailing, y), height: at(p.z, y), out: y };
          };
          group.add(
            liftingSurface(station, { root: ratio, tip: ratio }, { top: pylonColor, under: pylonColor }, side, 12),
          );
        }
        continue;
      }
      const wingHeight = at(wing.z, e.y);
      if (wingHeight > centre(back)) {
        const top = (x: number): number => centre(x) + radius(x);
        const width = Math.max(r0 * 0.22, 0.2);
        group.add(pylon(front, back, top, wingHeight, side * e.y, width, color(engines.pylon, cowling)));
      }
    }
  }

  // Engines on the tail's centerline (docs/SHAPES.md): wearing the fin's pictures, which paint them with the fin's
  // paint carried down as the side view does, through the side projection (the fin's way); a straight duct's nacelle
  // round its top and bottom lines and its plan's width, on its strut; an S-duct's intake a half-pod standing on the
  // crown; a dark inlet, the lip, and the bare exhaust.
  for (const e of shape.engines) {
    if (e.mount !== 'tail') continue;
    const sDuct = e.duct === 's';
    const xs = [...e.top, ...e.bottom].map(([x]) => x);
    const [front, back] = [Math.min(...xs), Math.max(...xs)];
    const top = (x: number): number => at(e.top, x);
    const bottom = (x: number): number => Math.min(at(e.bottom, x), top(x) - 0.05);
    const width = (x: number): number =>
      Math.max(e.halfWidth && e.halfWidth.length > 1 ? at(e.halfWidth, x) : (top(x) - bottom(x)) / 2, 0.05);
    // An S-duct's intake is round round its own lip and stands on the crown: its section runs from inside the
    // fuselage up to its top, so from ahead it shows a round intake on a rounded fairing, not a half-pod.
    const low = (x: number): number => (sDuct ? Math.min(bottom(x), crown(x) - 0.1) : bottom(x));
    const centre = (x: number): number => (top(x) + low(x)) / 2;
    const rise = (x: number): number => (top(x) - low(x)) / 2;
    // The inlet: dark, its lip in the scheme's lip colour where it names one. Unless the shape gives it, it's where
    // the lip is fully open: the station within its first meter where the top and bottom lines stand furthest apart.
    const lipX = Array.from({ length: 21 }, (_, i) => front + i * 0.05).reduce((best, x) =>
      top(x) - bottom(x) > top(best) - bottom(best) ? x : best,
    );
    // A point's place in the side view, a little in from the outline's edge (where the picture's paint ends).
    const seen = (p: THREE.Vector3, c: number): [number, number] => projection.uv(p.x, c + (p.y - c) * 0.97);
    for (const side of [1, -1]) {
      const map = side > 0 ? textures.finLeft : textures.finRight;
      const uv = (_u: number, _v: number, p: THREE.Vector3): [number, number] => {
        const [pu, pv] = seen(p, centre(p.x));
        return [side > 0 ? pu : 1 - pu, pv];
      };
      // From the bottom (v 0) up this side to the top (v 1).
      const pod: Grid = (u, v) => {
        // An S-duct's fairing starts at its lip: ahead of it the lines only close the lip's rounding.
        const x = lerp(sDuct ? lipX : front, back, u);
        const a = v * Math.PI;
        return new THREE.Vector3(x, centre(x) - rise(x) * Math.cos(a), side * width(x) * Math.sin(a));
      };
      group.add(new THREE.Mesh(surface(pod, [48, 24], new THREE.Vector3(0, 0, side), uv), paint('#ffffff', { map })));
      if (e.strut && !sDuct) {
        const [s0, s1] = e.strut;
        const strut: Grid = (u, v) => {
          const x = lerp(s0, s1, u);
          return new THREE.Vector3(x, lerp(crown(x) - 0.1, centre(x), v), side * 0.35 * width(x));
        };
        group.add(
          new THREE.Mesh(surface(strut, [16, 4], new THREE.Vector3(0, 0, side), uv), paint('#ffffff', { map })),
        );
      }
    }
    const inletZ = e.inlet?.z ?? (top(lipX) + bottom(lipX)) / 2;
    const inletW = (e.inlet?.width ?? 2 * width(lipX)) / 2;
    const inletH = (e.inlet?.height ?? top(lipX) - bottom(lipX)) / 2;
    const fan = new THREE.Mesh(new THREE.CircleGeometry(1, 40), paint('#2a2e35'));
    fan.scale.set(inletW * 0.88, inletH * 0.88, 1);
    fan.rotation.y = -Math.PI / 2;
    fan.position.set(lipX + 0.1, inletZ, 0);
    group.add(fan);
    if (engines.inletLip) {
      const lip = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.06, 12, 40),
        paint(color(engines.inletLip, cowling), { metalness: 0.6, roughness: 0.3 }),
      );
      lip.scale.set(inletW * 0.95, inletH * 0.95, Math.min(inletW, inletH));
      lip.rotation.y = Math.PI / 2;
      lip.position.set(lipX, inletZ, 0);
      group.add(lip);
    }
    if (e.nozzle) {
      const { top: nt, bottom: nb } = e.nozzle;
      const ns = [...nt, ...nb].map(([x]) => x);
      const [n0, n1] = [Math.min(...ns), Math.max(...ns)];
      const nozzle: Grid = (u, v) => {
        const x = lerp(n0, n1, u);
        const r = Math.max((at(nt, x) - at(nb, x)) / 2, 0.02);
        const a = v * 2 * Math.PI;
        return new THREE.Vector3(x, (at(nt, x) + at(nb, x)) / 2 - r * Math.cos(a), r * Math.sin(a));
      };
      group.add(
        new THREE.Mesh(
          surface(nozzle, [24, 32], new THREE.Vector3(0, -1, 0)),
          paint('#9da4ac', { metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }),
        ),
      );
    }
  }

  // Centered on the origin, nose toward −x.
  group.position.x = -L / 2;
  const holder = new THREE.Group();
  holder.add(group);
  return holder;
}
