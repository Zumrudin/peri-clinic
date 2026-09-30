/**
 * Where the clinic physically is — machine-readable facts for search engines (JSON-LD, geo meta),
 * not editor content. Deliberately NOT in Directus, like nav.ts: the street address, metro and
 * walking time that visitors read stay in `site_settings`; this only adds what has no place on a page.
 * Coordinates are the building at ул. Генерала Белова, 28 к3 (OpenStreetMap geocoder, 2026-09-30).
 */
export const location = {
  district: 'Орехово-Борисово Южное',
  okrug: 'Южный административный округ',
  okrugShort: 'ЮАО',
  postalCode: '115583',
  regionCode: 'RU-MOW',
  latitude: 55.6049,
  longitude: 37.7217,
};

export type ClinicLocation = typeof location;
