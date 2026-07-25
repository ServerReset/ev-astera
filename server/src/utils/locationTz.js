/**
 * Small cache over a location's timezone/active state, shared by locationScope (request-scoped)
 * and non-request contexts that need the same data (cron jobs, event listeners) — so the same
 * location is never queried twice by two different code paths. Mirrors locationScope's own
 * pre-existing 5-minute TTL pattern.
 */
import { prisma } from '../db/prisma.js';

const TTL_MS = 5 * 60_000;
const cache = new Map(); // locationId -> { tz, active, expires }

export async function getLocationMeta(locationId) {
  const hit = cache.get(locationId);
  if (hit && hit.expires > Date.now()) return hit;

  const row = await prisma.locations.findUnique({ where: { id: locationId }, select: { timezone: true, active: true } });
  if (!row) return null;

  const meta = { tz: row.timezone, active: row.active, expires: Date.now() + TTL_MS };
  cache.set(locationId, meta);
  return meta;
}

/** Call after any write to a location's own row (timezone/active) so the next read is fresh. */
export function invalidateLocationMeta(locationId) {
  cache.delete(locationId);
}
