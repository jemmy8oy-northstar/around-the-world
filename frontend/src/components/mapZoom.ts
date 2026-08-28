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

/** The map's own extent, which the projection is fitted to at k=1. */
export const WIDTH = 800;
export const HEIGHT = 380;

/**
 * 1 is the floor because the map is fitted to the viewBox at k=1 — settling
 * below it would only add empty gutters.
 *
 * The ceiling is measured, not chosen — against every close pair in the Balkans
 * and Benelux, not the first one that came to mind. A badge's tap target is
 * 16.8px across on an iPhone 13, and the worst pairs at rest are:
 *
 *   AL/MK 1.63px (needs 10.35x)   BE/LU 1.69px (9.98x)   HR/BA 1.81px (9.30x)
 *   HU/SK 1.84px (9.16x)          AT/SI 1.92px (8.78x)   NL/BE 2.10px (8.03x)
 *
 * So a ceiling of 8 — where this started, sized against NL/BE alone — left six
 * further pairs permanently untappable, including the Albania/Montenegro case
 * James reported on #45. 12 clears every one of them with headroom, and the land
 * underneath is vector, so it stays crisp. Re-measure before lowering it.
 */
export const MIN_SCALE = 1;
export const MAX_SCALE = 12;

/**
 * How far past the scale limits a gesture in progress may stretch, and how far
 * past its edges the map may be dragged, before it springs back on release.
 *
 * James, #45: "maybe allow the image to zoom out of its confines then if it's
 * too zoomed out it just snaps back". The reason this matters is not decoration.
 * A hard clamp mid-gesture makes the map feel like it is fighting the hand — the
 * fingers keep moving and the picture stops dead, which reads as broken rather
 * than as a limit. Letting it stretch and spring back says "that is as far as it
 * goes" using the same language every other touch surface on the phone uses.
 */
export const SCALE_RUBBER = 1.4;
export const EDGE_SLACK = 0.1;

/**
 * The map grows taller as it is zoomed, up to some multiple of its resting
 * height — James's "it staying in the same horizontal box feels like a missed
 * opportunity. It could expand into the vertical space available."
 *
 * While the box is still growing, the growth alone does the magnifying: at k=2
 * the box is 2x taller and still shows the world's full height, so that stretch
 * of the gesture buys screen area instead of cropping the top and bottom off
 * the world. Past the multiple the box holds still and the zoom becomes an
 * ordinary, cropping one.
 *
 * This constant is only the fallback for a map that has not been told what
 * space it has (see `growthBudget`). It was picked by eye, and picking it by eye
 * is what James was looking at on #52: on an iPhone the page has room for about
 * 2.7x the map's resting height, so a fixed 1.8 stopped growing with a third of
 * the page still empty and started cropping the world instead — "map still more
 * cropped than it needs to be". Measure the space; don't guess it.
 */
export const HEIGHT_GROWTH = 1.8;

/**
 * How many times its resting height the map may grow, given the height the page
 * actually has for it. `available` and `resting` are CSS pixels of the same
 * element — the ratio is what carries over into viewBox units.
 *
 * Never below 1: a page too short for even the resting map must not shrink it,
 * because at k=1 the whole world is on screen and shrinking would crop it. An
 * unmeasurable page (zero height, before layout) falls back to the constant.
 */
export function growthBudget(available: number, resting: number): number {
  if (!(available > 0) || !(resting > 0)) return HEIGHT_GROWTH;

  return Math.max(1, available / resting);
}

/**
 * How far the grown map has to move to stay inside the space it was given.
 *
 * The map grows about its own centre, and that centre is not the centre of the
 * page's free space — the hint line below the map pushes it up. So a box grown
 * to the full budget would hang over the top of that space (in practice, into
 * the game banner) while leaving a gap at the bottom. This is the correction,
 * in the same pixels: positive moves it down.
 *
 * If the box is somehow taller than the space, it is centred in it rather than
 * pinned to one edge — an overflow that is symmetric reads as "this is as big
 * as it gets", where one pinned edge reads as a layout bug.
 */
export function growthShift(
  centre: number,
  height: number,
  top: number,
  bottom: number,
): number {
  if (height >= bottom - top) return (top + bottom) / 2 - centre;

  const over = top - (centre - height / 2);
  const under = centre + height / 2 - bottom;

  if (over > 0) return over;
  if (under > 0) return -under;

  return 0;
}

/** How long the spring back to a settled transform takes, in milliseconds. */
export const SETTLE_MS = 260;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export type Point = readonly [number, number];

/** Where a point on the map currently sits within the viewBox. */
export function apply(transform: ZoomTransform, [px, py]: Point): [number, number] {
  return [px * transform.k + transform.x, py * transform.k + transform.y];
}

/**
 * The height of the viewBox — and therefore of the rendered element, which is
 * `width: 100%; height: auto` — at a given scale. Clamped at the bottom so that
 * a gesture stretching below k=1 shrinks the map inside a box that stays put,
 * rather than shrinking the box with it and hiding the very overshoot the spring
 * back exists to show. Clamped at the top by the space the page has for it.
 */
export function viewBoxHeight(k: number, growth: number = HEIGHT_GROWTH): number {
  return HEIGHT * clamp(k, 1, Math.max(1, growth));
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
  { min = MIN_SCALE, max = MAX_SCALE }: { min?: number; max?: number } = {},
): ZoomTransform {
  const k = clamp(transform.k * factor, min, max);

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
 * Offset for one axis: keep the land covering the window, allowing `slack`
 * viewBox units of overshoot at each edge.
 *
 * When the land is *smaller* than the window — only reachable mid-gesture, past
 * the zoom-out floor — there is no legal offset, so it is centred instead.
 * Jamming it into a corner would make an over-zoom-out look like a failed drag.
 */
function clampAxis(
  offset: number,
  span: number,
  window: number,
  slack: number,
): number {
  if (span <= window) return (window - span) / 2;

  return clamp(offset, window - span - slack, slack);
}

/**
 * Keeps the map covering the viewBox, so it can never be dragged into open
 * space. At k=1 with no slack the only legal offset is 0, which also means a
 * stray one-finger drag on an unzoomed map does nothing at all rather than
 * nudging the world.
 */
export function clampToBounds(
  transform: ZoomTransform,
  slack = 0,
  growth: number = HEIGHT_GROWTH,
): ZoomTransform {
  const window = viewBoxHeight(transform.k, growth);

  return {
    k: transform.k,
    x: clampAxis(transform.x, WIDTH * transform.k, WIDTH, slack * WIDTH),
    y: clampAxis(transform.y, HEIGHT * transform.k, window, slack * window),
  };
}

/**
 * The transform a gesture in progress is allowed to reach: stretched past the
 * limits, but not unboundedly.
 */
export function stretch(
  transform: ZoomTransform,
  growth: number = HEIGHT_GROWTH,
): ZoomTransform {
  return clampToBounds(
    {
      ...transform,
      k: clamp(transform.k, MIN_SCALE / SCALE_RUBBER, MAX_SCALE * SCALE_RUBBER),
    },
    EDGE_SLACK,
    growth,
  );
}

/** The transform a released gesture springs back to. */
export function settle(
  transform: ZoomTransform,
  growth: number = HEIGHT_GROWTH,
): ZoomTransform {
  return clampToBounds(
    {
      ...transform,
      k: clamp(transform.k, MIN_SCALE, MAX_SCALE),
    },
    0,
    growth,
  );
}

/** True once a transform has settled anywhere other than at rest. */
export const isZoomed = (transform: ZoomTransform) => transform.k > MIN_SCALE;

/** Whether a transform is already where `settle` would put it. */
export function isSettled(
  transform: ZoomTransform,
  growth: number = HEIGHT_GROWTH,
): boolean {
  const target = settle(transform, growth);

  return (
    Math.abs(target.k - transform.k) < 1e-6 &&
    Math.abs(target.x - transform.x) < 1e-6 &&
    Math.abs(target.y - transform.y) < 1e-6
  );
}

export function lerp(
  from: ZoomTransform,
  to: ZoomTransform,
  t: number,
): ZoomTransform {
  const mix = (a: number, b: number) => a + (b - a) * t;

  return { k: mix(from.k, to.k), x: mix(from.x, to.x), y: mix(from.y, to.y) };
}

/** Decelerating ease for the spring back — fast off the mark, gentle arrival. */
export const easeOut = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 3;

/** Distance between two active touches — the raw input to a pinch. */
export function touchDistance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function midpoint(a: Point, b: Point): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
