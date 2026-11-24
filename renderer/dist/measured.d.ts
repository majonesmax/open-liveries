import type { Geometry } from './geometry.js';
import type { Point } from './scheme.js';
/** [a, b] pairs along a line, in meters (docs/SHAPES.md says which axes each line uses). */
type Line = Point[];
interface Surface {
    /** Plan view: [y, x] root to tip. */
    leading: Line;
    trailing: Line;
    /** Front view: [y, z] root to tip. */
    z: Line;
    /** A wing's flap track fairings: out from the centerline, front and aft ends, depth below the wing (meters). */
    fairings?: {
        y: number;
        x: [number, number];
        depth: number;
        width?: number;
    }[];
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
        hump?: {
            crown: Line;
            width: number;
            section?: Line;
        };
    };
    fin: {
        leading: Line;
        trailing: Line;
        fillet?: Line;
        rudder?: Line;
    };
    /** On the fuselage, or on the fin (a T-tail). */
    stabilizer: Surface & {
        mount?: 'fuselage' | 'fin';
    };
    wing: Surface;
    wingtip?: {
        kind: string;
        leading: Line;
        trailing: Line;
        front?: Line;
    };
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
        nozzle?: {
            top: Line;
            bottom: Line;
        };
        pylon?: Pylon;
        /** A propeller ahead of the nacelle (a turboprop's): its disc's plane, hub height, diameter, blades and spinner. */
        propeller?: {
            x: number;
            z: number;
            diameter: number;
            blades: number;
            spinner?: {
                x: [number, number];
                diameter: number;
            };
        };
        y: number;
        top: Line;
        bottom: Line;
        inlet?: {
            z: number;
            width: number;
            height: number;
        };
    }[];
    cabin: {
        windows: {
            z: [number, number];
            width: number;
            x: number[];
            note?: string;
            wouldBe?: [number, number];
        };
        /** A double-deck cabin's upper row, as `windows`. */
        upperWindows?: {
            z: [number, number];
            width: number;
            x: number[];
            note?: string;
        };
        doors: {
            kind: 'door' | 'exit' | 'cargo';
            x: [number, number];
            z: [number, number];
            side?: 'left' | 'right';
        }[];
    };
    cockpit: {
        windows: Line[];
    };
}
/** A parsed JSON value that is a shape file rather than a parametric AircraftShape. */
export declare function isMeasuredShape(shape: unknown): shape is MeasuredShape;
/** What a shape file read from JSON lacks for drawing (schema/shape.schema.json checks the rest). */
export declare function measuredShapeProblems(shape: unknown): string[];
/** A measured shape as a Geometry, a section at a time over the same frame. */
export declare function layoutMeasured(m: MeasuredShape): Geometry;
export {};
