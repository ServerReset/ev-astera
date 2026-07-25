/**
 * weeklyReset (Monday midnight): weekly session counts are derived from the sessions table
 * (no counter column), so there's nothing to zero out — but we clear any transient lock flags
 * and log the boundary for auditing. Kept as a job so the boundary is observable & extensible.
 *
 * Scoped per active office, checking each office's OWN local day-of-week — the cron fires once
 * daily at a single UTC instant (vercel.json), so "is it Monday" can't be a single global check
 * once offices span timezones; a Tokyo office's Monday and a Los Angeles office's Monday don't
 * land in the same 24h cron-firing window.
 */
import { prisma } from '../db/prisma.js';
import { startOfWeek, now, localWeekday } from '../utils/timeUtils.js';

const MONDAY = 1;

export async function weeklyReset() {
  const locations = await prisma.locations.findMany({ where: { active: true }, select: { id: true, timezone: true } });
  let actions = 0;
  // Per-office week starts, not one aggregate — offices in different timezones don't share a
  // single "correct" boundary, and a bare startOfWeek(now()) silently defaulted to the
  // server's fallback timezone regardless of which office(s) were actually reset that run.
  const weekStarts = {};
  for (const loc of locations) {
    if (localWeekday(now(), loc.timezone) !== MONDAY) continue;
    await prisma.users.updateMany({
      where: { location_id: loc.id, locked_until: { not: null } },
      data: { failed_attempts: 0, locked_until: null },
    });
    weekStarts[loc.id] = startOfWeek(now(), loc.timezone);
    actions++;
  }
  return { actions, weekStarts };
}
