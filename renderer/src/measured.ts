// A measured shape (shapes/<type>.json, docs/SHAPES.md) laid out for drawing: the same Geometry as the parametric
// shapes give, so every view and texture draws on it unchanged, with the measured outlines where the parametric
// layout would guess (the fuselage's curves, the fin with its fillet and rudder, the wing's plan, the nacelles,
// each window and cockpit pane).

import type { EngineGeometry, Geometry, Half, MeasuredDetail, TailEngine } from './geometry.js';
import {
  clamp,
  doorShape,
  fromHeight,
  FUSELAGE_PIXELS,
  halfSign,
  lerp,
  lerpPoint,
  MARGIN,
  NOSE_X,
  toHeight,
  VIEW_WIDTH,
} from './geometry.js';
import type { Point } from './scheme.js';
import type { AircraftShape } from './shape.js';

/** [a, b] pairs along a line, in meters (docs/SHAPES.md says which axes each line uses). */
type Line = Point[];

interface Surface {
  /** Plan view: [y, x] root to tip. */
  leading: Line;
  trailing: Line;
  /** Front view: [y, z] root to tip. */
  z: Line;
  /** A wing's flap track fairings: out from the centerline, front and aft ends, depth below the wing (meters). */
  fairings?: { y: number; x: [number, number]; depth: number; width?: number }[];
}

/** A rear-mounted engine's stub pylon: a surface from the fuselage's side to the nacelle, and its thickness. */
interface Pylon extends Surface {
  thickness: number;
}

/** A shape file: an aircraft type measured from its manufacturer's drawings (schema/shape.schema.json). */
export interface MeasuredShape {
  id: string;
  name: string;
  types: string[];
  fuselage: {
    length: number;
    crown: Line;
    belly: Line;
    halfWidth: Line;
    widest?: number;
    /** An upper deck above the main tube (a 747's): its top from the side, its width from the front. */
    hump?: { crown: Line; width: number; section?: Line };
  };
  fin: { leading: Line; trailing: Line; fillet?: Line; rudder?: Line };
  /** On the fuselage, or on the fin (a T-tail). */
  stabilizer: Surface & { mount?: 'fuselage' | 'fin' };
  wing: Surface;
  wingtip?: { kind: string; leading: Line; trailing: Line; front?: Line };
  engines: {
    x: [number, number];
    cowlEnd?: number;
    /**
     * Under the wing (the default), on the rear fuselage on a stub `pylon`, or on the tail's centerline (`tail`: the
     * MD-11's through the fin's base, the 727's in the tail cone fed by an S-duct).
     */
    mount?: 'wing' | 'fuselage' | 'tail';
    /** A tail engine's air path: through its nacelle (`straight`, the default), or from an intake on the crown (`s`). */
    duct?: 'straight' | 's';
    /** A tail engine's strut: from x to x, where its nacelle is joined to the crown under it. */
    strut?: [number, number];
    /**
     * From above: [x, y] of its nacelle's (or intake's) side from its middle, inlet to exhaust: a tail engine's, or a
     * nacelle on a wing that isn't round (a turboprop's).
     */
    halfWidth?: Line;
    /** A tail engine's bare exhaust where it shows, from the side. */
    nozzle?: { top: Line; bottom: Line };
    pylon?: Pylon;
    /** A propeller ahead of the nacelle (a turboprop's): its disc's plane, hub height, diameter, blades and spinner. */
    propeller?: {
      x: number;
      z: number;
      diameter: number;
      blades: number;
      spinner?: { x: [number, number]; diameter: number };
    };
    y: number;
    top: Line;
    bottom: Line;
    inlet?: { z: number; width: number; height: number };
  }[];
  cabin: {
    windows: { z: [number, number]; width: number; x: number[]; note?: string; wouldBe?: [number, number] };
    /** A double-deck cabin's upper row, as `windows`. */
    upperWindows?: { z: [number, number]; width: number; x: number[]; note?: string };
    doors: { kind: 'door' | 'exit' | 'cargo'; x: [number, number]; z: [number, number]; side?: 'left' | 'right' }[];
  };
  cockpit: { windows: Line[] };
}

/** A parsed JSON value that is a shape file rather than a parametric AircraftShape. */
export function isMeasuredShape(shape: unknown): shape is MeasuredShape {
  if (typeof shape !== 'object' || shape === null) return false;
  const fuselage = (shape as { fuselage?: unknown }).fuselage;
  return typeof fuselage === 'object' && fuselage !== null && Array.isArray((fuselage as { crown?: unknown }).crown);
}

/** The value at a dotted path in parsed JSON, if every step on the way is an object. */
function valueAt(value: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (v, key) => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>)[key] : undefined),
      value,
    );
}

/** What a shape file read from JSON lacks for drawing (schema/shape.schema.json checks the rest). */
export function measuredShapeProblems(shape: unknown): string[] {
  const problems: string[] = [];
  const isLine = (value: unknown): boolean =>
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every((p) => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number');
  const length = valueAt(shape, 'fuselage.length');
  if (typeof length !== 'number' || !(length > 0)) problems.push('fuselage.length must be a positive number');
  const lines = [
    'fuselage.crown',
    'fuselage.belly',
    'fuselage.halfWidth',
    'fin.leading',
    'fin.trailing',
    ...['wing', 'stabilizer'].flatMap((s) => ['leading', 'trailing', 'z'].map((k) => `${s}.${k}`)),
  ];
  for (const path of lines) {
    if (!isLine(valueAt(shape, path))) problems.push(`${path} must be a list of at least two [a, b] points`);
  }
  const engines = valueAt(shape, 'engines');
  if (!Array.isArray(engines) || !engines.length) problems.push('engines: at least one');
  else {
    engines.forEach((e: unknown, i) => {
      for (const k of ['top', 'bottom']) {
        if (!isLine(valueAt(e, k))) problems.push(`engines[${i}].${k} must be a list of at least two [a, b] points`);
      }
      if (valueAt(e, 'pylon') !== undefined) {
        for (const k of ['leading', 'trailing', 'z']) {
          if (!isLine(valueAt(e, `pylon.${k}`)))
            problems.push(`engines[${i}].pylon.${k} must be a list of at least two [a, b] points`);
        }
        if (typeof valueAt(e, 'pylon.thickness') !== 'number')
          problems.push(`engines[${i}].pylon.thickness must be a number`);
      }
    });
  }
  return problems;
}

/** b at a along a line (sorted by a), held level beyond its ends. */
function at(line: Line, a: number): number {
  const first = line[0];
  const last = line.at(-1);
  if (!first || !last) return 0;
  if (a <= first[0]) return first[1];
  if (a >= last[0]) return last[1];
  let p = first;
  for (const q of line) {
    if (a <= q[0]) return q[0] === p[0] ? q[1] : lerp(p[1], q[1], (a - p[0]) / (q[0] - p[0]));
    p = q;
  }
  return last[1];
}

const byFirst = (line: Line): Line => [...line].sort((p, q) => p[0] - q[0]);
/** [x, z] side-view edges as x at each height: [z, x], sorted. */
const byHeight = (line: Line): Line => byFirst(line.map(([x, z]) => [z, x]));

/**
 * x along a side-view edge at height z; below its root, carried on straight from its first stretch, or from its
 * first half meter where the first stretch is a trace's hook (a curl at the root that would run the edge off
 * near level).
 */
function edgeX(edge: Line, z: number): number {
  const [p, q] = edge;
  if (!p || !q || z >= p[0] || q[0] === p[0]) return at(edge, z);
  const slope = (r: Point): number => (r[1] - p[1]) / (r[0] - p[0]);
  const far = edge.find((r) => r[0] - p[0] >= 0.5);
  const s = far && Math.abs(slope(q) - slope(far)) > 1 ? slope(far) : slope(q);
  return p[1] + s * (z - p[0]);
}

const maxOf = (line: Line, i: 0 | 1): number => Math.max(...line.map((p) => p[i]));
const minOf = (line: Line, i: 0 | 1): number => Math.min(...line.map((p) => p[i]));

/**
 * A parametric stand-in for the measured shape, for what reads the AircraftShape itself (a texture's size, the
 * cockpit mask's and window band's extent, viewers listing a shape's numbers).
 */
function approximate(m: MeasuredShape): AircraftShape {
  const { fuselage, fin, wing, stabilizer, cabin, cockpit } = m;
  const tube = Math.max(...fuselage.crown.map(([x, z]) => z - at(byFirst(fuselage.belly), x)));
  const xs = [...cabin.windows.x].sort((a, b) => a - b);
  const gaps = xs.flatMap((x, i) => (i > 0 ? [x - (xs[i - 1] ?? x)] : [])).sort((a, b) => a - b);
  const pitch = gaps[Math.floor(gaps.length / 2)] ?? 0.5;
  const panes = cockpit.windows.flat();
  const plan = (
    s: Surface,
  ): { rootLeading: number; rootTrailing: number; tipLeading: number; tipTrailing: number } => ({
    rootLeading: s.leading[0]?.[1] ?? 0,
    rootTrailing: s.trailing[0]?.[1] ?? 0,
    tipLeading: s.leading.at(-1)?.[1] ?? 0,
    tipTrailing: s.trailing.at(-1)?.[1] ?? 0,
  });
  const span = (s: Surface): number => maxOf(s.leading, 0);
  const dihedral = (s: Surface): number => {
    const [a, b] = [s.z[0], s.z.at(-1)];
    return a && b && b[0] !== a[0] ? (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI : 0;
  };
  const root = fin.leading[0] ?? [0, 0];
  return {
    name: m.id,
    fuselage: {
      length: fuselage.length,
      radius: tube / 2,
      nose: { crown: 0, belly: 0, tip: 0 },
      tail: { crownFrom: fuselage.length, crownEnd: 1, bellyFrom: fuselage.length, bellyEnd: 1 },
    },
    cabin: {
      from: (xs[0] ?? 0) - cabin.windows.width / 2,
      to: (xs.at(-1) ?? 0) + cabin.windows.width / 2,
      pitch,
      doors: cabin.doors.map((d) => d.x),
    },
    cockpit: { from: panes.length ? minOf(panes, 0) : 0, to: panes.length ? maxOf(panes, 0) : 0 },
    fin: {
      rootLeading: root[0],
      rootTrailing: fin.trailing[0]?.[0] ?? 0,
      tipLeading: fin.leading.at(-1)?.[0] ?? 0,
      tipTrailing: fin.trailing.at(-1)?.[0] ?? 0,
      height: maxOf(fin.trailing, 1) - root[1],
    },
    stabilizer: {
      ...plan(stabilizer),
      span: span(stabilizer),
      height: stabilizer.z[0]?.[1] ?? 0,
      dihedralDeg: dihedral(stabilizer),
    },
    wing: { ...plan(wing), span: span(wing), height: wing.z[0]?.[1] ?? 0, dihedralDeg: dihedral(wing) },
    ...(m.wingtip
      ? {
          winglet: {
            height: maxOf(m.wingtip.leading, 1) - (m.wingtip.leading[0]?.[1] ?? 0),
            sweep: (m.wingtip.leading.at(-1)?.[0] ?? 0) - (m.wingtip.leading[0]?.[0] ?? 0),
            tipChord: 0.4,
          },
        }
      : {}),
    engines: m.engines
      .filter((e) => e.mount !== 'tail')
      .map((e) => {
        const top = maxOf(e.top, 1);
        const bottom = minOf(e.bottom, 1);
        return { front: e.x[0], back: e.x[1], radius: (top - bottom) / 2, height: (top + bottom) / 2, out: e.y };
      }),
  };
}

/**
 * What every part's layout reads: the shape, its lines sorted, the picture's scale and frame, and the mappings from
 * meters to fuselage space and to the side view's pixels.
 */
interface Frame {
  m: MeasuredShape;
  /** The fuselage's length in meters, and in the picture. */
  L: number;
  fuselagePixels: number;
  /** Pixels per meter. */
  scale: number;
  share: (meters: number) => number;
  fuselageX: (x: number) => number;
  /** Meters back from the nose to the views' x. */
  px: (meters: number) => number;
  /** Meters up from the centerline to the side view's y. */
  y: (meters: number) => number;
  centerY: number;
  sideHeight: number;
  belowCenterY: number;
  /** The cabin's radius in pixels. */
  radius: number;
  /** The wing's and tailplane's thickness from the side, in pixels. */
  thickness: number;
  crown: Line;
  belly: Line;
  halfWidth: Line;
  crownZ: (meters: number) => number;
  bellyZ: (meters: number) => number;
  wingZ: Line;
  wingLeading: Line;
  wingTrailing: Line;
  stabZ: Line;
  tipLeading: Line;
  tipTrailing: Line;
  /** Meters back and up to fuselage space (for windows measured on the drawing). */
  toFuselage: (p: Point) => Point;
  /** Meters back and up to the side view's pixels. */
  toSide: (p: Point) => Point;
}

function frameOf(m: MeasuredShape): Frame {
  const { fuselage, fin, wing, stabilizer, wingtip } = m;
  const L = fuselage.length;
  // Nose to tail cone in FUSELAGE_PIXELS, unless a part reaches far enough behind the tail cone to leave the picture
  // (a T-tail's tailplane: the 717's tips are 3.4 m behind it); then smaller, so the whole aircraft fits, 4 px clear
  // of the edge (the 737-600's tailplane tips come within 7 px of it at full size).
  const reach = Math.max(
    L,
    ...[wing, stabilizer].flatMap((s) => [...s.leading, ...s.trailing].map(([, x]) => x)),
    ...fin.trailing.map(([x]) => x),
    ...m.engines.map((e) => e.x[1]),
  );
  const fuselagePixels = Math.min(FUSELAGE_PIXELS, ((VIEW_WIDTH - 4 - NOSE_X) * L) / reach);
  const scale = fuselagePixels / L;
  const share = (meters: number): number => meters / L;
  const crown = byFirst(fuselage.crown);
  const belly = byFirst(fuselage.belly);
  const halfWidth = byFirst(fuselage.halfWidth);
  const crownZ = (meters: number): number => at(crown, meters);
  const bellyZ = (meters: number): number => at(belly, meters);
  const stabZ = byFirst(stabilizer.z);
  const wingLeading = byFirst(wing.leading);
  const tipLeading = wingtip ? byHeight(wingtip.leading) : [];

  // The side view's height: from the highest of the fin, the wingtip and the crown down to the lowest of the
  // belly and the engines.
  const top = Math.max(
    maxOf(fin.leading, 1),
    maxOf(fin.trailing, 1),
    maxOf(crown, 1),
    ...(fuselage.hump ? [maxOf(fuselage.hump.crown, 1)] : []),
    maxOf(stabZ, 1),
    ...m.engines.filter((e) => e.mount === 'tail').map((e) => maxOf(e.top, 1)),
    ...tipLeading.map((p) => p[0]),
    ...m.engines.flatMap((e) => (e.propeller ? [e.propeller.z + e.propeller.diameter / 2] : [])),
  );
  const lowest = Math.min(
    minOf(belly, 1),
    ...m.engines.map((e) => minOf(e.bottom, 1)),
    ...m.engines.flatMap((e) => (e.propeller ? [e.propeller.z - e.propeller.diameter / 2] : [])),
  );
  const centerY = MARGIN + top * scale;
  const y = (meters: number): number => centerY - meters * scale;
  const px = (meters: number): number => NOSE_X + meters * scale;
  const tube = Math.max(...crown.map(([x, z]) => z - bellyZ(x)));
  const radius = (tube / 2) * scale;

  // The below view's middle (its lateral reach: the wing, tailplane, fuselage and engines).
  const wingTipLateral = Math.max(maxOf(wingLeading, 0), wingtip?.front ? maxOf(wingtip.front, 0) : 0);
  const lateralMax = Math.max(
    wingTipLateral,
    maxOf(stabilizer.leading, 0),
    maxOf(halfWidth, 1),
    ...m.engines.map((e) => e.y + Math.max((e.inlet?.width ?? 0) / 2, (e.propeller?.diameter ?? 0) / 2)),
  );

  return {
    m,
    L,
    fuselagePixels,
    scale,
    share,
    fuselageX: (x) => NOSE_X + x * fuselagePixels,
    px,
    y,
    centerY,
    sideHeight: Math.ceil(centerY - lowest * scale + MARGIN),
    belowCenterY: MARGIN + lateralMax * scale,
    radius,
    thickness: 0.1 * radius,
    crown,
    belly,
    halfWidth,
    crownZ,
    bellyZ,
    wingZ: byFirst(wing.z),
    wingLeading,
    wingTrailing: byFirst(wing.trailing),
    stabZ,
    tipLeading,
    tipTrailing: wingtip ? byHeight(wingtip.trailing) : [],
    toFuselage: ([meters, z]) => {
      const c = crownZ(meters);
      const b = bellyZ(meters);
      const r = (c - b) / 2 || 1;
      return [share(meters), fromHeight((z - (c + b) / 2) / r)];
    },
    toSide: ([meters, z]) => [px(meters), y(z)],
  };
}

/**
 * The fuselage: its outline from the side, its glass and doors in fuselage space, an upper deck above the main tube
 * (a 747's hump) in the side view's pixels, and the windows' bands that a scheme from another type is fitted by.
 */
function layoutFuselage(f: Frame): {
  fuselagePoint: Geometry['fuselagePoint'];
  profile: Geometry['profile'];
  windows: Geometry['windows'];
  detail: Pick<MeasuredDetail, 'fuselageSamples' | 'glass' | 'doors' | 'hump'>;
} {
  const { m, L, share, fuselageX, y, crown, belly, halfWidth, crownZ, bellyZ, toFuselage, toSide } = f;
  const { fuselage } = m;

  /** A point at y is drawn r·sin(y·90°) from the middle of crown and belly at that x. */
  const fuselagePoint = (x: number, yy: number): Point => {
    const meters = clamp(x, 0, 1) * L;
    const c = crownZ(meters);
    const b = bellyZ(meters);
    return [fuselageX(x), y((c + b) / 2 + ((c - b) / 2) * toHeight(yy))];
  };
  /**
   * A cockpit pane to fuselage space with its edges kept straight as the side view draws them: each edge in steps
   * of at most 5 cm in meters first. Near the crown the fuselage's mapping would bend an edge drawn between two
   * corners (a windshield's bottom edge, from its post on the crown back to its aft corner, by up to 0.16 m on the
   * C-130J).
   */
  const paneToFuselage = (pane: Point[]): Point[] =>
    pane.flatMap((a, i) => {
      const b = pane[(i + 1) % pane.length] ?? a;
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05));
      return Array.from({ length: steps }, (_, s) => toFuselage(lerpPoint(a, b, s / steps)));
    });
  // The cabin windows (both decks' rows) as outlines in meters.
  const cabinPanes: Point[][] = [m.cabin.windows, ...(m.cabin.upperWindows ? [m.cabin.upperWindows] : [])].flatMap(
    (row) =>
      row.x.map((x): Point[] => {
        const w = row.width / 2;
        const [z0, z1] = row.z;
        return [
          [x - w, z0],
          [x + w, z0],
          [x + w, z1],
          [x - w, z1],
        ];
      }),
  );
  const doorBox = (d: MeasuredShape['cabin']['doors'][number]): Point[] => [
    [d.x[0], d.z[0]],
    [d.x[1], d.z[1]],
  ];
  // An upper deck above the main tube (a 747's hump): the main tube's paint space is the crown and belly, as on
  // any shape; the hump stands above it, in the side view's pixels. The glass and doors whose middle is above the
  // main crown are the hump's (the 747's flight deck, upper-deck windows and doors).
  const humpLine = fuselage.hump ? byFirst(fuselage.hump.crown) : undefined;
  const onHump = (outline: Point[]): boolean => {
    if (!humpLine || !outline.length) return false;
    const mx = outline.reduce((s, p) => s + p[0], 0) / outline.length;
    const mz = outline.reduce((s, p) => s + p[1], 0) / outline.length;
    return mx >= (humpLine[0]?.[0] ?? 0) && mx <= (humpLine.at(-1)?.[0] ?? 0) && mz > crownZ(mx) + 0.05;
  };
  let hump: MeasuredDetail['hump'];
  if (humpLine) {
    // Its outline: along its top, then back along the main crown (a little inside it, so the two meet).
    const xs = [...new Set([...humpLine.map(([x]) => x), ...crown.map(([x]) => x)])]
      .filter((x) => x >= (humpLine[0]?.[0] ?? 0) && x <= (humpLine.at(-1)?.[0] ?? 0))
      .sort((a, b) => a - b);
    hump = {
      from: share(humpLine[0]?.[0] ?? 0),
      to: share(humpLine.at(-1)?.[0] ?? 0),
      outline: [
        ...xs.map((x): Point => toSide([x, Math.max(at(humpLine, x), crownZ(x))])),
        ...[...xs].reverse().map((x): Point => toSide([x, crownZ(x) - 0.08])),
      ],
      glass: {
        cabin: cabinPanes.filter(onHump).map((pane) => pane.map(toSide)),
        cockpit: m.cockpit.windows.filter(onHump).map((pane) => pane.map(toSide)),
      },
      doors: m.cabin.doors
        .filter((d) => onHump(doorBox(d)))
        .map((d) => ({ ...doorShape(d.kind, d.x, d.z, toSide), ...(d.side && { side: d.side }) })),
    };
  }
  // Every measured x along the fuselage, so its outline keeps the drawing's detail (the nose, the windshield).
  const fuselageSamples = [...new Set([...crown, ...belly, ...halfWidth].map(([x]) => clamp(share(x), 0, 1)))].sort(
    (a, b) => a - b,
  );

  // The windows' band in fuselage y, at the middle window of each row on the main tube (a 747's upper deck's
  // windows are below its main crown, under the hump); a row without windows (a freighter's) has none.
  const band = (row: MeasuredShape['cabin']['windows']): [number, number] | undefined => {
    const xs = [...row.x].sort((a, b) => a - b);
    const x = xs[Math.floor(xs.length / 2)];
    if (x === undefined || row.z[1] > crownZ(x)) return undefined;
    return [toFuselage([x, row.z[0]])[1], toFuselage([x, row.z[1]])[1]];
  };
  const main = band(m.cabin.windows);
  const upperRow = m.cabin.upperWindows;
  const upperBand = upperRow && band(upperRow);
  const upper =
    upperRow && upperBand
      ? {
          band: upperBand,
          along: [share(Math.min(...upperRow.x)), share(Math.max(...upperRow.x))] as [number, number],
        }
      : undefined;

  return {
    fuselagePoint,
    profile: (x) => ({ crown: crownZ(clamp(x, 0, 1) * L), belly: bellyZ(clamp(x, 0, 1) * L) }),
    windows: {
      ...(main ? { main, heights: m.cabin.windows.z } : {}),
      // A type without windows has a line only where it says where they'd be (a freighter: its passenger version's).
      ...(main || m.cabin.windows.wouldBe ? { line: m.cabin.windows.z } : {}),
      ...(m.cabin.windows.wouldBe
        ? {
            wouldBe: [
              share(m.cabin.windows.wouldBe[0] - m.cabin.windows.width / 2),
              share(m.cabin.windows.wouldBe[1] + m.cabin.windows.width / 2),
            ] as [number, number],
          }
        : {}),
      flightDeck: Math.min(...m.cockpit.windows.flat().map(([, z]) => z)),
      ...(upper ? { upper } : {}),
    },
    detail: {
      fuselageSamples,
      glass: {
        cabin: cabinPanes.filter((pane) => !onHump(pane)).map((pane) => pane.map(toFuselage)),
        cockpit: m.cockpit.windows.filter((pane) => !onHump(pane)).map(paneToFuselage),
      },
      doors: m.cabin.doors
        .filter((d) => !onHump(doorBox(d)))
        .map((d) => ({
          ...doorShape(d.kind, d.x, d.z, toFuselage),
          ...(d.side && { side: d.side }),
        })),
      ...(hump ? { hump } : {}),
    },
  };
}

/** The fin: y from the leading edge's root (on the crown) to the tip; x the share of the chord at that height. */
function layoutFin(f: Frame): {
  finChord: Geometry['finChord'];
  finSpan: number;
  finPoint: Geometry['finPoint'];
  detail: Pick<MeasuredDetail, 'finOutline' | 'finFillet' | 'rudderShare'>;
} {
  const { m, share, fuselageX, px, y, scale } = f;
  const { fin } = m;
  const finLeading = byHeight(fin.leading);
  const finTrailing = byHeight(fin.trailing);
  const finRoot = finLeading[0]?.[0] ?? 0;
  const finTip = Math.max(maxOf(finLeading, 0), maxOf(finTrailing, 0));
  const finZ = (fy: number): number => lerp(finRoot, finTip, fy);
  const finChord = (fy: number): Point => [share(edgeX(finLeading, finZ(fy))), share(edgeX(finTrailing, finZ(fy)))];
  const finPoint = (fx: number, fy: number): Point => {
    const [leading, trailing] = finChord(fy);
    return [fuselageX(lerp(leading, trailing, fx)), y(finZ(fy))];
  };
  const rudder = fin.rudder ? byHeight(fin.rudder) : undefined;
  const rudderShare = rudder
    ? (fy: number): number => {
        const [leading, trailing] = finChord(fy);
        return trailing === leading ? 0.7 : (share(edgeX(rudder, finZ(fy))) - leading) / (trailing - leading);
      }
    : undefined;
  // The fin's outline, from a meter inside the fuselage (or from the trailing edge's foot, where that's lower: the
  // L-1011's runs down behind its center engine's fairing to the body): the fillet's curve, the leading edge above
  // it, over the tip and down the trailing edge.
  const below = Math.min(finRoot - 1, finTrailing[0]?.[0] ?? finRoot);
  const fillet = fin.fillet ?? [];
  const filletTop = fillet.length ? maxOf(fillet, 1) : -Infinity;
  const finOutlineMeters: Point[] = [
    fillet[0] ? [fillet[0][0], below] : [edgeX(finLeading, below), below],
    ...fillet,
    ...fin.leading.filter(([, z]) => z > filletTop),
    ...[...fin.trailing].reverse(),
    [edgeX(finTrailing, below), below],
  ];
  return {
    finChord,
    finSpan: (finTip - finRoot) * scale,
    finPoint,
    detail: {
      finOutline: finOutlineMeters.map(([x, z]): Point => [px(x), y(z)]),
      ...(fillet.length ? { finFillet: true } : {}),
      ...(rudderShare ? { rudderShare } : {}),
    },
  };
}

/** The near wing (with its flap track fairings and wingtip device) and tailplane from the side. */
function layoutSurfaces(f: Frame): Pick<Geometry, 'wingSide' | 'fairingsSide' | 'stabilizerSide' | 'winglet'> {
  const { m, px, y, scale, thickness, wingZ, stabZ, tipLeading, tipTrailing } = f;
  const { wing, stabilizer, wingtip } = m;

  // Wing and tailplane from the side: the band between their edges, at their heights along the span.
  const surfaceSide = (s: Surface, z: Line): Point[] => [
    ...byFirst(s.leading).map(([lateral, x]): Point => [px(x), y(at(z, lateral))]),
    ...byFirst(s.trailing)
      .reverse()
      .map(([lateral, x]): Point => [px(x), y(at(z, lateral)) + thickness]),
  ];

  // A wing's flap track fairings from the side: canoes hanging from its lower surface at their span, deepest a little
  // aft of their middle and rising to a point behind the trailing edge.
  const fairingSide = (fairing: { y: number; x: [number, number]; depth: number }): Point[] => {
    const top = y(at(wingZ, fairing.y)) + thickness;
    const depth = fairing.depth * scale;
    const [x0, x1] = fairing.x;
    const steps = 16;
    const under: Point[] = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      // Deepest at 0.55 of its length; its nose blunter than its tail.
      const s =
        t < 0.55 ? Math.sin((t / 0.55) * (Math.PI / 2)) ** 0.7 : Math.cos(((t - 0.55) / 0.45) * (Math.PI / 2)) ** 1.4;
      under.push([px(x0 + (x1 - x0) * t), top + depth * s]);
    }
    return [[px(x0), top], ...under, [px(x1), top]];
  };

  // The wingtip device from the side: x the share of its chord, y the share of its height, each edge from its
  // own root to the tip. The side view draws the wing's trailing edge `thickness` below its leading edge, so the
  // device's trailing root drops the same, easing back over its lower 40%, to meet it.
  let winglet: Geometry['winglet'];
  if (wingtip && tipLeading.length && tipTrailing.length) {
    const rootL = tipLeading[0]?.[0] ?? 0;
    const rootT = tipTrailing[0]?.[0] ?? 0;
    const tipZ = Math.max(maxOf(tipLeading, 0), maxOf(tipTrailing, 0));
    const edge = (line: Line, root: number, yy: number, drop = 0): Point => {
      const z = lerp(root, tipZ, clamp(yy, 0, 1));
      return [px(at(line, z)), y(z) + drop * Math.max(0, 1 - clamp(yy, 0, 1) / 0.4)];
    };
    winglet = {
      height: (tipZ - Math.min(rootL, rootT)) * scale,
      chord: Math.abs(at(tipTrailing, rootT) - at(tipLeading, rootL)) * scale,
      point: (x, yy) => lerpPoint(edge(tipLeading, rootL, yy), edge(tipTrailing, rootT, yy, thickness), x),
    };
  }

  return {
    wingSide: surfaceSide(wing, wingZ),
    fairingsSide: (wing.fairings ?? []).map(fairingSide),
    stabilizerSide: surfaceSide(stabilizer, stabZ),
    ...(winglet ? { winglet } : {}),
  };
}

/**
 * A rear-mounted engine's stub pylon, carried on from its measured tip to the nacelle's middle (`out` from the
 * centerline) so it meets the nacelle in every view. From the side it's mostly behind the nacelle: its outline runs
 * from the leading edge back to the trailing edge's tip, then tapers in to the trailing edge's root on the fuselage
 * (the fairing aft of the nozzle). From below, its plan.
 */
function stubPylon(f: Frame, p: Pylon, out: number): NonNullable<EngineGeometry['stubPylon']> {
  const { px, y, scale, belowCenterY, toFuselage } = f;
  const leading = byFirst(p.leading);
  const trailing = byFirst(p.trailing);
  const tipOf = (edge: Line): Line => {
    const last = edge.at(-1);
    return last && last[0] < out ? [...edge, [out, last[1]]] : edge;
  };
  const zs = p.z.map(([, z]) => z);
  const zTop = Math.max(...zs) + p.thickness / 2;
  const zBottom = Math.min(...zs) - p.thickness / 2;
  const front = minOf(leading, 1);
  const tipTrailing = trailing.at(-1)?.[1] ?? front;
  const rootTrailing = trailing[0]?.[1] ?? tipTrailing;
  const zMiddle = (zTop + zBottom) / 2;
  return {
    // Where the fairing aft of the nozzle meets the fuselage: halfway along the trailing edge, at its middle.
    root: toFuselage([(tipTrailing + rootTrailing) / 2, zMiddle]),
    side: [
      [px(front), y(zTop)],
      [px(tipTrailing), y(zTop)],
      [px(rootTrailing), y(zMiddle)],
      [px(tipTrailing), y(zBottom)],
      [px(front), y(zBottom)],
    ],
    below: (half) => {
      const sign = halfSign(half);
      return [
        ...tipOf(leading).map(([lateral, x]): Point => [px(x), belowCenterY + sign * lateral * scale]),
        ...tipOf(trailing)
          .reverse()
          .map(([lateral, x]): Point => [px(x), belowCenterY + sign * lateral * scale]),
      ];
    },
  };
}

/**
 * A propeller (docs/SHAPES.md), in pixels: its disc seen edge on, a lens a twelfth of its diameter thick (a blur of
 * blades turning), and its spinner, a rounded cone from its tip to its base on the nacelle; from the side about the
 * hub's height, from below about the engine's line (`out` from the centerline).
 */
function propellerGeometry(
  f: Frame,
  p: NonNullable<MeasuredShape['engines'][number]['propeller']>,
  out: number,
): NonNullable<EngineGeometry['propeller']> {
  const { px, y, scale, belowCenterY } = f;
  const radius = (p.diameter / 2) * scale;
  const thick = Math.max((p.diameter / 24) * scale, 1.2);
  const lens = (cx: number, cy: number): Point[] =>
    Array.from({ length: 48 }, (_, i): Point => {
      const a = (i / 48) * 2 * Math.PI;
      return [cx + thick * Math.cos(a), cy + radius * Math.sin(a)];
    });
  const [tip, base] = p.spinner?.x ?? [p.x - 0.05 * p.diameter, p.x + 0.05 * p.diameter];
  const r = ((p.spinner?.diameter ?? 0.15 * p.diameter) / 2) * scale;
  const cone = (cy: number): Point[] => {
    const ts = Array.from({ length: 17 }, (_, i) => i / 16);
    const at = (t: number): [number, number] => [px(lerp(tip, base, t)), r * Math.sqrt(1 - (1 - t) ** 2)];
    return [
      ...ts.map((t): Point => [at(t)[0], cy - at(t)[1]]),
      ...[...ts].reverse().map((t): Point => [at(t)[0], cy + at(t)[1]]),
    ];
  };
  return {
    disc: lens(px(p.x), y(p.z)),
    spinner: cone(y(p.z)),
    below: (half) => {
      const cy = belowCenterY + halfSign(half) * out * scale;
      return { disc: lens(px(p.x), cy), spinner: cone(cy) };
    },
  };
}

/**
 * An engine on the tail's centerline (docs/SHAPES.md): drawn over the fuselage and the fin's foot, in the side view's
 * pixels. The outline runs along its top and back along its bottom; where a strut joins the nacelle to the crown, the
 * bottom drops to the crown (a little inside it, so the two meet) over the strut's length.
 */
function tailEngine(f: Frame, e: MeasuredShape['engines'][number]): TailEngine {
  const { px, scale, belowCenterY, crown, crownZ, toSide } = f;
  const top = byFirst(e.top);
  const bottom = byFirst(e.bottom);
  const [s0, s1] = e.strut ?? [Infinity, -Infinity];
  const xs = [...new Set([...bottom.map(([x]) => x), ...crown.map(([x]) => x), s0, s1])]
    .filter((x) => x >= (bottom[0]?.[0] ?? 0) && x <= (bottom.at(-1)?.[0] ?? 0))
    .sort((a, b) => a - b);
  const under: Point[] = xs.flatMap((x): Point[] => {
    const b = at(bottom, x);
    const c = Math.min(crownZ(x) - 0.08, b);
    if (x === s0) return [toSide([x, b]), toSide([x, c])];
    if (x === s1) return [toSide([x, c]), toSide([x, b])];
    return [toSide([x, x > s0 && x < s1 ? c : b])];
  });
  const outline = [...top.map(toSide), ...under.reverse()];
  const front = Math.min(top[0]?.[0] ?? 0, bottom[0]?.[0] ?? 0);
  const back = Math.max(top.at(-1)?.[0] ?? 0, bottom.at(-1)?.[0] ?? 0);
  const lipTo = front + 0.04 * (e.x[1] - e.x[0]);
  const plan = e.halfWidth ? byFirst(e.halfWidth) : undefined;
  const planSide = (line: Line, sign: number): Point[] =>
    line.map(([x, w]): Point => [px(x), belowCenterY + sign * w * scale]);
  const cut = e.cowlEnd ?? Infinity;
  const ahead = plan?.filter(([x]) => x <= cut);
  const behind = plan?.filter(([x]) => x >= cut);
  if (plan && ahead?.length && behind?.length && Number.isFinite(cut)) {
    ahead.push([cut, at(plan, cut)]);
    behind.unshift([cut, at(plan, cut)]);
  }
  return {
    duct: e.duct ?? 'straight',
    outline,
    lip: [
      toSide([front, Math.max(...top.map(([, z]) => z))]),
      toSide([lipTo, Math.max(...top.map(([, z]) => z))]),
      toSide([lipTo, Math.min(...bottom.map(([, z]) => z))]),
      toSide([front, Math.min(...bottom.map(([, z]) => z))]),
    ],
    ...(e.nozzle
      ? { nozzle: [...byFirst(e.nozzle.top).map(toSide), ...byFirst(e.nozzle.bottom).reverse().map(toSide)] }
      : {}),
    ...(plan && e.duct !== 's'
      ? {
          below: [
            ...planSide(ahead?.length ? ahead : plan, -1),
            ...planSide([...(ahead?.length ? ahead : plan)].reverse(), 1),
          ],
          ...(behind && behind.length > 1 && Number.isFinite(cut)
            ? { belowNozzle: [...planSide(behind, -1), ...planSide([...behind].reverse(), 1)] }
            : {}),
        }
      : {}),
    x: [px(front), px(back)],
  };
}

/**
 * The engines: under the wing or on the rear fuselage (on a stub pylon), inboard first so an outboard one (nearer, in
 * the side view) is drawn over it, each a nacelle through its measured top and bottom; and those on the tail's
 * centerline, apart.
 */
function layoutEngines(f: Frame): {
  engines: EngineGeometry[];
  enginePoint: Geometry['enginePoint'];
  tailEngines: TailEngine[];
} {
  const { m, px, y, scale, halfWidth, wingZ, wingLeading } = f;
  const measuredEngines = [...m.engines].filter((e) => e.mount !== 'tail').sort((a, b) => a.y - b.y);
  const profiles = new Map<EngineGeometry, { top: Line; bottom: Line; x: [number, number] }>();
  const engines: EngineGeometry[] = measuredEngines.map((e) => {
    const topZ = maxOf(e.top, 1);
    const bottomZ = minOf(e.bottom, 1);
    const engine: EngineGeometry = {
      x0: px(e.x[0]),
      x1: px(e.x[1]),
      centerY: y((topZ + bottomZ) / 2),
      halfHeight: ((topZ - bottomZ) / 2) * scale,
      lateral: e.y * scale,
      underWing: e.mount !== 'fuselage' && e.y > maxOf(halfWidth, 1) && topZ < at(wingZ, e.y),
      ...(e.cowlEnd !== undefined && e.mount !== 'tail'
        ? { cowlEnd: (e.cowlEnd - e.x[0]) / (e.x[1] - e.x[0] || 1) }
        : {}),
      wingY: y(at(wingZ, e.y)),
      wingLeadingX: px(at(wingLeading, e.y)),
      ...(e.mount === 'fuselage' && e.pylon ? { stubPylon: stubPylon(f, e.pylon, e.y) } : {}),
      ...(e.propeller ? { propeller: propellerGeometry(f, e.propeller, e.y) } : {}),
      ...(e.halfWidth && e.mount !== 'tail' ? { belowHalfWidth: maxOf(e.halfWidth, 1) * scale } : {}),
    };
    profiles.set(engine, { top: byFirst(e.top), bottom: byFirst(e.bottom), x: e.x });
    return engine;
  });
  const enginePoint = (engine: EngineGeometry, nx: number, ny: number): Point => {
    const p = profiles.get(engine);
    if (!p) return [lerp(engine.x0, engine.x1, nx), engine.centerY - ny * engine.halfHeight];
    const meters = lerp(p.x[0], p.x[1], clamp(nx, 0, 1));
    const t = at(p.top, meters);
    const b = at(p.bottom, meters);
    return [px(meters), y((t + b) / 2 + (clamp(ny, -1.2, 1.2) * (t - b)) / 2)];
  };
  return {
    engines,
    enginePoint,
    tailEngines: m.engines.filter((e) => e.mount === 'tail').map((e) => tailEngine(f, e)),
  };
}

/** The below view: the belly by its half-width, the wing's and tailplane's plans. */
function layoutBelow(
  f: Frame,
): Pick<Geometry, 'belowHeight' | 'bellyPoint' | 'wingUnderPoint' | 'wingUnderSpan' | 'tailplaneBelow'> &
  Pick<MeasuredDetail, 'wingBelow'> {
  const { m, L, fuselageX, px, scale, belowCenterY, halfWidth, wingLeading, wingTrailing } = f;
  const bellyPoint = (x: number, yy: number, half: Half): Point => {
    const offset = at(halfWidth, clamp(x, 0, 1) * L) * scale * Math.sin(((clamp(yy, -1, 0) + 1) * Math.PI) / 2);
    return [fuselageX(x), belowCenterY + halfSign(half) * offset];
  };
  const wingRoot = Math.max(wingLeading[0]?.[0] ?? 0, wingTrailing[0]?.[0] ?? 0);
  const wingTip = Math.min(wingLeading.at(-1)?.[0] ?? 0, wingTrailing.at(-1)?.[0] ?? 0);
  const wingUnderPoint = (x: number, yy: number, half: Half): Point => {
    const lateral = lerp(wingRoot, wingTip, yy);
    const leading = at(wingLeading, lateral);
    const trailing = at(wingTrailing, lateral);
    return [px(lerp(leading, trailing, x)), belowCenterY + halfSign(half) * lateral * scale];
  };
  const planOutline = (s: Surface, half: Half): Point[] => {
    const sign = halfSign(half);
    return [
      ...byFirst(s.leading).map(([lateral, x]): Point => [px(x), belowCenterY + sign * lateral * scale]),
      ...byFirst(s.trailing)
        .reverse()
        .map(([lateral, x]): Point => [px(x), belowCenterY + sign * lateral * scale]),
    ];
  };
  return {
    belowHeight: Math.ceil(2 * belowCenterY),
    bellyPoint,
    wingUnderPoint,
    wingUnderSpan: wingTip * scale,
    tailplaneBelow: (half) => planOutline(m.stabilizer, half),
    wingBelow: (half) => planOutline(m.wing, half),
  };
}

/** A measured shape as a Geometry, a section at a time over the same frame. */
export function layoutMeasured(m: MeasuredShape): Geometry {
  const f = frameOf(m);
  const fuselage = layoutFuselage(f);
  const fin = layoutFin(f);
  const { engines, enginePoint, tailEngines } = layoutEngines(f);
  const { wingBelow, ...below } = layoutBelow(f);
  return {
    shape: approximate(m),
    windows: fuselage.windows,
    sideHeight: f.sideHeight,
    belowHeight: below.belowHeight,
    scale: f.scale,
    radius: f.radius,
    fuselageLength: f.fuselagePixels,
    centerY: f.centerY,
    belowCenterY: f.belowCenterY,
    fuselageX: f.fuselageX,
    share: f.share,
    fuselagePoint: fuselage.fuselagePoint,
    profile: fuselage.profile,
    finChord: fin.finChord,
    finSpan: fin.finSpan,
    finPoint: fin.finPoint,
    engines,
    enginePoint,
    ...layoutSurfaces(f),
    bellyPoint: below.bellyPoint,
    wingUnderPoint: below.wingUnderPoint,
    wingUnderSpan: below.wingUnderSpan,
    tailplaneBelow: below.tailplaneBelow,
    measured: {
      ...fuselage.detail,
      ...fin.detail,
      wingBelow,
      ...(tailEngines.length ? { tailEngines } : {}),
    },
  };
}
