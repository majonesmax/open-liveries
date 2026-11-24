/** A swept surface (wing, tailplane, fin), by where its root and tip chords start and end, back from the nose. */
export interface Chords {
    rootLeading: number;
    rootTrailing: number;
    tipLeading: number;
    tipTrailing: number;
}
export interface AircraftShape {
    name: string;
    fuselage: {
        /** Nose to tail cone. */
        length: number;
        /** The cabin's radius. */
        radius: number;
        /**
         * How far back the crown and the belly reach full height, and the nose tip's height as a share of the radius
         * (negative is below the centerline).
         */
        nose: {
            crown: number;
            belly: number;
            tip: number;
        };
        /**
         * Where the crown starts to fall and the belly to rise toward the tail, and their heights at the tail as shares
         * of the radius above the centerline.
         */
        tail: {
            crownFrom: number;
            crownEnd: number;
            bellyFrom: number;
            bellyEnd: number;
        };
    };
    /** The cabin windows' run, their spacing, and the gaps for doors (from, to). */
    cabin: {
        from: number;
        to: number;
        pitch: number;
        doors: [from: number, to: number][];
    };
    /** Where the cockpit windows start and end. */
    cockpit: {
        from: number;
        to: number;
    };
    /** Its chords at the root (on the crown) and the tip, and its height above the crown. */
    fin: Chords & {
        height: number;
    };
    /** The tailplane: chords, half span, the root's height and its dihedral. */
    stabilizer: Chords & {
        span: number;
        height: number;
        dihedralDeg: number;
    };
    /** Chords at the fuselage side and the tip, half span, the root's height and its dihedral. */
    wing: Chords & {
        span: number;
        height: number;
        dihedralDeg: number;
    };
    /** Raised wingtips: height, how far back the tip sits, and its chord. Leave out for plain or raked tips. */
    winglet?: {
        height: number;
        sweep: number;
        tipChord: number;
    };
    /** One side's engines (the other side mirrors them): nacelle front and back, radius, center height and lateral. */
    engines: {
        front: number;
        back: number;
        radius: number;
        height: number;
        out: number;
    }[];
}
/** About a 737-800 or A320: the shape the viewer has always drawn. */
export declare const NARROWBODY: AircraftShape;
/** About a 787-9 or A350-900: a longer, fatter fuselage, raked wingtips, big engines. */
export declare const WIDEBODY: AircraftShape;
/** About an E175 or CRJ900 (a wing-engined one): short, slim, a tall fin. */
export declare const REGIONAL: AircraftShape;
/** The shapes that come with the renderer, by name. */
export declare const SHAPES: Readonly<{
    narrowbody: AircraftShape;
    widebody: AircraftShape;
    regional: AircraftShape;
}>;
/** A built-in shape by name (from a URL or a setting, say), or undefined if there's none by that name. */
export declare function shapeNamed(name: string): AircraftShape | undefined;
/**
 * What's wrong with a shape (an empty list if nothing): enough to catch a typo in a hand-written one. Takes
 * anything, so a shape straight from JSON can be checked before it's used.
 */
export declare function shapeProblems(input: unknown): string[];
