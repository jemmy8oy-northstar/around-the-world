import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import topology from "../data/world-110m.json";
import { findCountry } from "../countries/countries";
import {
  HEIGHT,
  HEIGHT_GROWTH,
  IDENTITY,
  MAX_SCALE,
  MIN_SCALE,
  SCALE_RUBBER,
  SETTLE_MS,
  WIDTH,
  apply,
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
  type Point,
  type ZoomTransform,
} from "./mapZoom";
import "./WorldMapSvg.css";

/** ISO 3166-1 numeric for Antarctica. */
const ANTARCTICA = "010";

/**
 * A finger that moves further than this between down and up was panning, not
 * tapping. Without it, dragging the map open happens to release over a badge and
 * navigates away from the country you were trying to look at.
 */
const TAP_SLOP = 6;

/** The scale limits a gesture in progress may stretch to before springing back. */
const LIVE_LIMITS = {
  min: MIN_SCALE / SCALE_RUBBER,
  max: MAX_SCALE * SCALE_RUBBER,
};

export interface CountryBadge {
  countryCode: string;
  count: number;
}

/**
 * The world drawn straight from TopoJSON with d3-geo, rather than through
 * react-simple-maps — that library is a thin wrapper over exactly these two
 * packages and its React 19 support currently routes through a community fork.
 *
 * Natural Earth 1 rather than Mercator: Mercator devotes most of a short, wide
 * mobile viewport to Greenland and Antarctica, and badly distorts the relative
 * position of anywhere anyone actually drinks.
 *
 * Pinch zooms the land but NOT the badges: they are positioned by the same
 * transform and then drawn at a fixed radius, so zooming spreads a crowded
 * cluster apart without inflating it. Scaling them too would magnify the
 * overlap along with everything else and fix nothing.
 *
 * The live transform lives in a ref, not in state, and that is load-bearing
 * rather than an optimisation. A pinch arrives as ~30 touchmoves, each carrying
 * a small ratio that has to compose with the last; reading the scale back from
 * React state meant every move that landed before the next render recomputed
 * from a value that had not caught up, and its increment was discarded. A 4x
 * spread arrived as 1.05x — James's "it becomes harder and harder to zoom" on
 * #45. The ref is the source of truth; state exists only to render it.
 */
export function WorldMapSvg({
  badges,
  onSelect,
  bounds,
}: {
  badges: CountryBadge[];
  onSelect: (countryCode: string) => void;
  /**
   * The element whose height the map is allowed to grow into. Without it the
   * map falls back to the fixed HEIGHT_GROWTH multiple, which is a guess — and
   * a guess that stopped a third of the way down James's phone (#52).
   */
  bounds?: RefObject<HTMLElement | null>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const footprintRef = useRef<HTMLDivElement>(null);
  const live = useRef<ZoomTransform>(IDENTITY);
  const [transform, setTransform] = useState<ZoomTransform>(IDENTITY);

  const write = useCallback((next: ZoomTransform) => {
    live.current = next;
    setTransform(next);
  }, []);

  /**
   * The page's real geometry, in CSS pixels, remeasured whenever it changes —
   * an orientation flip halves it, and the number is a property of the device,
   * not of the app. `centre` is where the resting map's middle sits inside the
   * space, which is above its middle because the hint line below the map
   * shares the page with it.
   */
  const [space, setSpace] = useState({ available: 0, resting: 0, centre: 0 });
  const growth = useRef(HEIGHT_GROWTH);

  useEffect(() => {
    const footprint = footprintRef.current;
    const container = bounds?.current;
    if (!footprint) return;

    const measure = () => {
      const box = footprint.getBoundingClientRect();
      const outer = container?.getBoundingClientRect();

      const next = {
        available: outer?.height ?? 0,
        resting: box.height,
        centre: outer ? box.top + box.height / 2 - outer.top : 0,
      };

      setSpace((current) =>
        current.available === next.available &&
        current.resting === next.resting &&
        current.centre === next.centre
          ? current
          : next,
      );
    };

    measure();

    // The map is absolutely positioned, so growing it cannot change either box
    // — no feedback loop. Both are observed because the footprint's width (and
    // so its height) and the page's height change independently.
    const observer = new ResizeObserver(measure);
    observer.observe(footprint);
    if (container) observer.observe(container);

    return () => observer.disconnect();
  }, [bounds]);

  growth.current = growthBudget(space.available, space.resting);

  const { landPaths, projection } = useMemo(() => {
    const topo = topology as unknown as Topology;
    const all = feature(
      topo,
      topo.objects.countries,
    ) as FeatureCollection<Geometry>;

    // Antarctica is a seventh of the map's height, is never a drink's origin, and
    // dragging it out lets the inhabited world render meaningfully larger.
    const collection: FeatureCollection<Geometry> = {
      ...all,
      features: all.features.filter((f) => String(f.id) !== ANTARCTICA),
    };

    const proj = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], collection);
    const path = geoPath(proj);

    return {
      landPaths: collection.features
        .map((f) => path(f))
        .filter((d): d is string => d !== null),
      projection: proj,
    };
  }, []);

  const placed = badges
    .map((badge) => {
      const country = findCountry(badge.countryCode);
      if (!country) return null;

      const point = projection([country.longitude, country.latitude]);
      if (!point) return null;

      return { ...badge, x: point[0], y: point[1] };
    })
    .filter((b): b is CountryBadge & { x: number; y: number } => b !== null)
    // Draw the busiest countries last so their badge sits on top when two
    // neighbours overlap.
    .sort((a, b) => a.count - b.count);

  /**
   * Client pixels to viewBox units. Both axes are read from the live rect rather
   * than assumed: the viewBox is not a fixed shape any more — it grows taller as
   * the map is zoomed — so a single ratio would be wrong on one axis or the
   * other for most of a gesture.
   */
  const toViewBox = useCallback((clientX: number, clientY: number): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return [0, 0];

    return [
      ((clientX - rect.left) / rect.width) * WIDTH,
      ((clientY - rect.top) / rect.height) *
        viewBoxHeight(live.current.k, growth.current),
    ];
  }, []);

  // The space can change under a zoomed map — an orientation flip is the
  // ordinary case. Re-settling keeps the land covering the box; without it a
  // rotation can leave the old offset showing a band of empty page.
  useEffect(() => {
    if (isZoomed(live.current)) write(settle(live.current, growth.current));
  }, [space, write]);

  // Spring back to a settled transform when a gesture lets go past the limits.
  const frame = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const springTo = useCallback(
    (target: ZoomTransform) => {
      stop();

      const from = live.current;
      const start = performance.now();

      const step = (now: number) => {
        const progress = (now - start) / SETTLE_MS;

        write(lerp(from, target, easeOut(progress)));
        frame.current = progress < 1 ? requestAnimationFrame(step) : null;
      };

      frame.current = requestAnimationFrame(step);
    },
    [stop, write],
  );

  const reset = useCallback(() => springTo(IDENTITY), [springTo]);

  // Gesture bookkeeping. Refs rather than state: these change on every frame of
  // a drag and none of them should cause a render on their own.
  const pinch = useRef<{ distance: number; mid: Point } | null>(null);
  const lastPan = useRef<Point | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const touchPoint = (touch: Touch): Point => [touch.clientX, touch.clientY];

    const onWheel = (event: WheelEvent) => {
      // Desktop and trackpad equivalent of a pinch. No rubber band here: a
      // wheel has no release to spring back from, and a mouse has no
      // expectation of one.
      event.preventDefault();

      write(
        settle(
          zoomAbout(
            live.current,
            Math.exp(-event.deltaY * 0.002),
            toViewBox(event.clientX, event.clientY),
          ),
          growth.current,
        ),
      );
    };

    const onTouchStart = (event: TouchEvent) => {
      // Catching the map mid-spring should grab it where it is, not fight the
      // animation for the next quarter second.
      stop();
      dragged.current = false;

      if (event.touches.length >= 2) {
        const a = touchPoint(event.touches[0]);
        const b = touchPoint(event.touches[1]);

        pinch.current = { distance: touchDistance(a, b), mid: midpoint(a, b) };
        lastPan.current = null;
        return;
      }

      if (event.touches.length === 1) {
        pinch.current = null;
        lastPan.current = touchPoint(event.touches[0]);
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        const a = touchPoint(event.touches[0]);
        const b = touchPoint(event.touches[1]);
        const distance = touchDistance(a, b);
        const mid = midpoint(a, b);
        const previous = pinch.current;

        pinch.current = { distance, mid };
        dragged.current = true;

        if (previous === null || previous.distance === 0) return;

        event.preventDefault();

        // Zoom about where the fingers WERE, then carry that point to where
        // they ARE. Doing only the first half is what made the map feel like it
        // was correcting against the hand — James's "when ur fingers move
        // slightly during the zoom it isn't having to fix directly". A pinch
        // that drifts is a pinch and a pan at once, and this is both.
        const from = toViewBox(previous.mid[0], previous.mid[1]);
        const zoomed = zoomAbout(
          live.current,
          distance / previous.distance,
          from,
          LIVE_LIMITS,
        );
        const to = toViewBox(mid[0], mid[1]);

        write(
          stretch(
            panBy(zoomed, to[0] - from[0], to[1] - from[1]),
            growth.current,
          ),
        );
        return;
      }

      if (event.touches.length === 1 && lastPan.current) {
        const [lastX, lastY] = lastPan.current;
        const { clientX, clientY } = event.touches[0];

        if (Math.hypot(clientX - lastX, clientY - lastY) > TAP_SLOP) {
          dragged.current = true;
        }

        // An unzoomed map has nowhere to pan to, so let the page scroll instead
        // of swallowing the gesture.
        if (!isZoomed(live.current)) return;

        event.preventDefault();

        const rect = svg.getBoundingClientRect();
        const ratio = rect.width === 0 ? 0 : WIDTH / rect.width;

        lastPan.current = [clientX, clientY];
        write(
          stretch(
            panBy(
              live.current,
              (clientX - lastX) * ratio,
              (clientY - lastY) * ratio,
            ),
            growth.current,
          ),
        );
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        // One finger lifted out of a pinch. Hand the gesture over to the finger
        // still down rather than ending it — otherwise a two-finger zoom that
        // relaxes into a one-finger drag dies silently halfway through.
        pinch.current = null;
        lastPan.current = touchPoint(event.touches[0]);
        return;
      }

      pinch.current = null;
      lastPan.current = null;

      if (!isSettled(live.current, growth.current))
        springTo(settle(live.current, growth.current));
    };

    // Non-passive on purpose: preventDefault is what stops iOS Safari zooming
    // the whole page instead, and a listener added through React's props would
    // be registered passive.
    //
    // Registered once, for the life of the component: every handler reads the
    // transform from a ref, so nothing here depends on a render. They used to
    // be torn down and rebuilt on every frame of a gesture.
    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("touchstart", onTouchStart, { passive: false });
    svg.addEventListener("touchmove", onTouchMove, { passive: false });
    svg.addEventListener("touchend", onTouchEnd);
    svg.addEventListener("touchcancel", onTouchEnd);

    return () => {
      stop();
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("touchstart", onTouchStart);
      svg.removeEventListener("touchmove", onTouchMove);
      svg.removeEventListener("touchend", onTouchEnd);
      svg.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [springTo, stop, toViewBox, write]);

  const select = (countryCode: string) => {
    // Swallow the click that ends a drag; a pan should never navigate.
    if (dragged.current) {
      dragged.current = false;
      return;
    }

    onSelect(countryCode);
  };

  const boxHeight = viewBoxHeight(transform.k, growth.current);

  /**
   * Where the grown box has to sit to stay inside the space, in CSS pixels.
   * Derived from numbers measured once per layout rather than from a fresh
   * getBoundingClientRect, because this is recomputed on every frame of a
   * gesture and reading layout there would be both slow and a render late.
   */
  const measured = space.available > 0 && space.resting > 0;
  const drawnHeight = space.resting * (boxHeight / HEIGHT);
  const shift = measured
    ? growthShift(space.centre, drawnHeight, 0, space.available)
    : 0;

  return (
    <div className="worldmap-zoom" ref={footprintRef}>
      <svg
        ref={svgRef}
        className="worldmap"
        viewBox={`0 0 ${WIDTH} ${boxHeight}`}
        style={
          measured
            ? { translate: `0 calc(-50% + ${shift.toFixed(2)}px)` }
            : undefined
        }
        role="img"
        aria-label="World map of drinks by country"
        data-scale={transform.k.toFixed(3)}
      >
        <g
          className="worldmap__land"
          transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}
        >
          {landPaths.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </g>

        {placed.map((badge) => {
          const [x, y] = apply(transform, [badge.x, badge.y]);

          return (
            <g
              key={badge.countryCode}
              className="worldmap__badge"
              // Positioned by the transform but never scaled by it — this is
              // what keeps a badge the same size at every zoom level.
              transform={`translate(${x}, ${y})`}
              onClick={() => select(badge.countryCode)}
              role="button"
              tabIndex={0}
              aria-label={`${badge.count} from ${badge.countryCode}`}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ")
                  select(badge.countryCode);
              }}
            >
              {/* Invisible, larger than the badge: a 13px circle is not a tap target. */}
              <circle className="worldmap__hit" r={18} />
              <circle className="worldmap__badge-circle" r={13} />
              <text className="worldmap__badge-text" dy="0.35em">
                {badge.count}
              </text>
            </g>
          );
        })}
      </svg>

      {isZoomed(transform) && (
        <button
          type="button"
          className="worldmap__reset"
          // Rides the top edge of the map as it grows, rather than the top edge
          // of the footprint the map has long since outgrown — which is how it
          // ends up floating in the middle of the Atlantic.
          style={
            measured
              ? {
                  insetBlockStart: "50%",
                  translate: `0 calc(${(shift - drawnHeight / 2).toFixed(2)}px + var(--space-2))`,
                }
              : undefined
          }
          onClick={reset}
        >
          Reset map
        </button>
      )}
    </div>
  );
}
