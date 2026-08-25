/**
 * Builds src/data/countries.json — the country picker's list and the map's badge
 * positions.
 *
 * Two deliberate choices:
 *
 * 1. Centroids come from the 50m TopoJSON (241 features) while the map itself
 *    renders the 110m one (105KB, 177 features). A badge is just a projected
 *    lat/lng, so a country the low-resolution outline omits still gets a
 *    correctly placed badge — and the picker covers Malta, Barbados, Singapore
 *    and the rest of the small island nations that make an around-the-world
 *    crawl interesting.
 *
 * 2. Each centroid is the centre of the country's LARGEST polygon, not
 *    d3.geoCentroid over the whole geometry. Overseas territories drag a true
 *    centroid into the ocean — France lands in the Atlantic, the USA in the
 *    Pacific, Norway up by Svalbard.
 *
 * Run with: npm run generate:countries
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import { geoCentroid, geoArea } from 'd3-geo';
import countries from 'i18n-iso-countries';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Places the 50m dataset has no geometry for, but which someone could plausibly
 * bring a drink back from. Kosovo (XK) is deliberately absent: it is not an
 * official ISO 3166-1 code and the API would reject it.
 */
const MANUAL_CENTROIDS = {
  BQ: [12.1784, -68.2385],
  BV: [-54.4208, 3.3464],
  CC: [-12.1642, 96.871],
  CX: [-10.4475, 105.6904],
  GF: [3.9339, -53.1258],
  GI: [36.1408, -5.3536],
  GP: [16.265, -61.551],
  MQ: [14.6415, -61.0242],
  RE: [-21.1151, 55.5364],
  SJ: [77.5536, 23.6703],
  TK: [-9.2002, -171.8484],
  TV: [-7.1095, 177.6493],
  UM: [19.2823, 166.647],
  YT: [-12.8275, 45.1662],
};

/**
 * Names people actually say. ISO's official forms ("Islamic Republic of Iran",
 * "Lao People's Democratic Republic") are unusable in a picker someone is
 * scrolling one-handed in a pub, and the library's aliases are inconsistent —
 * some are better ("Russia"), some are worse ("Korea, Republic of").
 */
const NAME_OVERRIDES = {
  AE: 'United Arab Emirates',
  BN: 'Brunei',
  BO: 'Bolivia',
  CD: 'DR Congo',
  CG: 'Congo',
  CN: 'China',
  CZ: 'Czechia',
  GB: 'United Kingdom',
  IR: 'Iran',
  KP: 'North Korea',
  KR: 'South Korea',
  LA: 'Laos',
  MD: 'Moldova',
  MK: 'North Macedonia',
  MM: 'Myanmar',
  NL: 'Netherlands',
  PS: 'Palestine',
  RU: 'Russia',
  SY: 'Syria',
  TR: 'Turkey',
  TW: 'Taiwan',
  TZ: 'Tanzania',
  US: 'United States',
  VA: 'Vatican City',
  VE: 'Venezuela',
  VN: 'Vietnam',
};

/** Prefers the shortest sensible form: an override, then a comma-free alias, then the official name. */
function displayName(code) {
  if (NAME_OVERRIDES[code]) return NAME_OVERRIDES[code];

  const official = countries.getName(code, 'en') ?? code;
  const alias = countries.getName(code, 'en', { select: 'alias' });

  return alias && !alias.includes(',') && alias.length < official.length ? alias : official;
}

const topology = JSON.parse(
  fs.readFileSync(path.join(here, '../node_modules/world-atlas/countries-50m.json'), 'utf8'),
);
const collection = feature(topology, topology.objects.countries);

/** The largest constituent polygon, by spherical area. */
function largestPolygon(geometry) {
  if (geometry.type !== 'MultiPolygon') return geometry;

  let best = null;
  let bestArea = -1;

  for (const coordinates of geometry.coordinates) {
    const polygon = { type: 'Polygon', coordinates };
    const area = geoArea(polygon);
    if (area > bestArea) {
      bestArea = area;
      best = polygon;
    }
  }

  return best ?? geometry;
}

const byCode = new Map();

for (const f of collection.features) {
  // world-atlas ids are ISO 3166-1 numeric codes, as strings.
  const code = countries.numericToAlpha2(String(f.id).padStart(3, '0'));
  if (!code) continue;

  const polygon = largestPolygon(f.geometry);
  const area = geoArea(polygon);

  // Several countries appear as more than one feature — external territories
  // carry the parent's ISO code. Ashmore and Cartier Islands share Australia's,
  // and taking the last one put the Australia badge in the Timor Sea. Keep
  // whichever feature has the biggest landmass.
  const existing = byCode.get(code);
  if (existing && existing.area >= area) continue;

  const [longitude, latitude] = geoCentroid(polygon);
  byCode.set(code, { code, name: displayName(code), latitude, longitude, area });
}

for (const [code, [latitude, longitude]] of Object.entries(MANUAL_CENTROIDS)) {
  if (byCode.has(code)) continue;
  byCode.set(code, { code, name: displayName(code), latitude, longitude });
}

const rows = [...byCode.values()]
  .map((c) => ({
    code: c.code,
    name: c.name,
    latitude: Number(c.latitude.toFixed(4)),
    longitude: Number(c.longitude.toFixed(4)),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const outputPath = path.join(here, '../src/data/countries.json');
fs.writeFileSync(outputPath, `${JSON.stringify(rows, null, 2)}\n`);

console.log(`Wrote ${rows.length} countries to ${path.relative(process.cwd(), outputPath)}`);
