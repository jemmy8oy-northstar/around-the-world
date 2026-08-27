import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import topology from "../data/world-110m.json";
import { findCountry } from "../countries/countries";
import {
  HEIGHT,
  IDENTITY,
  MAX_SCALE,
  MIN_SCALE,
  SCALE_RUBBER,
  SETTLE_MS,
  WIDTH,
  apply,
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
}: {
  badges: CountryBadge[];
  onSelect: (countryCode: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const live = useRef<ZoomTransform>(IDENTITY);
  const [transform, setTransform] = useState<ZoomTransform>(IDENTITY);

  const write = useCallback((next: ZoomTransform) => {
    live.current = next;
    setTransform(next);
  }, []);

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
      ((clientY - rect.top) / rect.height) * viewBoxHeight(live.current.k),
    ];
  }, []);

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

        write(stretch(panBy(zoomed, to[0] - from[0], to[1] - from[1])));
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

      if (!isSettled(live.current)) springTo(settle(live.current));
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

  const boxHeight = viewBoxHeight(transform.k);

  return (
    <div className="worldmap-zoom">
      <svg
        ref={svgRef}
        className="worldmap"
        viewBox={`0 0 ${WIDTH} ${boxHeight}`}
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
          onClick={reset}
        >
          Reset map
        </button>
      )}
    </div>
  );
}
