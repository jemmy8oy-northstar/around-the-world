import { describe, expect, it } from "vitest";
import {
  EDGE_SLACK,
  HEIGHT,
  HEIGHT_GROWTH,
  IDENTITY,
  MAX_SCALE,
  MIN_SCALE,
  SCALE_RUBBER,
  WIDTH,
  apply,
  clampToBounds,
  easeOut,
  isSettled,
  isZoomed,
  lerp,
  midpoint,
  panBy,
  settle,
  stretch,
  touchDistance,
  viewBoxHeight,
  zoomAbout,
} from "../mapZoom";

describe("zoomAbout", () => {
  it("leaves the point under the fingers where it was", () => {
    const focus = [300, 150] as const;
    const zoomed = zoomAbout(IDENTITY, 2.5, focus);

    // The map point that was under `focus` must still be under it, or a pinch
    // drifts away from whatever you were pinching at.
    const mapPoint = [
      (focus[0] - IDENTITY.x) / IDENTITY.k,
      (focus[1] - IDENTITY.y) / IDENTITY.k,
    ] as const;

    const [x, y] = apply(zoomed, mapPoint);

    expect(x).toBeCloseTo(focus[0], 6);
    expect(y).toBeCloseTo(focus[1], 6);
  });

  it("still holds the focus after a second, compounding pinch", () => {
    const focus = [120, 300] as const;
    const once = zoomAbout(IDENTITY, 1.8, focus);
    const twice = zoomAbout(once, 1.4, focus);

    expect(twice.k).toBeCloseTo(1.8 * 1.4, 6);

    const mapPoint = [(focus[0] - once.x) / once.k, (focus[1] - once.y) / once.k] as const;
    const [x, y] = apply(twice, mapPoint);

    expect(x).toBeCloseTo(focus[0], 6);
    expect(y).toBeCloseTo(focus[1], 6);
  });

  it("compounds thirty small steps into the whole gesture", () => {
    // The shape of James's #45 complaint, in arithmetic: a finger delivers a
    // pinch as a stream of small ratios, and every one has to survive. The
    // component used to feed each step the scale from the last RENDER rather
    // than the last step, so all but the final increment were dropped and a 4x
    // spread arrived as 1.05x. The maths was never wrong; the plumbing was.
    const steps = 30;
    let transform = IDENTITY;

    for (let step = 0; step < steps; step += 1) {
      transform = zoomAbout(transform, 4 ** (1 / steps), [400, 190]);
    }

    expect(transform.k).toBeCloseTo(4, 6);
  });

  it("refuses to zoom out past the fitted map", () => {
    expect(zoomAbout(IDENTITY, 0.2, [400, 190]).k).toBe(MIN_SCALE);
  });

  it("stops at the maximum scale", () => {
    expect(zoomAbout({ k: 6, x: -100, y: -50 }, 4, [400, 190]).k).toBe(MAX_SCALE);
  });

  it("does not slide the map when the scale is clamped", () => {
    // The bug this pins: using the requested factor rather than the applied one
    // translates the map while refusing to scale it, so a pinch at the limit
    // drags the world sideways.
    const atFloor = zoomAbout(IDENTITY, 0.5, [700, 40]);

    expect(atFloor).toEqual(IDENTITY);
  });

  it("stretches past both limits when a gesture asks it to", () => {
    const limits = {
      min: MIN_SCALE / SCALE_RUBBER,
      max: MAX_SCALE * SCALE_RUBBER,
    };

    expect(zoomAbout(IDENTITY, 0.1, [400, 190], limits).k).toBeCloseTo(
      MIN_SCALE / SCALE_RUBBER,
      6,
    );
    expect(zoomAbout({ k: 10, x: 0, y: 0 }, 5, [400, 190], limits).k).toBeCloseTo(
      MAX_SCALE * SCALE_RUBBER,
      6,
    );
  });
});

describe("viewBoxHeight", () => {
  it("is the map's own height at rest", () => {
    expect(viewBoxHeight(1)).toBe(HEIGHT);
  });

  it("grows with the zoom, then stops", () => {
    expect(viewBoxHeight(1.4)).toBeCloseTo(HEIGHT * 1.4, 6);
    expect(viewBoxHeight(HEIGHT_GROWTH)).toBeCloseTo(HEIGHT * HEIGHT_GROWTH, 6);
    expect(viewBoxHeight(MAX_SCALE)).toBeCloseTo(HEIGHT * HEIGHT_GROWTH, 6);
  });

  it("never grows the box past the land that has to cover it", () => {
    // The invariant the whole feature rests on, and it holds exactly where the
    // map is allowed to come to rest. If the box were ever taller than
    // HEIGHT * k, no offset could cover it and a gutter would open at the top
    // or bottom — a band of page showing through the world.
    for (let k = MIN_SCALE; k <= MAX_SCALE * SCALE_RUBBER; k += 0.05) {
      expect(viewBoxHeight(k)).toBeLessThanOrEqual(HEIGHT * k + 1e-9);
    }
  });

  it("holds still below the floor so an overshoot is visible", () => {
    // Below k=1 the box deliberately does NOT follow the map down: the land is
    // smaller than the window and a gutter opens on purpose, because that gap
    // IS the overshoot the spring back exists to show. Shrinking the box with
    // it would make an over-zoom-out look like nothing happening at all.
    expect(viewBoxHeight(0.8)).toBe(HEIGHT);
    expect(viewBoxHeight(0.8)).toBeGreaterThan(HEIGHT * 0.8);

    // And that is the one case clampAxis centres rather than clamps, so the
    // shrunken world sits in the middle of the gap rather than in a corner.
    expect(clampToBounds({ k: 0.8, x: -999, y: -999 }).y).toBeCloseTo(
      (HEIGHT - HEIGHT * 0.8) / 2,
      6,
    );
  });

  it("only ever gets taller as the map is zoomed in", () => {
    let previous = 0;

    for (let k = MIN_SCALE; k <= MAX_SCALE; k += 0.05) {
      const height = viewBoxHeight(k);

      expect(height).toBeGreaterThanOrEqual(previous);
      previous = height;
    }
  });
});

describe("clampToBounds", () => {
  it("pins an unzoomed map exactly in place", () => {
    expect(clampToBounds(panBy(IDENTITY, 120, -60))).toEqual(IDENTITY);
  });

  it("never lets empty space appear on the left or top", () => {
    const clamped = clampToBounds({ k: 3, x: 250, y: 90 });

    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0);
  });

  it("never lets empty space appear on the right or bottom", () => {
    const clamped = clampToBounds({ k: 2, x: -5000, y: -5000 });

    expect(clamped.x).toBe(WIDTH * (1 - 2));

    // Vertically the window is the GROWN box, not the map's resting height —
    // measuring this against HEIGHT would let the world ride up off the bottom.
    expect(clamped.y).toBe(viewBoxHeight(2) - HEIGHT * 2);
  });

  it("leaves a legal offset untouched", () => {
    const legal = { k: 2, x: -400, y: -40 };

    expect(clampToBounds(legal)).toEqual(legal);
  });

  it("allows a gesture to drag past the edge by its slack", () => {
    const dragged = clampToBounds({ k: 2, x: 5000, y: 5000 }, EDGE_SLACK);

    expect(dragged.x).toBeCloseTo(EDGE_SLACK * WIDTH, 6);
    expect(dragged.y).toBeCloseTo(EDGE_SLACK * viewBoxHeight(2), 6);
  });

  it("centres a map that has been shrunk smaller than its window", () => {
    // Only reachable mid-gesture, past the zoom-out floor. Jamming it into a
    // corner would read as a failed drag rather than as an overshoot.
    const shrunk = clampToBounds({ k: 0.5, x: -300, y: -300 });

    expect(shrunk.x).toBeCloseTo((WIDTH - WIDTH * 0.5) / 2, 6);
    expect(shrunk.y).toBeCloseTo((HEIGHT - HEIGHT * 0.5) / 2, 6);
  });
});

describe("stretch and settle", () => {
  it("lets a live gesture past the limits", () => {
    expect(stretch({ k: 0.4, x: 0, y: 0 }).k).toBeCloseTo(
      MIN_SCALE / SCALE_RUBBER,
      6,
    );
    expect(stretch({ k: 40, x: 0, y: 0 }).k).toBeCloseTo(
      MAX_SCALE * SCALE_RUBBER,
      6,
    );
  });

  it("brings a released gesture back inside them", () => {
    expect(settle({ k: 0.4, x: 0, y: 0 })).toEqual(IDENTITY);
    expect(settle({ k: 40, x: 0, y: 0 }).k).toBe(MAX_SCALE);
  });

  it("pulls an over-dragged map back against its edge", () => {
    const overshot = stretch({ k: 3, x: 500, y: 500 });

    expect(overshot.x).toBeGreaterThan(0);
    expect(settle(overshot).x).toBe(0);
    expect(settle(overshot).y).toBe(0);
  });

  it("recognises a transform that has nowhere to spring to", () => {
    expect(isSettled(IDENTITY)).toBe(true);
    expect(isSettled({ k: 2, x: -400, y: -40 })).toBe(true);

    expect(isSettled({ k: 0.8, x: 0, y: 0 })).toBe(false);
    expect(isSettled({ k: 20, x: 0, y: 0 })).toBe(false);
    expect(isSettled({ k: 3, x: 200, y: 0 })).toBe(false);
  });

  it("settles anything stretch can produce, in one step", () => {
    // Belt and braces on the pair: whatever a gesture reaches, one settle has
    // to land somewhere isSettled agrees with, or the spring back would leave
    // the map somewhere it is still not allowed to be.
    for (const k of [0.5, 0.9, 1, 1.5, 5, 12, 16, 40]) {
      for (const offset of [-9000, -300, 0, 300, 9000]) {
        expect(isSettled(settle(stretch({ k, x: offset, y: offset })))).toBe(true);
      }
    }
  });
});

describe("the spring back", () => {
  it("interpolates every part of the transform", () => {
    const from = { k: 1, x: 0, y: 0 };
    const to = { k: 3, x: -200, y: -100 };

    expect(lerp(from, to, 0)).toEqual(from);
    expect(lerp(from, to, 1)).toEqual(to);
    expect(lerp(from, to, 0.5)).toEqual({ k: 2, x: -100, y: -50 });
  });

  it("eases out, and never overshoots its own ends", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);

    // Past the end of the animation it stays pinned, so a dropped frame lands
    // exactly on the target rather than past it.
    expect(easeOut(1.7)).toBe(1);
    expect(easeOut(-0.3)).toBe(0);

    // Decelerating: more than half the distance is covered in half the time.
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });
});

describe("apply", () => {
  it("is the identity at rest", () => {
    expect(apply(IDENTITY, [123, 45])).toEqual([123, 45]);
  });

  it("scales then translates", () => {
    expect(apply({ k: 2, x: -100, y: -50 }, [200, 100])).toEqual([300, 150]);
  });
});

describe("gesture helpers", () => {
  it("measures the distance between two touches", () => {
    expect(touchDistance([0, 0], [3, 4])).toBe(5);
  });

  it("finds the point between two touches", () => {
    expect(midpoint([10, 20], [30, 60])).toEqual([20, 40]);
  });

  it("knows when the map is at rest", () => {
    expect(isZoomed(IDENTITY)).toBe(false);
    expect(isZoomed({ k: 1.01, x: 0, y: 0 })).toBe(true);
  });
});
