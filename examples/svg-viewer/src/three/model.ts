// An aircraft built in three.js from a renderer shape (renderer/src/shape.ts), wearing a scheme. Meters
// throughout: x back from the nose, y up from the fuselage's centerline, z out to the aircraft's left.
//
// - **Fuselage:** a loft round the renderer's own profile. Its texture coordinates are the fuselage's own (along
//   it, and round it from the belly up the left side), so `renderTexture(scheme, 'fuselage')` fits it as is.
// - **Fin:** flat. Each face takes the side view's projection as texture coordinates and wears the fin as seen from
//   that side.
// - **Wings and tailplane:** airfoils in the scheme's colors; winglets flat.
// - **Engines:** nacelles wearing `renderTexture(scheme, 'engine')`, an inlet lip, a fan and a pylon. Belly titles
//   aren't drawn.

import * as THREE from 'three';
import {
  colorOf,
  fuselageProfile,
  NEUTRAL,
  sideProjection,
  UNPAINTED_FUSELAGE,
} from '../../../../renderer/dist/index.js';
import type { AircraftShape, Livery, SideProjection } from '../../../../renderer/dist/index.js';
import { liftingSurface, nacelle, pylon } from './parts.js';
import type { Station } from './parts.js';

export interface Textures {
  fuselage: THREE.Texture;
  finLeft: THREE.Texture;
  finRight: THREE.Texture;
  engine: THREE.Texture;
  /** A winglet's outer face from each side (`renderTexture(scheme, 'winglet')`), where the shape has winglets. */
  wingletLeft?: THREE.Texture;
  wingletRight?: THREE.Texture;
}

export type Grid = (u: number, v: number) => THREE.Vector3;

/**
 * A surface from a grid of points, with texture coordinates (u, v) or ones from `uv`. Its triangles face
 * `outward` (approximately): the winding is flipped if the first one doesn't, so callers needn't think about it.
 */
export function surface(
  point: Grid,
  steps: [number, number],
  outward: THREE.Vector3,
  uv: (u: number, v: number, p: THREE.Vector3) => [number, number] = (u, v) => [u, v],
): THREE.BufferGeometry {
  const [nu, nv] = steps;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const p = point(i / nu, j / nv);
      positions.push(p.x, p.y, p.z);
      uvs.push(...uv(i / nu, j / nv, p));
    }
  }
  const at = (i: number, j: number): number => i * (nv + 1) + j;
  const p = (k: number): THREE.Vector3 =>
    new THREE.Vector3(positions[3 * k], positions[3 * k + 1], positions[3 * k + 2]);
  const normal = new THREE.Vector3()
    .subVectors(p(at(1, 0)), p(at(0, 0)))
    .cross(new THREE.Vector3().subVectors(p(at(0, 1)), p(at(0, 0))));
  const flip = normal.dot(outward) < 0;
  const indices: number[] = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const [a, b, c, d] = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      if (flip) indices.push(a, d, b, b, d, c);
      else indices.push(a, b, d, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export const paint = (color: string, options: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.45, metalness: 0.15, ...options });

const tan = (deg: number): number => Math.tan((deg * Math.PI) / 180);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * A flat fin face's texture coordinates: where the side view draws each point (`sideProjection`), across the picture
 * of the fin from that side. The right face's picture is seen from the right, so its u runs the other way.
 */
export const finUv =
  (projection: SideProjection, face: 'left' | 'right') =>
  (_u: number, _v: number, p: THREE.Vector3): [number, number] => {
    const [u, v] = projection.uv(p.x, p.y);
    return face === 'left' ? [u, v] : [1 - u, v];
  };
/** A fin face's material: its picture, with the transparent surround cut away. */
export const finMaterial = (map: THREE.Texture): THREE.MeshStandardMaterial =>
  paint('#ffffff', { map, alphaTest: 0.5 });

/** A swept surface's corners at a span fraction t: its leading and trailing edges, back from the nose. */
function chordAt(c: { rootLeading: number; rootTrailing: number; tipLeading: number; tipTrailing: number }, t: number) {
  return { leading: lerp(c.rootLeading, c.tipLeading, t), trailing: lerp(c.rootTrailing, c.tipTrailing, t) };
}

export function buildAircraft(scheme: Livery, shape: AircraftShape, textures: Textures): THREE.Group {
  const group = new THREE.Group();
  const L = shape.fuselage.length;
  const profile = fuselageProfile(shape);
  const color = (name: string | undefined, fallback: string): string => colorOf(scheme, name, fallback);

  // The fuselage, round its profile: u along it, v round it from the belly up the left side.
  const fuselage = surface(
    (u, v) => {
      const { crown, belly } = profile(u);
      const center = (crown + belly) / 2;
      const r = (crown - belly) / 2;
      const angle = v * 2 * Math.PI;
      return new THREE.Vector3(u * L, center - r * Math.cos(angle), r * Math.sin(angle));
    },
    [200, 72],
    new THREE.Vector3(0, 0, 1),
  );
  group.add(new THREE.Mesh(fuselage, paint('#ffffff', { map: textures.fuselage })));
  // The tail cone's open end.
  const end = profile(1);
  const cap = new THREE.Mesh(
    new THREE.CircleGeometry((end.crown - end.belly) / 2, 32),
    paint(color(scheme.fuselage?.base, UNPAINTED_FUSELAGE)),
  );
  cap.position.set(L, (end.crown + end.belly) / 2, 0);
  cap.rotation.y = Math.PI / 2;
  group.add(cap);

  // The fin: one face each way, each in its own side's picture.
  const projection = sideProjection(shape);
  const { fin } = shape;
  const finTip = shape.fuselage.radius + fin.height;
  const finPoint: Grid = (u, v) => {
    const fy = lerp(-0.15, 1, v);
    const { leading, trailing } = chordAt(fin, fy);
    const x = lerp(leading, trailing, u);
    const root = profile(x / L).crown;
    return new THREE.Vector3(x, root + (finTip - root) * fy, 0);
  };
  group.add(
    new THREE.Mesh(
      surface(finPoint, [24, 24], new THREE.Vector3(0, 0, 1), finUv(projection, 'left')),
      finMaterial(textures.finLeft),
    ),
  );
  group.add(
    new THREE.Mesh(
      surface(finPoint, [24, 24], new THREE.Vector3(0, 0, -1), finUv(projection, 'right')),
      finMaterial(textures.finRight),
    ),
  );

  const wingTop = color(scheme.wings?.top ?? scheme.wings?.under, NEUTRAL.wings);
  const wingUnder = color(scheme.wings?.under ?? scheme.wings?.top, NEUTRAL.wings);
  const stabilizer = scheme.stabilizer ?? {};
  const stabilizerTop = color(stabilizer.top ?? stabilizer.under ?? scheme.wings?.top, NEUTRAL.wings);
  const stabilizerUnder = color(stabilizer.under ?? stabilizer.top ?? scheme.wings?.under, NEUTRAL.wings);
  const engines = scheme.engines ?? {};
  const cowling = color(engines.cowling, NEUTRAL.engines);

  for (const side of [1, -1]) {
    // Wings and tailplane: swept airfoils raised by their dihedral; a top and an underside.
    const lifting = (
      part: typeof shape.wing,
      root: number,
      thickness: { root: number; tip: number },
      top: string,
      under: string,
    ): void => {
      const station = (v: number): Station => {
        const { leading, trailing } = chordAt(part, v);
        const lateral = lerp(root, part.span, v);
        return { leading, trailing, height: part.height + lateral * tan(part.dihedralDeg), out: lateral };
      };
      group.add(liftingSurface(station, thickness, { top, under }, side));
    };
    lifting(shape.wing, shape.fuselage.radius * 0.6, { root: 0.14, tip: 0.1 }, wingTop, wingUnder);
    lifting(shape.stabilizer, 0.2, { root: 0.1, tip: 0.08 }, stabilizerTop, stabilizerUnder);

    if (shape.winglet) {
      const w = shape.winglet;
      const { wing } = shape;
      const tipHeight = wing.height + wing.span * tan(wing.dihedralDeg);
      const point: Grid = (u, v) => {
        const leading = lerp(wing.tipLeading, wing.tipLeading + w.sweep, v);
        const trailing = lerp(wing.tipTrailing, wing.tipLeading + w.sweep + w.tipChord, v);
        return new THREE.Vector3(lerp(leading, trailing, u), tipHeight + v * w.height, side * wing.span);
      };
      const winglets = scheme.winglets ?? {};
      const outer = color(winglets.outer, NEUTRAL.winglets);
      const inner = color(winglets.inner ?? winglets.outer, NEUTRAL.winglets);
      group.add(new THREE.Mesh(surface(point, [1, 4], new THREE.Vector3(0, 0, side)), paint(outer)));
      group.add(new THREE.Mesh(surface(point, [1, 4], new THREE.Vector3(0, 0, -side)), paint(inner)));
    }

    // Engines: a nacelle tapering at the exhaust, wearing the engine texture; its inlet lip and fan; a pylon up into
    // the wing as the side view draws it.
    for (const e of shape.engines) {
      const length = e.back - e.front;
      const radius = (x: number): number => e.radius * (1 - (0.2 * (x - e.front)) / length);
      group.add(nacelle(e.front, e.back, () => e.height, radius, side * e.out, textures.engine));
      if (engines.inletLip) {
        const lip = new THREE.Mesh(
          new THREE.TorusGeometry(e.radius * 0.96, e.radius * 0.06, 12, 40),
          paint(color(engines.inletLip, cowling), { metalness: 0.6, roughness: 0.3 }),
        );
        lip.rotation.y = Math.PI / 2;
        lip.position.set(e.front, e.height, side * e.out);
        group.add(lip);
      }
      const fan = new THREE.Mesh(new THREE.CircleGeometry(e.radius * 0.93, 40), paint('#2a2e35'));
      fan.rotation.y = -Math.PI / 2;
      fan.position.set(e.front + 0.05, e.height, side * e.out);
      group.add(fan);
      const wingHeight = shape.wing.height + e.out * tan(shape.wing.dihedralDeg);
      if (e.out > shape.fuselage.radius && e.height < wingHeight) {
        const top = (x: number): number => e.height + radius(x);
        const width = e.radius * 0.25;
        group.add(pylon(e.front, e.back, top, wingHeight, side * e.out, width, color(engines.pylon, cowling)));
      }
    }
  }

  // Centered on the origin, nose toward −x.
  group.position.x = -L / 2;
  const holder = new THREE.Group();
  holder.add(group);
  return holder;
}
