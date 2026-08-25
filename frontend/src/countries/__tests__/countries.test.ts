import { describe, it, expect } from "vitest";
import {
  COUNTRIES,
  countryFlag,
  countryName,
  findCountry,
  searchCountries,
} from "../countries";

describe("country dataset", () => {
  it("covers every country the picker could need", () => {
    expect(COUNTRIES.length).toBeGreaterThan(240);
  });

  it("has no duplicate codes", () => {
    const codes = new Set(COUNTRIES.map((c) => c.code));
    expect(codes.size).toBe(COUNTRIES.length);
  });

  it("uses two-letter upper-case ISO codes", () => {
    for (const country of COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("places every centroid within valid coordinate bounds", () => {
    for (const country of COUNTRIES) {
      expect(country.latitude).toBeGreaterThanOrEqual(-90);
      expect(country.latitude).toBeLessThanOrEqual(90);
      expect(country.longitude).toBeGreaterThanOrEqual(-180);
      expect(country.longitude).toBeLessThanOrEqual(180);
    }
  });

  it.each([
    // These were all wrong at some point: taking d3.geoCentroid over the whole
    // geometry drags a country into the ocean when it has overseas territories,
    // and Ashmore and Cartier Islands share Australia's ISO code, which once put
    // Australia's badge in the Timor Sea.
    ["AU", -25, 134],
    ["FR", 46, 2],
    ["US", 39, -98],
    ["NO", 63, 12],
    ["GB", 53, -2],
  ])("places %s near its landmass", (code, latitude, longitude) => {
    const country = findCountry(code)!;

    // A few degrees of slack: the point being asserted is "on the right
    // landmass", not an exact centroid. The bugs this catches were 30-90
    // degrees out, not fractions of one.
    expect(Math.abs(country.latitude - (latitude as number))).toBeLessThan(3);
    expect(Math.abs(country.longitude - (longitude as number))).toBeLessThan(3);
  });

  it("uses names people actually say", () => {
    expect(countryName("US")).toBe("United States");
    expect(countryName("RU")).toBe("Russia");
    expect(countryName("LA")).toBe("Laos");
    expect(countryName("IR")).toBe("Iran");
  });

  it("excludes XK, which the API would reject as a non-ISO code", () => {
    expect(findCountry("XK")).toBeUndefined();
  });
});

describe("findCountry", () => {
  it("is case insensitive", () => {
    expect(findCountry("jp")?.name).toBe("Japan");
  });

  it("returns undefined for nothing", () => {
    expect(findCountry(null)).toBeUndefined();
    expect(findCountry("")).toBeUndefined();
  });
});

describe("countryFlag", () => {
  it("maps a code to its regional-indicator flag", () => {
    expect(countryFlag("GB")).toBe("🇬🇧");
    expect(countryFlag("jp")).toBe("🇯🇵");
  });

  it("falls back for anything unusable", () => {
    expect(countryFlag(null)).toBe("🏳️");
    expect(countryFlag("XYZ")).toBe("🏳️");
  });
});

describe("searchCountries", () => {
  it("returns everything for an empty query", () => {
    expect(searchCountries("  ")).toHaveLength(COUNTRIES.length);
  });

  it("matches on a name fragment, case insensitively", () => {
    expect(searchCountries("king").map((c) => c.code)).toContain("GB");
  });

  it("matches an exact code", () => {
    expect(searchCountries("jp").map((c) => c.code)).toContain("JP");
  });

  it("ignores accents so a plain keyboard finds accented names", () => {
    expect(searchCountries("aland").map((c) => c.code)).toContain("AX");
  });

  it("returns nothing for gibberish", () => {
    expect(searchCountries("zzzzzz")).toHaveLength(0);
  });
});
