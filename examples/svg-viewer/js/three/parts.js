// Parts both builders share: lifting surfaces with an airfoil's thickness, nacelles wearing the engine texture, and
// pylons in the side view's outline. Meters; x back from the nose, y up, z out to the aircraft's left.
import * as THREE from 'three';
import { lerp, paint, surface } from './model.js';
/** Half an airfoil's thickness at chord share u, for thickness ratio t (NACA four-digit, closed trailing edge). */
const halfThickness = (u, t) => 5 * t * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u ** 2 + 0.2843 * u ** 3 - 0.1036 * u ** 4);
/** Chord share from 0 to 1, bunched at the leading edge, where an airfoil curves most. */
const along = (u) => (1 - Math.cos(u * Math.PI)) / 2;
/**
 * A wing or tailplane: a top and an underside meeting at the leading and trailing edges, thickness ratio `root` at
 * span share 0 easing to `tip` at 1. The underside is flatter than the top, as a cambered airfoil's is. Its tip is
 * closed by its section (else the sky shows through it, between the skins and a winglet); a stub carried in to the
 * centerline (`tip` false) ends inside the wing and leaves it open.
 */
export function liftingSurface(station, thickness, colors, side, steps = 40, tip = true) {
    const group = new THREE.Group();
    // Height at chord share u and span share v, `share` of the way from the middle to the top (1) or underside (-0.55).
    const point = (u, v, share) => {
        const s = station(v);
        const a = along(u);
        const chord = s.trailing - s.leading;
        const t = thickness.root + (thickness.tip - thickness.root) * v;
        return new THREE.Vector3(s.leading + chord * a, s.height + share * halfThickness(a, t) * chord, side * s.out);
    };
    for (const [face, color, share] of [
        [1, colors.top, 1],
        [-1, colors.under, -0.55],
    ]) {
        const skin = surface((u, v) => point(u, v, share), [24, steps], new THREE.Vector3(0, face, 0));
        group.add(new THREE.Mesh(skin, paint(color)));
    }
    if (tip) {
        const section = surface((u, w) => point(u, 1, -0.55 + 1.55 * w), [24, 1], new THREE.Vector3(0, 0, side));
        group.add(new THREE.Mesh(section, paint(colors.top)));
    }
    return group;
}
/**
 * A nacelle turned round its middle line, wearing `renderTexture(scheme, 'engine')`: u inlet to exhaust; v from the
 * bottom up its left side (+z) to the top, then down its right side, even in its height as the texture's rows are.
 * Round, or as wide as `halfWidth` where its plan is measured (a turboprop's deep, narrow nacelle).
 */
export function nacelle(front, back, centre, radius, out, texture, halfWidth) {
    const geometry = surface((u, v) => {
        const x = front + (back - front) * u;
        const angle = v * 2 * Math.PI;
        const r = radius(x);
        const w = halfWidth ? halfWidth(x) : r;
        return new THREE.Vector3(x, centre(x) - r * Math.cos(angle), out + w * Math.sin(angle));
    }, [40, 64], new THREE.Vector3(0, -1, 0), (u, v) => {
        const y = -Math.cos(v * 2 * Math.PI);
        return [u, v <= 0.5 ? (1 + y) / 4 : 1 - (1 + y) / 4];
    });
    return new THREE.Mesh(geometry, paint('#ffffff', { map: texture, side: THREE.DoubleSide }));
}
/**
 * A pylon as the side view draws it: from the nacelle's top (a quarter and 95% of the way back) up to the wing
 * (78% along the nacelle, and 30% of its length behind the exhaust), `width` thick.
 */
export function pylon(front, back, nacelleTop, wingHeight, out, width, color) {
    const length = back - front;
    const outline = new THREE.Shape();
    const at = (share) => front + length * share;
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
/**
 * A propeller at `out` from the centerline: its spinner, a rounded cone turned from its tip to its base on the nacelle
 * in `spinnerColor`; its blades, tapered and pitched, in `bladeColor`, still; and a faint disc where they turn.
 */
export function propeller(p, out, spinnerColor, bladeColor) {
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
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshBasicMaterial({
        color: new THREE.Color(bladeColor),
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
    }));
    disc.rotation.y = Math.PI / 2;
    disc.position.set(p.x, p.z, out);
    group.add(disc);
    return group;
}
