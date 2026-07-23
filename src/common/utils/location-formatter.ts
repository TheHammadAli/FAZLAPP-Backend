export interface GeoJsonPoint {
  type: "Point";
  coordinates: [number, number];
}

/**
 * Builds the `{type: "Point", coordinates: [lng, lat]}` GeoJSON shape the
 * frontend received from Mongo's 2dsphere fields, from plain latitude/
 * longitude columns (used instead of PostGIS geography, which isn't
 * available on this Postgres instance).
 */
export function toGeoJson(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): GeoJsonPoint | null {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return null;
  }
  return { type: "Point", coordinates: [longitude, latitude] };
}

/**
 * Inverse of toGeoJson — extracts {latitude, longitude} from a submitted
 * GeoJSON point for storage in plain columns.
 */
export function fromGeoJson(
  point: GeoJsonPoint | null | undefined,
): { latitude: number; longitude: number } | null {
  if (!point?.coordinates || point.coordinates.length !== 2) {
    return null;
  }
  const [longitude, latitude] = point.coordinates;
  return { latitude, longitude };
}
