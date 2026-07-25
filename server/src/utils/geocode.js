/**
 * Server-side, one-time address geocoding for office identity: an admin-entered address
 * (server/src/modules/admin/admin.service.js's updateOffice, server/src/modules/office/) →
 * site_lat/site_lng, feeding the existing haversine geofence check in
 * providers/auth/local.provider.js's register(). Distinct from
 * client/src/components/carpool/GeoPointField.jsx (carpool origins — interactive, browser-side,
 * label-only, discards coordinates by design): this fires once per admin save, not per
 * keystroke, so Nominatim's ~1 req/sec usage-policy limit is a non-issue — but its policy does
 * require a descriptive, non-browser User-Agent, supplied below.
 */
import { AppError, BusinessRuleError } from './errors.js';
import { logger } from './logger.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'ev-charger-hub/1.0 (office geocoding; contact: ev-admin@asteralabs.com)';

/**
 * @param {string} address
 * @returns {Promise<{lat: number, lng: number, displayName: string}>}
 * @throws {BusinessRuleError} the address didn't resolve — user-fixable, surfaced as-is.
 * @throws {AppError} network/provider failure — transient, distinct error code.
 */
export async function geocodeAddress(address) {
  const trimmed = (address || '').trim();
  if (!trimmed) throw new BusinessRuleError('An address is required.');

  let res;
  try {
    res = await fetch(`${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(trimmed)}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
  } catch (err) {
    logger.error('geocode request failed', { message: err.message });
    throw new AppError('Could not reach the geocoding service. Try again in a moment.', 502, 'GEOCODE_PROVIDER_ERROR');
  }
  if (!res.ok) {
    throw new AppError('Could not reach the geocoding service. Try again in a moment.', 502, 'GEOCODE_PROVIDER_ERROR');
  }

  const results = await res.json();
  const first = Array.isArray(results) ? results[0] : null;
  if (!first || first.lat == null || first.lon == null) {
    throw new BusinessRuleError(`Could not find coordinates for "${trimmed}" — check the address and try again.`);
  }
  return { lat: Number(first.lat), lng: Number(first.lon), displayName: first.display_name };
}
