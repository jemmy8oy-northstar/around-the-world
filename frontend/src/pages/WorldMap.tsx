import { useNavigate } from "react-router-dom";
import { useGetCountryTallyQuery } from "../api/atwApi";
import { WorldMapSvg } from "../components/WorldMapSvg";
import { EmptyState } from "../components/EmptyState";
import "./WorldMap.css";

export default function WorldMap() {
  const navigate = useNavigate();
  const { data: tally, isLoading } = useGetCountryTallyQuery();

  if (isLoading)
    return (
      <EmptyState icon="⏳" title="Loading" message="Drawing the world…" />
    );

  const badges = (tally ?? []).map((t) => ({
    countryCode: t.countryCode,
    count: t.postCount ?? 0,
  }));

  return (
    <div className="worldmap-page">
      <div className="worldmap-page__canvas">
        <WorldMapSvg
          badges={badges}
          onSelect={(code) => navigate(`/country/${code}`)}
        />
      </div>

      {badges.length === 0 ? (
        <EmptyState
          icon="🗺️"
          title="The world is empty"
          message="Post a drink and the first pin appears here."
        />
      ) : (
        <p className="worldmap-page__hint">
          {badges.length} {badges.length === 1 ? "country" : "countries"} so far
          — tap a pin to see the drinks.
        </p>
      )}
    </div>
  );
}
