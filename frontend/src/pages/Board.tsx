import { Link } from "react-router-dom";
import { useGetCountryTallyQuery } from "../api/atwApi";
import { EmptyState } from "../components/EmptyState";
import { countryFlag, countryName } from "../countries/countries";
import "./Board.css";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Board() {
  const { data: tally, isLoading } = useGetCountryTallyQuery();

  if (isLoading)
    return (
      <EmptyState icon="⏳" title="Loading" message="Counting the drinks…" />
    );

  if (!tally?.length) {
    return (
      <EmptyState
        icon="🏆"
        title="Nothing to rank yet"
        message="Countries appear here as drinks come in."
      />
    );
  }

  const total = tally.reduce((sum, row) => sum + (row.postCount ?? 0), 0);

  return (
    <div className="board">
      <h1 className="board__title">Countries</h1>
      <p className="board__total">
        {total} {total === 1 ? "drink" : "drinks"} from {tally.length}{" "}
        {tally.length === 1 ? "country" : "countries"}
      </p>

      <ol className="board__list">
        {tally.map((row, index) => (
          <li key={row.countryCode}>
            <Link className="board__row" to={`/country/${row.countryCode}`}>
              <span className="board__rank">{MEDALS[index] ?? index + 1}</span>
              <span className="board__flag" aria-hidden="true">
                {countryFlag(row.countryCode)}
              </span>
              <span className="board__name">
                {countryName(row.countryCode)}
              </span>
              <span className="board__count">{row.postCount ?? 0}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
