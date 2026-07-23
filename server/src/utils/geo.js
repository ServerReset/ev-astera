/** Great-circle distance helpers used by the carpool matcher. */

const R_MILES = 3958.8;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Haversine distance in miles between two {lat,lng} points. */
export function haversineMiles(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return Infinity;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Extra distance a driver takes to pick someone up:
 *   d(driverOrigin, pickup) + d(pickup, site) - d(driverOrigin, site)
 * Never negative.
 */
export function detourMiles(driverOrigin, pickup, site) {
  const direct = haversineMiles(driverOrigin, site);
  const viaPickup = haversineMiles(driverOrigin, pickup) + haversineMiles(pickup, site);
  return Math.max(0, viaPickup - direct);
}
