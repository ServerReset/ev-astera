/**
 * Configuration service: reads business-rule values from the `settings` table,
 * caches per (location, key) for 60s. Admin updates invalidate the cache.
 * Everything business-rule-ish flows through here — never hardcode a threshold.
 */
import { prisma } from '../db/prisma.js';
import { SETTING_DEFAULTS } from '../../../shared/constants.js';
import { logger } from '../utils/logger.js';

const TTL_MS = 60_000;
const cache = new Map(); // key: `${locationId}:${key}` -> { value, expires }

function cacheKey(locationId, key) {
  return `${locationId}:${key}`;
}

/** Get a single setting, falling back to the shared default. Coerces jsonb into JS types. */
export async function get(key, locationId) {
  const ck = cacheKey(locationId, key);
  const hit = cache.get(ck);
  if (hit && hit.expires > Date.now()) return hit.value;

  let value;
  try {
    const row = await prisma.settings.findUnique({ where: { location_id_key: { location_id: locationId, key } } });
    value = row ? row.value : SETTING_DEFAULTS[key];
  } catch (err) {
    logger.warn(`config.get(${key}) fell back to default`, { message: err.message });
    value = SETTING_DEFAULTS[key];
  }
  cache.set(ck, { value, expires: Date.now() + TTL_MS });
  return value;
}

/** Convenience typed getters. */
export const getNumber = async (key, locationId) => Number(await get(key, locationId));
export const getBool = async (key, locationId) => {
  const v = await get(key, locationId);
  return v === true || v === 'true' || v === 1;
};

/** All settings for a location as a flat object (used by admin settings page). */
export async function getAll(locationId) {
  const rows = await prisma.settings.findMany({ where: { location_id: locationId }, select: { key: true, value: true } });
  const out = { ...SETTING_DEFAULTS };
  for (const row of rows) out[row.key] = row.value;
  return out;
}

/** Update settings (admin). Upserts each key and invalidates its cache entry. */
export async function update(locationId, patch) {
  try {
    await prisma.$transaction(
      Object.entries(patch).map(([key, value]) =>
        prisma.settings.upsert({
          where: { location_id_key: { location_id: locationId, key } },
          create: { location_id: locationId, key, value },
          update: { value },
        })
      )
    );
  } catch (err) {
    throw new Error(`settings update failed: ${err.message}`);
  }
  for (const key of Object.keys(patch)) cache.delete(cacheKey(locationId, key));
  return getAll(locationId);
}

/** Clear the whole cache (used by tests / boot). */
export function invalidateAll() {
  cache.clear();
}

export const configService = { get, getNumber, getBool, getAll, update, invalidateAll };
