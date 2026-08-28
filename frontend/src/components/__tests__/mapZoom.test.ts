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
  growthBudget,
  growthShift,
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

/**
 * Measured on an iPhone 13 (390x844) against the real page, not assumed: the
 * map's resting footprint is 177.64 CSS px inside 472 px of free page between
 * the game banner and the tab bar, and the resting map's middle sits 216.8 px
 * down that space — above its middle, because the hint line below the map
 * shares the space with it. Every number in this block comes from that
 * measurement; they are what makes these tests about James's phone rather than
 * about arithmetic.
 */
const PHONE = { available: 472, resting: 177.64, centre: 216.8 };

describe("growthBudget", () => {
  it("is the room the page actually has, not a guess", () => {
    expect(growthBudget(PHONE.available, PHONE.resting)).toBeCloseTo(2.657, 3);
  });

  it("gives James's phone a third more map than the fixed multiple did", () => {
    // The defect he reported on #52 — "map still more cropped than it needs to
    // be". HEIGHT_GROWTH was picked by eye, and on his phone it stopped the box
    // growing at 1.8x with 152px of page still empty, cropping the world
    // instead of using the space. This is the assertion that goes red if
    // anyone puts the constant back.
    const budget = growthBudget(PHONE.available, PHONE.resting);
    const drawn = (growth: number) => PHONE.resting * growth;

    expect(drawn(budget)).toBeCloseTo(PHONE.available, 6);
    expect(drawn(HEIGHT_GROWTH)).toBeCloseTo(319.75, 2);
    expect(drawn(budget) - drawn(HEIGHT_GROWTH)).toBeGreaterThan(150);
  });

  it("never shrinks a map that does not fit", () => {
    // At k=1 the whole world is on screen, so a page too short for the resting
    // map must leave it alone: shrinking the box below its own height is the
    // one move that crops the world at rest, which is worse than overflowing.
    expect(growthBudget(120, PHONE.resting)).toBe(1);
    expect(growthBudget(PHONE.resting, PHONE.resting)).toBe(1);
  });

  it("falls back to the constant when there is nothing to measure", () => {
    // Before layout both boxes are zero. Treating that as "no room" would pin
    // the map to k=1 on the first frame and undo the growth entirely.
    expect(growthBudget(0, 0)).toBe(HEIGHT_GROWTH);
    expect(growthBudget(0, PHONE.resting)).toBe(HEIGHT_GROWTH);
    expect(growthBudget(PHONE.available, 0)).toBe(HEIGHT_GROWTH);
    expect(growthBudget(Number.NaN, PHONE.resting)).toBe(HEIGHT_GROWTH);
  });
});

describe("growthShift", () => {
  it("puts a fully grown map exactly inside the space it was given", () => {
    // The measured case: at the full budget the box is the height of the space,
    // so it has to move down by the gap between its own centre and the space's.
    // Without this the map grows about a centre 19px above the middle and
    // overhangs the game banner while leaving a gap at the tab bar.
    const shift = growthShift(PHONE.centre, PHONE.available, 0, PHONE.available);

    expect(shift).toBeCloseTo(19.2, 1);
    expect(PHONE.centre + shift - PHONE.available / 2).toBeCloseTo(0, 6);
  });

  it("leaves a map that already fits where it is", () => {
    // Mid-gesture the box is smaller than the space and still inside it. Moving
    // it then would slide the map under the fingers.
    expect(growthShift(PHONE.centre, PHONE.resting, 0, PHONE.available)).toBe(0);
    expect(growthShift(PHONE.centre, 300, 0, PHONE.available)).toBe(0);
  });

  it("pushes back in from whichever edge it has run out of room at", () => {
    // Growing about its own centre, the top edge runs out first here; a map
    // whose centre sat low would run out at the bottom, and the correction has
    // to point the other way.
    expect(growthShift(100, 260, 0, 472)).toBe(30);
    expect(growthShift(400, 260, 0, 472)).toBe(-58);
  });

  it("centres a box too tall for the space rather than pinning an edge", () => {
    const shift = growthShift(PHONE.centre, 600, 0, PHONE.available);

    expect(PHONE.centre + shift - 300).toBeCloseTo(
      PHONE.available / 2 - 300,
      6,
    );
  });
});

describe("viewBoxHeight with a measured budget", () => {
  it("grows to the budget instead of the constant", () => {
    const budget = growthBudget(PHONE.available, PHONE.resting);

    expect(viewBoxHeight(MAX_SCALE, budget)).toBeCloseTo(HEIGHT * budget, 6);
    expect(viewBoxHeight(MAX_SCALE, budget)).toBeGreaterThan(
      viewBoxHeight(MAX_SCALE),
    );
  });

  it("keeps the no-gutter invariant at any budget", () => {
    // The invariant the feature rests on, re-checked now that the ceiling is a
    // runtime number rather than a constant someone reviewed once: the box is
    // never taller than the land at that scale, so no offset can open a band of
    // empty page inside the map.
    for (const growth of [1, 1.8, 2.657, 4, 40]) {
      for (let k = MIN_SCALE; k <= MAX_SCALE * SCALE_RUBBER; k += 0.05) {
        expect(viewBoxHeight(k, growth)).toBeLessThanOrEqual(HEIGHT * k + 1e-9);
      }
    }
  });

  it("refuses a budget that would shrink the box below the map", () => {
    // growthBudget already floors at 1, but viewBoxHeight is called with a ref
    // that starts life elsewhere, so it floors too. A budget under 1 here would
    // crop the world at rest.
    expect(viewBoxHeight(1, 0.5)).toBe(HEIGHT);
    expect(viewBoxHeight(3, 0.5)).toBe(HEIGHT);
  });

  it("carries the budget through the clamps that use it", () => {
    // stretch/settle/clampToBounds all size their window from viewBoxHeight, so
    // a budget that stopped at the top of the call chain would leave the map
    // drawn tall and clamped short — the land sliding inside its own box.
    const budget = growthBudget(PHONE.available, PHONE.resting);
    const window = viewBoxHeight(2.4, budget);

    expect(clampToBounds({ k: 2.4, x: 0, y: -9999 }, 0, budget).y).toBeCloseTo(
      window - HEIGHT * 2.4,
      6,
    );
    expect(settle({ k: 2.4, x: 0, y: -9999 }, budget).y).toBeCloseTo(
      window - HEIGHT * 2.4,
      6,
    );
    expect(isSettled(settle({ k: 2.4, x: 0, y: -9999 }, budget), budget)).toBe(
      true,
    );
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
