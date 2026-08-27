import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import topology from "../data/world-110m.json";
import { findCountry } from "../countries/countries";
import {
  IDENTITY,
  apply,
  clampToBounds,
  isZoomed,
  midpoint,
  panBy,
  touchDistance,
  zoomAbout,
  type Point,
  type ZoomTransform,
} from "./mapZoom";
import "./WorldMapSvg.css";

const WIDTH = 800;
const HEIGHT = 380;

/** ISO 3166-1 numeric for Antarctica. */
const ANTARCTICA = "010";

/**
 * A finger that moves further than this between down and up was panning, not
 * tapping. Without it, dragging the map open happens to release over a badge and
 * navigates away from the country you were trying to look at.
 */
const TAP_SLOP = 6;

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
 */
export function WorldMapSvg({
  badges,
  onSelect,
}: {
  badges: CountryBadge[];
  onSelect: (countryCode: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<ZoomTransform>(IDENTITY);

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
   * Client pixels to viewBox units. The SVG is `width: 100%; height: auto` over
   * a viewBox of the same aspect ratio, so one ratio covers both axes — but it
   * is read from the live rect rather than assumed, because the page is
   * responsive and the two would silently disagree at some width otherwise.
   */
  const toViewBox = useCallback((clientX: number, clientY: number): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return [0, 0];

    return [
      ((clientX - rect.left) / rect.width) * WIDTH,
      ((clientY - rect.top) / rect.height) * HEIGHT,
    ];
  }, []);

  const settle = useCallback(
    (next: ZoomTransform) => setTransform(clampToBounds(next, WIDTH, HEIGHT)),
    [],
  );

  const reset = useCallback(() => setTransform(IDENTITY), []);

  // Gesture bookkeeping. Refs rather than state: these change on every frame of
  // a drag and none of them should cause a render on their own.
  const pinchDistance = useRef<number | null>(null);
  const lastPan = useRef<Point | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const touchPoint = (touch: Touch): Point => [touch.clientX, touch.clientY];

    const onWheel = (event: WheelEvent) => {
      // Desktop and trackpad equivalent of a pinch. Also the only form of this
      // gesture a test can drive reliably, which is why the e2e spec uses it.
      event.preventDefault();

      settle(
        zoomAbout(
          transform,
          Math.exp(-event.deltaY * 0.002),
          toViewBox(event.clientX, event.clientY),
        ),
      );
    };

    const onTouchStart = (event: TouchEvent) => {
      dragged.current = false;

      if (event.touches.length === 2) {
        pinchDistance.current = touchDistance(
          touchPoint(event.touches[0]),
          touchPoint(event.touches[1]),
        );
        lastPan.current = null;
        return;
      }

      if (event.touches.length === 1) {
        pinchDistance.current = null;
        lastPan.current = touchPoint(event.touches[0]);
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        const a = touchPoint(event.touches[0]);
        const b = touchPoint(event.touches[1]);
        const distance = touchDistance(a, b);
        const previous = pinchDistance.current;

        pinchDistance.current = distance;
        dragged.current = true;

        if (previous === null || previous === 0) return;

        event.preventDefault();

        const [midX, midY] = midpoint(a, b);
        settle(
          zoomAbout(transform, distance / previous, toViewBox(midX, midY)),
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
        if (!isZoomed(transform)) return;

        event.preventDefault();

        const rect = svg.getBoundingClientRect();
        const ratio = rect.width === 0 ? 0 : WIDTH / rect.width;

        lastPan.current = [clientX, clientY];
        settle(panBy(transform, (clientX - lastX) * ratio, (clientY - lastY) * ratio));
      }
    };

    const onTouchEnd = () => {
      pinchDistance.current = null;
      lastPan.current = null;
    };

    // Non-passive on purpose: preventDefault is what stops iOS Safari zooming
    // the whole page instead, and a listener added through React's props would
    // be registered passive.
    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("touchstart", onTouchStart, { passive: false });
    svg.addEventListener("touchmove", onTouchMove, { passive: false });
    svg.addEventListener("touchend", onTouchEnd);
    svg.addEventListener("touchcancel", onTouchEnd);

    return () => {
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("touchstart", onTouchStart);
      svg.removeEventListener("touchmove", onTouchMove);
      svg.removeEventListener("touchend", onTouchEnd);
      svg.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [settle, toViewBox, transform]);

  const select = (countryCode: string) => {
    // Swallow the click that ends a drag; a pan should never navigate.
    if (dragged.current) {
      dragged.current = false;
      return;
    }

    onSelect(countryCode);
  };

  return (
    <div className="worldmap-zoom">
      <svg
        ref={svgRef}
        className="worldmap"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
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
