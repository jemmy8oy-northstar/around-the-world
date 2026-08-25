import countriesData from "../data/countries.json";

export interface Country {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
}

export const COUNTRIES: Country[] = countriesData as Country[];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function findCountry(
  code: string | undefined | null,
): Country | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined;
}

export function countryName(code: string | undefined | null): string {
  return findCountry(code)?.name ?? code ?? "Somewhere";
}

/**
 * The regional-indicator flag emoji for a country code. Renders natively on iOS
 * and Android, which is what everyone will be using — desktop Chrome on Windows
 * shows the letters instead, which is a graceful enough fallback that it is not
 * worth shipping a sprite sheet for a one-night app.
 */
export function countryFlag(code: string | undefined | null): string {
  if (!code || code.length !== 2) return "🏳️";

  return String.fromCodePoint(
    ...[...code.toUpperCase()].map(
      (character) => 0x1f1e6 + character.charCodeAt(0) - 65,
    ),
  );
}

/** Case- and accent-insensitive search over the picker list. */
export function searchCountries(query: string): Country[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return COUNTRIES;

  const normalise = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();

  const needle = normalise(trimmed);

  return COUNTRIES.filter(
    (c) =>
      normalise(c.name).includes(needle) || c.code.toLowerCase() === trimmed,
  );
}
