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

  return (
    <div className="picker">
      <input
        className="picker__search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
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
              onClick={() => onChange(country.code)}
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
