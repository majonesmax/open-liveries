// Parts both builders share: lifting surfaces with an airfoil's thickness, nacelles wearing the engine texture, and
// pylons in the side view's outline. Meters; x back from the nose, y up, z out to the aircraft's left.

import * as THREE from 'three';
import type { GearLeg } from '../../../../renderer/dist/index.js';
import { lerp, paint, surface } from './model.js';

/** A station across a lifting surface: its edges (x), its middle height, and how far out it is (z). */
export interface Station {
  leading: number;
  trailing: number;
  height: number;
  out: number;
}

/** Half an airfoil's thickness at chord share u, for thickness ratio t (NACA four-digit, closed trailing edge). */
export const halfThickness = (u: number, t: number): number =>
  5 * t * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u ** 2 + 0.2843 * u ** 3 - 0.1036 * u ** 4);

/** Chord share from 0 to 1, bunched at the leading edge, where an airfoil curves most. */
const along = (u: number): number => (1 - Math.cos(u * Math.PI)) / 2;

/**
 * A wing or tailplane: a top and an underside meeting at the leading and trailing edges, thickness ratio `root` at
 * span share 0 easing to `tip` at 1. The underside is flatter than the top, as a cambered airfoil's is. Its tip is
 * closed by its section (else the sky shows through it, between the skins and a winglet); a stub carried in to the
 * centerline (`tip` false) ends inside the wing and leaves it open. `root` true closes its root the same way (a piece
 * of a wing whose neighbour's chord differs: a flap's cut-out, a flap panel).
 */
export function liftingSurface(
  station: (v: number) => Station,
  thickness: { root: number; tip: number },
  colors: { top: string; under: string },
  side: number,
  steps = 40,
  tip = true,
  root = false,
): THREE.Object3D {
  const group = new THREE.Group();
  // Height at chord share u and span share v, `share` of the way from the middle to the top (1) or underside (-0.55).
  const point = (u: number, v: number, share: number): THREE.Vector3 => {
    const s = station(v);
    const a = along(u);
    const chord = s.trailing - s.leading;
    const t = thickness.root + (thickness.tip - thickness.root) * v;
    return new THREE.Vector3(s.leading + chord * a, s.height + share * halfThickness(a, t) * chord, side * s.out);
  };
  for (const [face, color, share] of [
    [1, colors.top, 1],
    [-1, colors.under, -0.55],
  ] as const) {
    const skin = surface((u, v) => point(u, v, share), [24, steps], new THREE.Vector3(0, face, 0));
    group.add(new THREE.Mesh(skin, paint(color)));
  }
  for (const [end, closed] of [
    [1, tip],
    [0, root],
  ] as const) {
    if (!closed) continue;
    const outward = new THREE.Vector3(0, 0, end ? side : -side);
    const section = surface((u, w) => point(u, end, -0.55 + 1.55 * w), [24, 1], outward);
    group.add(new THREE.Mesh(section, paint(colors.top)));
  }
  return group;
}

/**
 * A nacelle turned round its middle line, wearing `renderTexture(scheme, 'engine')`: u inlet to exhaust; v from the
 * bottom up its left side (+z) to the top, then down its right side, even in its height as the texture's rows are.
 * Round, or as wide as `halfWidth` where its plan is measured (a turboprop's deep, narrow nacelle).
 */
export function nacelle(
  front: number,
  back: number,
  centre: (x: number) => number,
  radius: (x: number) => number,
  out: number,
  texture: THREE.Texture,
  halfWidth?: (x: number) => number,
): THREE.Mesh {
  const geometry = surface(
    (u, v) => {
      const x = front + (back - front) * u;
      const angle = v * 2 * Math.PI;
      const r = radius(x);
      const w = halfWidth ? halfWidth(x) : r;
      return new THREE.Vector3(x, centre(x) - r * Math.cos(angle), out + w * Math.sin(angle));
    },
    [40, 64],
    new THREE.Vector3(0, -1, 0),
    (u, v) => {
      const y = -Math.cos(v * 2 * Math.PI);
      return [u, v <= 0.5 ? (1 + y) / 4 : 1 - (1 + y) / 4];
    },
  );
  return new THREE.Mesh(geometry, paint('#ffffff', { map: texture, side: THREE.DoubleSide }));
}

/**
 * A pylon as the side view draws it: from the nacelle's top (a quarter and 95% of the way back) up to the wing
 * (78% along the nacelle, and 30% of its length behind the exhaust), `width` thick.
 */
export function pylon(
  front: number,
  back: number,
  nacelleTop: (x: number) => number,
  wingHeight: number,
  out: number,
  width: number,
  color: string,
): THREE.Mesh {
  const length = back - front;
  const outline = new THREE.Shape();
  const at = (share: number): number => front + length * share;
  outline.moveTo(at(0.25), nacelleTop(at(0.25)) - 0.05);
  outline.lineTo(at(0.95), nacelleTop(at(0.95)) - 0.05);
  outline.lineTo(back + 0.3 * length, wingHeight);
  outline.lineTo(at(0.78), wingHeight);
  outline.closePath();
  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: width * 0.3,
    bevelSize: width * 0.3,
    bevelSegments: 3,
  });
  geometry.translate(0, 0, out - width / 2);
  return new THREE.Mesh(geometry, paint(color));
}

/** A propeller (docs/SHAPES.md): its disc's plane, hub height, diameter, blades and spinner. */
export interface Propeller {
  x: number;
  z: number;
  diameter: number;
  blades: number;
  spinner?: { x: [number, number]; diameter: number };
}

/**
 * A propeller at `out` from the centerline: its spinner, a rounded cone turned from its tip to its base on the nacelle
 * in `spinnerColor`; its blades, tapered and pitched, in `bladeColor`, still; and a faint disc where they turn.
 */
export function propeller(p: Propeller, out: number, spinnerColor: string, bladeColor: string): THREE.Group {
  const group = new THREE.Group();
  const [tip, base] = p.spinner?.x ?? [p.x - 0.05 * p.diameter, p.x + 0.05 * p.diameter];
  const r = (p.spinner?.diameter ?? 0.15 * p.diameter) / 2;
  const profile = Array.from({ length: 17 }, (_, i) => {
    const t = i / 16;
    return new THREE.Vector2(r * Math.sqrt(1 - (1 - t) ** 2), lerp(tip, base, t));
  });
  const spinner = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), paint(spinnerColor, { side: THREE.DoubleSide }));
  spinner.rotation.z = -Math.PI / 2; // the lathe's axis (y) along x
  spinner.position.set(0, p.z, out);
  group.add(spinner);

  const R = p.diameter / 2;
  const root = 0.75 * r;
  const [rootChord, tipChord] = [0.09 * p.diameter, 0.05 * p.diameter];
  const outline = new THREE.Shape();
  outline.moveTo(-rootChord / 2, root);
  outline.lineTo(rootChord / 2, root);
  outline.lineTo(tipChord / 2, 0.92 * R);
  outline.quadraticCurveTo(tipChord / 3, R, 0, R);
  outline.quadraticCurveTo(-tipChord / 2, R, -tipChord / 2, 0.92 * R);
  outline.closePath();
  const blade = new THREE.ExtrudeGeometry(outline, { depth: 0.035, bevelEnabled: false });
  blade.translate(0, 0, -0.0175);
  blade.rotateY(Math.PI / 2 - 0.5); // the chord across the disc, pitched
  const bladePaint = paint(bladeColor, { roughness: 0.6 });
  for (let k = 0; k < p.blades; k++) {
    const hub = new THREE.Object3D();
    hub.position.set(p.x, p.z, out);
    hub.rotation.x = (k / p.blades) * 2 * Math.PI + 0.3;
    hub.add(new THREE.Mesh(blade, bladePaint));
    group.add(hub);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(R, 64),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(bladeColor),
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  disc.rotation.y = Math.PI / 2;
  disc.position.set(p.x, p.z, out);
  group.add(disc);
  return group;
}

/** The gear's paint: gray metal struts, a bright oleo piston, black tires, light hubs (one set a leg). */
const gearPaint = (): Record<'strut' | 'piston' | 'tire' | 'hub', THREE.Material> => ({
  strut: paint('#8e959c', { metalness: 0.55, roughness: 0.45 }),
  piston: paint('#d9dde1', { metalness: 0.85, roughness: 0.2 }),
  tire: paint('#1c1d1f', { metalness: 0, roughness: 0.9 }),
  hub: paint('#a9afb5', { metalness: 0.5, roughness: 0.4 }),
});

/** A round rod from one point to another. */
function rod(from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh {
  const along = new THREE.Vector3().subVectors(to, from);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, along.length(), 10, 1), material);
  mesh.position.copy(from).addScaledVector(along, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), along.normalize());
  return mesh;
}

/** A tire (diameter, width) on its hub, its axle across (along z), centered on the origin. */
type GearPaint = ReturnType<typeof gearPaint>;

function wheel(diameter: number, width: number, metal: GearPaint): THREE.Group {
  const R = diameter / 2;
  const rim = 0.52 * R;
  // The tire's section, turned round its axle: a rounded box from the rim out to the tread.
  const profile = Array.from({ length: 13 }, (_, i) => {
    const t = -Math.PI / 2 + (i / 12) * Math.PI;
    const c = Math.cos(t);
    return new THREE.Vector2(rim + (R - rim) * Math.sign(c) * Math.abs(c) ** 0.3, (width / 2) * Math.sin(t));
  });
  const tire = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), metal.tire);
  tire.rotation.x = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(rim, rim, 0.86 * width, 20), metal.hub);
  hub.rotation.x = Math.PI / 2;
  const group = new THREE.Group();
  group.add(tire, hub);
  return group;
}

/**
 * A landing gear leg standing on the ground: its wheels (side by side, or on a bogie), its axles, and its strut from
 * `top` (on the wing or the belly) down to the axle or the bogie's beam, the oleo's bright piston at its foot. `brace`,
 * where given, is a side strut from two-thirds down the leg up to that point on the structure. Meters, the model's
 * frame (x back, y up, z out to the left); `out` is the leg's middle across.
 */
export function gearLeg(
  leg: GearLeg,
  out: number,
  ground: number,
  top: THREE.Vector3,
  brace?: THREE.Vector3,
): THREE.Group {
  const group = new THREE.Group();
  const metal = gearPaint();
  const [diameter, width] = leg.tire;
  const axleY = ground + diameter / 2;
  const spread = leg.wheels === 1 ? 0 : (leg.spacing ?? width * 1.2) / 2;
  const axles = leg.wheels <= 2 ? 1 : leg.wheels / 2;
  const tandem = axles > 1 ? (leg.tandem ?? diameter * 1.3) : 0;
  const alongs = Array.from(
    { length: axles },
    (_, i) => leg.x + (axles > 1 ? -tandem / 2 + (i * tandem) / (axles - 1) : 0),
  );
  const hub = diameter * (leg.kind === 'nose' ? 0.045 : 0.055);
  for (const x of alongs) {
    for (const a of spread ? [-spread, spread] : [0]) {
      const w = wheel(diameter, width, metal);
      w.position.set(x, axleY, out + a);
      group.add(w);
    }
    if (spread)
      group.add(
        rod(new THREE.Vector3(x, axleY, out - spread), new THREE.Vector3(x, axleY, out + spread), hub, metal.strut),
      );
  }
  // A bogie's beam, along x between its first and last axles, the strut meeting it in the middle.
  const foot = new THREE.Vector3(leg.x, axleY + (axles > 1 ? 0.05 * diameter : 0), out);
  if (axles > 1)
    group.add(
      rod(
        new THREE.Vector3(leg.x - tandem / 2 - 0.1, foot.y, out),
        new THREE.Vector3(leg.x + tandem / 2 + 0.1, foot.y, out),
        1.4 * hub,
        metal.strut,
      ),
    );
  const radius = diameter * (leg.kind === 'nose' ? 0.1 : 0.19);
  // The oleo: the piston's bright lower third, the cylinder above.
  const knee = new THREE.Vector3().lerpVectors(foot, top, 0.3);
  group.add(rod(foot, knee, 0.68 * radius, metal.piston));
  group.add(rod(knee, top, radius, metal.strut));
  if (brace) group.add(rod(new THREE.Vector3().lerpVectors(foot, top, 0.65), brace, 0.4 * radius, metal.strut));
  return group;
}
