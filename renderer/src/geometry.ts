// Where each part's coordinates (docs/COORDINATES.md) land on a shape, in SVG pixels. The side view is the left
// side, nose on the left; the below view has the nose on the left too, so the aircraft's left side is its top
// half. The fuselage always spans the same width; everything else is to the shape's scale.

import type { AreaPoint, Point } from './scheme.js';
import type { AircraftShape } from './shape.js';

export const VIEW_WIDTH = 1000;
export const NOSE_X = 50;
export const FUSELAGE_PIXELS = 900;
export const MARGIN = 14;
/** A parametric shape's cabin windows: their bottom and top in fuselage y. */
export const WINDOW_BAND = [0.05, 0.2] as const;

export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpPoint = (a: Point, b: Point, t: number): Point => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
/**
 * Round the fuselage, y is an angle and a side view draws it at height sin(y·90°) (COORDINATES.md): `toHeight` is
 * that height as a share of the radius, `fromHeight` turns one back to y.
 */
export const toHeight = (y: number): number => Math.sin((clamp(y, -1, 1) * Math.PI) / 2);
export const fromHeight = (h: number): number => (Math.asin(clamp(h, -1, 1)) * 2) / Math.PI;

/** Maps a part's own coordinates to pixels. */
export type Mapping = (x: number, y: number) => Point;

/** A rectangle in a part's own coordinates. */
export const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** Whether a point is inside a polygon (even-odd); an area's corner flags are ignored. */
export function inside([px, py]: AreaPoint, poly: readonly AreaPoint[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i] ?? [0, 0];
    const [xj, yj] = poly[j] ?? [0, 0];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
/** A quarter ellipse from 0 to 1: the nose's and tail's rounding. */
const ellipseRise = (t: number): number => Math.sqrt(1 - (1 - clamp(t, 0, 1)) ** 2);
const smoothstep = (t: number): number => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
const tan = (deg: number): number => Math.tan((deg * Math.PI) / 180);

/** Which half of the below view: the aircraft's left side (top) or right side (bottom). */
export type Half = 'left' | 'right';
export const HALVES: readonly Half[] = ['left', 'right'];
/** +1 for the bottom half of the below view, −1 for the top. */
export const halfSign = (half: Half): number => (half === 'left' ? -1 : 1);

/** One engine, in pixels: nacelle front and back x, center y in the side view, half height, lateral in the below view. */
export interface EngineGeometry {
  x0: number;
  x1: number;
  centerY: number;
  halfHeight: number;
  lateral: number;
  /** Hung under the wing (with a pylon up to it), rather than on the fuselage. */
  underWing: boolean;
  /**
   * Where the fan cowl ends, as a share of the nacelle from its inlet (0) to its exhaust (1): behind it the core and
   * nozzle, bare metal whatever the scheme paints (a measured shape's `cowlEnd`).
   */
  cowlEnd?: number;
  /** Where the pylon meets the wing, in side-view pixels. */
  wingY: number;
  /** The wing's leading edge at the engine's lateral, in pixels (the below view's pylon reaches it). */
  wingLeadingX: number;
  /**
   * On the fuselage (a rear-engined type): its stub pylon, from the fuselage's side out into the nacelle. `side` is
   * its outline in the side view (left side, pixels), mostly behind the nacelle; `below` its plan in the below view;
   * `root` where its trailing part meets the fuselage, in fuselage space (whose paint it takes, unless the scheme
   * names its colour).
   */
  stubPylon?: { side: Point[]; below: (half: Half) => Point[]; root: Point };
  /**
   * A propeller ahead of the nacelle (a turboprop's), in pixels: its disc seen edge on (a thin lens, drawn faint) and
   * its spinner, in the side view (left side) and in the below view.
   */
  propeller?: { disc: Point[]; spinner: Point[]; below: (half: Half) => { disc: Point[]; spinner: Point[] } };
  /** From below, the nacelle's half width in pixels, where it isn't round (a turboprop's); else 0.8 of its half height. */
  belowHalfWidth?: number;
}

/** A shape laid out in pixels, with the mappings from each part's space. */
export interface Geometry {
  shape: AircraftShape;
  sideHeight: number;
  belowHeight: number;
  /** Pixels per meter. */
  scale: number;
  radius: number;
  fuselageLength: number;
  centerY: number;
  belowCenterY: number;
  /** Fuselage x (0 nose → 1 tail) to pixels. */
  fuselageX: (x: number) => number;
  /** Meters back from the nose, as fuselage x. */
  share: (meters: number) => number;
  fuselagePoint: (x: number, y: number) => Point;
  /** The crown's and the belly's heights above the centerline at fuselage x, in meters (the belly's is negative). */
  profile: (x: number) => { crown: number; belly: number };
  finChord: (fy: number) => Point;
  finSpan: number;
  finPoint: (fx: number, fy: number) => Point;
  engines: EngineGeometry[];
  enginePoint: (engine: EngineGeometry, nx: number, ny: number) => Point;
  wingSide: Point[];
  /** The near wing's flap track fairings from the side (a measured shape's; none on a built-in one). */
  fairingsSide: Point[][];
  stabilizerSide: Point[];
  winglet?: { height: number; chord: number; point: (x: number, y: number) => Point };
  bellyPoint: (x: number, y: number, half: Half) => Point;
  wingUnderPoint: (x: number, y: number, half: Half) => Point;
  wingUnderSpan: number;
  tailplaneBelow: (half: Half) => Point[];
  /**
   * The cabin windows' band in fuselage y (bottom, top): the main deck's (none on a freighter without them), and a
   * second deck's where it's on the main tube, with the fuselage x it runs over (the A380's whole length, a 747's
   * front). A scheme drawn on another type is fitted to these. A measured shape's main row is at one height in
   * meters all along (`heights`, as `profile`'s), so its band in y moves where the body tapers. `line`: where they
   * are, or would be on a type without them that says (a freighter: its passenger version's), in meters.
   */
  windows: {
    main?: [number, number];
    heights?: [number, number];
    line?: [number, number];
    /** A type without windows: where its first and last would run (fuselage x), its passenger version's. */
    wouldBe?: [number, number];
    /** The flight deck's lowest pane, in meters (a measured shape's). */
    flightDeck?: number;
    upper?: { band: [number, number]; along: [number, number] };
  };
  /** What a measured shape (shapes/, measured.ts) has that a parametric one leaves to the views' defaults. */
  measured?: MeasuredDetail;
}

export interface MeasuredDetail {
  /** Fuselage x positions (0 nose → 1 tail) its outline is drawn through: every measured point. */
  fuselageSamples: number[];
  /** The fin's outline in side-view pixels (left side), its fillet included, from inside the fuselage round. */
  finOutline: Point[];
  /** It has a dorsal fillet: paint at the fin's leading edge (x 0) carries forward over it. */
  finFillet?: true;
  /** The rudder's hinge as a share of the fin's chord at each height (else about 0.7). */
  rudderShare?: (fy: number) => number;
  /** The wing's plan outline in the below view. */
  wingBelow: (half: Half) => Point[];
  /** Each cabin window and cockpit pane as measured, in fuselage space. */
  glass: { cabin: Point[][]; cockpit: Point[][] };
  /** Each door as measured: its kind and its outline in fuselage space. */
  doors: Door[];
  /**
   * An upper deck above the main tube (a 747's hump), in the side view's pixels (left side): its x range as shares
   * of the fuselage, its outline (its top, then back along the main crown), and the glass and doors on it.
   */
  hump?: {
    from: number;
    to: number;
    outline: Point[];
    glass: { cabin: Point[][]; cockpit: Point[][] };
    doors: Door[];
  };
  /** Engines on the tail's centerline (the MD-11's, the 727's): see TailEngine. */
  tailEngines?: TailEngine[];
}

/**
 * An engine on the tail's centerline, in pixels (the side view's left side, the below view's): drawn over the fuselage
 * and the fin's foot, wearing the fin's paint carried down (docs/COORDINATES.md).
 */
export interface TailEngine {
  /** Through its nacelle (`straight`: the MD-11's, the fin on its top), or an S-duct's intake on the crown (`s`). */
  duct: 'straight' | 's';
  /** From the side: the nacelle with the fairing over its nozzle and its strut down to the crown, or the intake. */
  outline: Point[];
  /** From the side: a band over its foremost 4%, the inlet lip. */
  lip: Point[];
  /** From the side: the bare exhaust, where it shows. */
  nozzle?: Point[];
  /** From below: the nacelle's plan ahead of its cowl's end, and the bare core and nozzle behind it. */
  below?: Point[];
  belowNozzle?: Point[];
  /** Its outline's forward and aft ends, in pixels. */
  x: [number, number];
}

export interface Door {
  kind: 'door' | 'exit' | 'cargo';
  /** The one side it's on, where it isn't on both. */
  side?: 'left' | 'right';
  /** Its outline in fuselage space, corners rounded. */
  outline: Point[];
  /** A main door's small window, in fuselage space. */
  window?: Point[];
}

/**
 * A door's outline from its edges (metres back, metres up), its corners rounded by `round` metres, each point turned
 * into fuselage space by `toFuselage`. A main door gets its small window, high and centred.
 */
export function doorShape(
  kind: Door['kind'],
  [x0, x1]: [number, number],
  [z0, z1]: [number, number],
  toFuselage: (p: Point) => Point,
): Door {
  const r = Math.min(0.12, (x1 - x0) / 4, (z1 - z0) / 4);
  const corner = (cx: number, cz: number, from: number): Point[] =>
    [0, 1, 2, 3].map((k): Point => {
      const a = ((from + (k * 90) / 3) * Math.PI) / 180;
      return [cx + r * Math.cos(a), cz + r * Math.sin(a)];
    });
  const outline = [
    ...corner(x1 - r, z0 + r, 270),
    ...corner(x1 - r, z1 - r, 0),
    ...corner(x0 + r, z1 - r, 90),
    ...corner(x0 + r, z0 + r, 180),
  ].map(toFuselage);
  if (kind !== 'door') return { kind, outline };
  const cx = (x0 + x1) / 2;
  const top = z0 + (z1 - z0) * 0.78;
  const window = (
    [
      [cx - 0.1, top - 0.24],
      [cx + 0.1, top - 0.24],
      [cx + 0.1, top],
      [cx - 0.1, top],
    ] as Point[]
  ).map(toFuselage);
  return { kind, outline, window };
}

/** The fuselage's half height at fuselage x, in meters. */
export const fuselageRadiusAt = (g: Geometry, x: number): number => (g.profile(x).crown - g.profile(x).belly) / 2;

/** The upper deck's window band, if it runs over any of fuselage x0 to x1 (the A380's whole length, a 747's front). */
export function deckAt(g: Geometry, [x0, x1]: [number, number]): [number, number] | undefined {
  const deck = g.windows.upper;
  return deck && x1 >= deck.along[0] && x0 <= deck.along[1] ? deck.band : undefined;
}

export function layout(shape: AircraftShape): Geometry {
  const { fuselage, fin, wing, stabilizer } = shape;
  const L = fuselage.length;
  const scale = FUSELAGE_PIXELS / L;
  const radius = fuselage.radius * scale;
  const share = (meters: number): number => meters / L;
  const fuselageX = (x: number): number => NOSE_X + x * FUSELAGE_PIXELS;
  const px = (meters: number): number => NOSE_X + meters * scale;

  // Heights in the side view, measured up from the centerline in meters, decide the picture's height.
  const wingTipZ = wing.height + wing.span * tan(wing.dihedralDeg);
  const finTipZ = fuselage.radius + fin.height;
  const top = Math.max(finTipZ, wingTipZ + (shape.winglet?.height ?? 0), fuselage.radius) * scale;
  const lowest = Math.min(...shape.engines.map((e) => e.height - e.radius), -fuselage.radius) * scale;
  const centerY = MARGIN + top;
  const sideHeight = Math.ceil(centerY - lowest + MARGIN);
  const y = (meters: number): number => centerY - meters * scale;

  const { nose, tail } = fuselage;
  const noseTipY = centerY - nose.tip * radius;
  const crownFull = share(nose.crown);
  const bellyFull = share(nose.belly);
  const crownFrom = share(tail.crownFrom);
  const bellyFrom = share(tail.bellyFrom);
  const crownY = (x: number): number => {
    const c = clamp(x, 0, 1);
    if (c < crownFull) return lerp(noseTipY, centerY - radius, ellipseRise(c / crownFull));
    if (c > crownFrom)
      return lerp(centerY - radius, centerY - tail.crownEnd * radius, ((c - crownFrom) / (1 - crownFrom)) ** 2);
    return centerY - radius;
  };
  const bellyY = (x: number): number => {
    const c = clamp(x, 0, 1);
    if (c < bellyFull) return lerp(noseTipY, centerY + radius, ellipseRise(c / bellyFull));
    if (c > bellyFrom) {
      const t = (c - bellyFrom) / (1 - bellyFrom);
      return lerp(centerY + radius, centerY - tail.bellyEnd * radius, smoothstep(t) * 0.6 + t * 0.4);
    }
    return centerY + radius;
  };
  const radiusAt = (x: number): number => (bellyY(x) - crownY(x)) / 2;

  /** A point at y is drawn r·sin(y·90°) from the centerline. */
  const fuselagePoint = (x: number, yy: number): Point => {
    const crown = crownY(x);
    const belly = bellyY(x);
    const r = (belly - crown) / 2;
    return [fuselageX(x), (crown + belly) / 2 - r * toHeight(yy)];
  };

  const finSpan = fin.height * scale;
  const finTipY = centerY - radius - finSpan;
  const finChord = (fy: number): Point => [
    lerp(share(fin.rootLeading), share(fin.tipLeading), fy),
    lerp(share(fin.rootTrailing), share(fin.tipTrailing), fy),
  ];
  /** x is a share of the chord at each height, so the space is sheared. */
  const finPoint = (fx: number, fy: number): Point => {
    const [leading, trailing] = finChord(fy);
    const x = lerp(leading, trailing, fx);
    const rootY = crownY(x);
    return [fuselageX(x), rootY + (finTipY - rootY) * fy];
  };

  const wingZAt = (lateral: number): number => wing.height + lateral * tan(wing.dihedralDeg);
  /** The leading edge at a lateral in meters, from the fuselage side to the tip. */
  const wingLeadingAt = (lateral: number): number =>
    lerp(wing.rootLeading, wing.tipLeading, clamp((lateral - fuselage.radius) / (wing.span - fuselage.radius), 0, 1));
  // Inboard first, so an outboard engine (nearer, in the side view) is drawn over it.
  const engines: EngineGeometry[] = [...shape.engines]
    .sort((a, b) => a.out - b.out)
    .map((e) => ({
      x0: px(e.front),
      x1: px(e.back),
      centerY: y(e.height),
      halfHeight: e.radius * scale,
      lateral: e.out * scale,
      underWing: e.out > fuselage.radius && e.height < wingZAt(e.out),
      wingY: y(wingZAt(e.out)),
      wingLeadingX: px(wingLeadingAt(e.out)),
    }));
  /** The nacelle narrows over its last 30%. */
  const enginePoint = (engine: EngineGeometry, nx: number, ny: number): Point => {
    const halfHeight = engine.halfHeight * (nx < 0.7 ? 1 : 1 - (0.3 * (nx - 0.7)) / 0.3);
    return [lerp(engine.x0, engine.x1, nx), engine.centerY - clamp(ny, -1.2, 1.2) * halfHeight];
  };

  // The near wing and tailplane, nearly edge on: thin slivers from root to tip, the tip raised by the dihedral.
  const thickness = 0.1 * radius;
  const wingSide: Point[] = [
    [px(wing.rootLeading), y(wing.height)],
    [px(wing.rootTrailing), y(wing.height) + thickness],
    [px(wing.tipTrailing), y(wingTipZ) + thickness],
    [px(wing.tipLeading), y(wingTipZ)],
  ];
  const stabilizerTipZ = stabilizer.height + stabilizer.span * tan(stabilizer.dihedralDeg);
  const stabilizerSide: Point[] = [
    [px(stabilizer.rootLeading), y(stabilizer.height)],
    [px(stabilizer.tipLeading), y(stabilizerTipZ)],
    [px(stabilizer.tipTrailing), y(stabilizerTipZ) + thickness],
    [px(stabilizer.rootTrailing), y(stabilizer.height) + thickness],
  ];

  let winglet: Geometry['winglet'];
  if (shape.winglet) {
    const w = shape.winglet;
    const rootLE: Point = [px(wing.tipLeading), y(wingTipZ)];
    const rootTE: Point = [px(wing.tipTrailing), y(wingTipZ) + thickness];
    const tipLE: Point = [px(wing.tipLeading + w.sweep), y(wingTipZ + w.height)];
    const tipTE: Point = [px(wing.tipLeading + w.sweep + w.tipChord), y(wingTipZ + w.height) + thickness * 0.2];
    winglet = {
      height: w.height * scale,
      chord: (wing.tipTrailing - wing.tipLeading) * scale,
      /** x leading → trailing edge, y root → tip. */
      point: (x, yy) => lerpPoint(lerpPoint(rootLE, tipLE, yy), lerpPoint(rootTE, tipTE, yy), x),
    };
  }

  // The below view.
  const lateralMax = Math.max(
    wing.span,
    stabilizer.span,
    fuselage.radius,
    ...shape.engines.map((e) => e.out + e.radius),
  );
  const belowCenterY = MARGIN + lateralMax * scale;
  const belowHeight = Math.ceil(2 * belowCenterY);
  /** Fuselage space on the belly (y from −1 the centerline up to 0). */
  const bellyPoint = (x: number, yy: number, half: Half): Point => {
    const offset = radiusAt(clamp(x, 0, 1)) * Math.sin(((clamp(yy, -1, 0) + 1) * Math.PI) / 2);
    return [fuselageX(x), belowCenterY + halfSign(half) * offset];
  };
  const wingRoot = radius * 0.95;
  const wingUnderSpan = wing.span * scale;
  /** Wing space (x leading → trailing edge, y root → tip) on the underside. */
  const wingUnderPoint = (x: number, yy: number, half: Half): Point => {
    const leading = lerp(px(wing.rootLeading), px(wing.tipLeading), yy);
    const trailing = lerp(px(wing.rootTrailing), px(wing.tipTrailing), yy);
    const lateral = wingRoot + yy * (wingUnderSpan - wingRoot);
    return [lerp(leading, trailing, x), belowCenterY + halfSign(half) * lateral];
  };
  const tailplaneBelow = (half: Half): Point[] => {
    const s = halfSign(half);
    const root = radiusAt(share(stabilizer.rootLeading)) * 0.9;
    return [
      [px(stabilizer.rootLeading), belowCenterY + s * root],
      [px(stabilizer.tipLeading), belowCenterY + s * stabilizer.span * scale],
      [px(stabilizer.tipTrailing), belowCenterY + s * stabilizer.span * scale],
      [px(stabilizer.rootTrailing), belowCenterY + s * root * 0.6],
    ];
  };

  return {
    shape,
    // Where the views draw a parametric shape's windows (paint.ts, paintGlass).
    windows: { main: [WINDOW_BAND[0], WINDOW_BAND[1]] },
    sideHeight,
    belowHeight,
    scale,
    radius,
    fuselageLength: FUSELAGE_PIXELS,
    centerY,
    belowCenterY,
    fuselageX,
    share,
    fuselagePoint,
    profile: (x) => ({ crown: (centerY - crownY(x)) / scale, belly: (centerY - bellyY(x)) / scale }),
    finChord,
    finSpan,
    finPoint,
    engines,
    enginePoint,
    wingSide,
    fairingsSide: [],
    stabilizerSide,
    ...(winglet ? { winglet } : {}),
    bellyPoint,
    wingUnderPoint,
    wingUnderSpan,
    tailplaneBelow,
  };
}
