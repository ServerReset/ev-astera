/**
 * Small TTL cache over charger id → display name. Charger names are effectively static (they only
 * change on an admin rename), yet chargerName() was doing a chargers.findUnique per QUEUE_ADVANCED
 * and per SESSION_OVERTIME notification — hundreds/day at scale for a value that almost never
 * changes. Mirrors getLocationMeta's 5-minute TTL pattern (utils/locationTz.js). Invalidated on
 * rename/delete via invalidateChargerName().
 */
import { prisma } from '../db/prisma.js';

const TTL_MS = 5 * 60_000;
const cache = new Map(); // chargerId -> { name, expires }

export async function getChargerName(chargerId) {
  if (!chargerId) return 'a charger';
  const hit = cache.get(chargerId);
  if (hit && hit.expires > Date.now()) return hit.name;

  const row = await prisma.chargers.findUnique({ where: { id: chargerId }, select: { name: true } });
  const name = row?.name || 'a charger';
  cache.set(chargerId, { name, expires: Date.now() + TTL_MS });
  return name;
}

/** Call after a charger is renamed or removed so the next lookup is fresh. */
export function invalidateChargerName(chargerId) {
  cache.delete(chargerId);
}
