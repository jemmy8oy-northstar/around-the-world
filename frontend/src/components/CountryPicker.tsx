import { useMemo, useState } from "react";
import { searchCountries, countryFlag } from "../countries/countries";
import "./CountryPicker.css";

interface CountryPickerProps {
  value: string;
  onChange: (code: string) => void;
}

/**
 * A searchable list rather than a native select: 249 options in a native picker
 * is a scroll wheel nobody can use one-handed, and typing two letters gets you
 * there instantly.
 */
export function CountryPicker({ value, onChange }: CountryPickerProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchCountries(query), [query]);

  /**
   * Picking a country puts its name in the search box, so the box always reads
   * as "what this post is tagged with" rather than as a stale search someone
   * ran a minute ago.
   */
  function select(code: string, name: string) {
    onChange(code);
    setQuery(name);
  }

  /**
   * Typing clears the selection. Without this, someone who picks France, then
   * types "Ger" and posts without tapping a result, posts France — the box
   * disagrees with the tag and nothing on screen says so. Clearing is the safe
   * half of James's suggestion on #46; auto-selecting the top result would let
   * a half-typed query silently choose a country nobody looked at.
   *
   * Only this handler clears, which is why select() above can safely write to
   * the same box without undoing itself.
   */
  function type(text: string) {
    setQuery(text);
    if (value) onChange("");
  }

  return (
    <div className="picker">
      <input
        className="picker__search"
        type="search"
        value={query}
        onChange={(e) => type(e.target.value)}
        placeholder="Search countries"
        aria-label="Search countries"
      />

      <ul className="picker__list" role="listbox" aria-label="Country">
        {results.map((country) => (
          <li key={country.code}>
            <button
              type="button"
              role="option"
              aria-selected={value === country.code}
              className={`picker__option${value === country.code ? " picker__option--selected" : ""}`}
              onClick={() => select(country.code, country.name)}
            >
              <span className="picker__flag" aria-hidden="true">
                {countryFlag(country.code)}
              </span>
              <span className="picker__name">{country.name}</span>
            </button>
          </li>
        ))}

        {results.length === 0 && (
          <li className="picker__none">No country matches "{query}"</li>
        )}
      </ul>
    </div>
  );
}
