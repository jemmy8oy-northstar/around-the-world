/**
 * The zoom/pan arithmetic for the world map, kept out of the component so it can
 * be tested without a browser — pinch gestures are close to impossible to drive
 * from a test, but the maths behind them is ordinary and worth pinning.
 *
 * A transform maps a point in the map's own coordinate space to the coordinate
 * space of the SVG viewBox: `screen = point * k + (x, y)`. That is the same
 * shape d3-zoom uses, deliberately, in case this ever grows into needing it.
 */
export interface ZoomTransform {
  /** Scale factor. 1 is "whole world visible". */
  k: number;
  x: number;
  y: number;
}

export const IDENTITY: ZoomTransform = { k: 1, x: 0, y: 0 };

/**
 * 1 is the floor because the map is fitted to the viewBox at k=1 — zooming out
 * past it would only add empty gutters.
 *
 * The ceiling is measured, not chosen. The tightest pair a pub crawl plausibly
 * produces is the Netherlands and Belgium, whose badge centres sit 2.10px apart
 * at rest on an iPhone 13. A badge's tap target is 16.8px across, so pulling
 * those two apart far enough to hit either one individually needs 8.03x — which
 * an earlier ceiling of 8 missed by a whisker, separating them visually while
 * leaving them still impossible to tap. 12 clears it with room for a tighter
 * pair, and the land underneath is vector, so it stays crisp.
 */
export const MIN_SCALE = 1;
export const MAX_SCALE = 12;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export type Point = readonly [number, number];

/** Where a point on the map currently sits within the viewBox. */
export function apply(transform: ZoomTransform, [px, py]: Point): [number, number] {
  return [px * transform.k + transform.x, py * transform.k + transform.y];
}

/**
 * Holds the map still under the fingers: whatever was beneath `focus` before the
 * gesture is beneath it afterwards. Without this a pinch drifts away from
 * whatever you were trying to look at, which is the whole reason to pinch.
 */
export function zoomAbout(
  transform: ZoomTransform,
  factor: number,
  focus: Point,
): ZoomTransform {
  const k = clamp(transform.k * factor, MIN_SCALE, MAX_SCALE);

  // Recover the actual applied ratio: at the clamps it is not `factor`, and
  // using `factor` there would slide the map while refusing to scale it.
  const applied = k / transform.k;

  return {
    k,
    x: focus[0] - (focus[0] - transform.x) * applied,
    y: focus[1] - (focus[1] - transform.y) * applied,
  };
}

export function panBy(
  transform: ZoomTransform,
  dx: number,
  dy: number,
): ZoomTransform {
  return { ...transform, x: transform.x + dx, y: transform.y + dy };
}

/**
 * Keeps the map covering the viewBox, so it can never be dragged into open
 * space. At k=1 the only legal offset is 0, which also means a stray one-finger
 * drag on an unzoomed map does nothing at all rather than nudging the world.
 */
export function clampToBounds(
  transform: ZoomTransform,
  width: number,
  height: number,
): ZoomTransform {
  return {
    k: transform.k,
    x: clamp(transform.x, width * (1 - transform.k), 0),
    y: clamp(transform.y, height * (1 - transform.k), 0),
  };
}

export const isZoomed = (transform: ZoomTransform) => transform.k > MIN_SCALE;

/** Distance between two active touches — the raw input to a pinch. */
export function touchDistance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function midpoint(a: Point, b: Point): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
