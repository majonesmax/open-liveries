import type { Logo, Point, Title } from './scheme.js';
import type { Canvas, Element } from './svg.js';
/** A font's em size is about this many cap heights: titles are measured by cap height. */
export declare const CAP_HEIGHT_PER_EM = 0.71;
/** A bold sans letter's average advance, in ems: an estimate of how wide a title sets before it's spread. */
export declare const ADVANCE_PER_EM = 0.58;
export interface TitlePlacement {
    /** The baseline's left end as seen from the left side, in pixels. */
    at: Point;
    capHeight: number;
    /** The length to spread the text over, in pixels; 0 to set it naturally. */
    length: number;
    side: 'left' | 'right';
    /** On the belly: `at` is on the line through the text's middle, not its baseline. */
    centeredOnLine?: boolean;
}
/**
 * On the right side a title covers the same stretch and reads normally, so it's anchored at its aft end, and a
 * turned title takes the mirrored angle (docs/COORDINATES.md › Right side).
 */
export declare function drawTitle(title: Title, placement: TitlePlacement, parent: Element, canvas: Canvas): void;
/** A logo centered on its place, upright and undistorted: the caller's drawing, or a placeholder named by its mark. */
export declare function drawLogo(logo: Logo, center: Point, height: number, view: 'left' | 'right' | 'below', parent: Element, canvas: Canvas): void;
