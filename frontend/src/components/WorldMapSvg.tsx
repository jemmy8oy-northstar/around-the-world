import { useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import topology from "../data/world-110m.json";
import { findCountry } from "../countries/countries";
import "./WorldMapSvg.css";

const WIDTH = 800;
const HEIGHT = 380;

/** ISO 3166-1 numeric for Antarctica. */
const ANTARCTICA = "010";

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
 */
export function WorldMapSvg({
  badges,
  onSelect,
}: {
  badges: CountryBadge[];
  onSelect: (countryCode: string) => void;
}) {
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

  return (
    <svg
      className="worldmap"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="World map of drinks by country"
    >
      <g className="worldmap__land">
        {landPaths.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </g>

      {placed.map((badge) => (
        <g
          key={badge.countryCode}
          className="worldmap__badge"
          transform={`translate(${badge.x}, ${badge.y})`}
          onClick={() => onSelect(badge.countryCode)}
          role="button"
          tabIndex={0}
          aria-label={`${badge.count} from ${badge.countryCode}`}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ")
              onSelect(badge.countryCode);
          }}
        >
          {/* Invisible, larger than the badge: a 13px circle is not a tap target. */}
          <circle className="worldmap__hit" r={18} />
          <circle className="worldmap__badge-circle" r={13} />
          <text className="worldmap__badge-text" dy="0.35em">
            {badge.count}
          </text>
        </g>
      ))}
    </svg>
  );
}
