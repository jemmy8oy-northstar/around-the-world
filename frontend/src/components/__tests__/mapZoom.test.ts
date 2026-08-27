import { describe, expect, it } from "vitest";
import {
  IDENTITY,
  MAX_SCALE,
  MIN_SCALE,
  apply,
  clampToBounds,
  isZoomed,
  midpoint,
  panBy,
  touchDistance,
  zoomAbout,
} from "../mapZoom";

const WIDTH = 800;
const HEIGHT = 380;

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
});

describe("clampToBounds", () => {
  it("pins an unzoomed map exactly in place", () => {
    const nudged = panBy(IDENTITY, 120, -60);

    expect(clampToBounds(nudged, WIDTH, HEIGHT)).toEqual(IDENTITY);
  });

  it("never lets empty space appear on the left or top", () => {
    const clamped = clampToBounds({ k: 3, x: 250, y: 90 }, WIDTH, HEIGHT);

    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0);
  });

  it("never lets empty space appear on the right or bottom", () => {
    const clamped = clampToBounds({ k: 2, x: -5000, y: -5000 }, WIDTH, HEIGHT);

    expect(clamped.x).toBe(WIDTH * (1 - 2));
    expect(clamped.y).toBe(HEIGHT * (1 - 2));
  });

  it("leaves a legal offset untouched", () => {
    const legal = { k: 2, x: -400, y: -190 };

    expect(clampToBounds(legal, WIDTH, HEIGHT)).toEqual(legal);
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
