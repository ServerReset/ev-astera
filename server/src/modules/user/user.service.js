/** User service: profile read/update, usage stats, session history. */
import { prisma } from '../../db/prisma.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { configService } from '../../services/config.service.js';
import { NotFoundError } from '../../utils/errors.js';
import { SETTING_KEYS, SESSION_STATUS, PAGE_SIZE } from '../../../../shared/constants.js';
import { startOfWeek, now, toZonedParts } from '../../utils/timeUtils.js';

/** A local calendar-day key (YYYY-MM-DD) for a UTC instant in the given timezone. */
function localDayKey(date, tz) {
  const p = toZonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Consecutive-day charging streak: how many days in a row (ending today, or yesterday if nothing
 * yet today) the user started at least one session, counted in their office's local timezone. A
 * real "used the charger" signal, derived from sessions.started_at — no new table or counter.
 */
function computeStreak(startDates, tz) {
  if (!startDates.length) return 0;
  const days = new Set(startDates.map((d) => localDayKey(d, tz)));
  // Walk backward from today one local day at a time; stop at the first gap. If there's no
  // session today, allow the streak to still count when it ran through yesterday (today isn't
  // over yet — not charging *yet* today shouldn't erase a live streak).
  const MS_DAY = 86_400_000;
  const todayKey = localDayKey(now(), tz);
  let cursor = now();
  if (!days.has(todayKey)) cursor = new Date(cursor.getTime() - MS_DAY); // start from yesterday
  let streak = 0;
  while (days.has(localDayKey(cursor, tz))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - MS_DAY);
  }
  return streak;
}

function toPublicUser(row) {
  return {
    id: row.id,
    locationId: row.location_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    vehicleDescription: row.vehicle_description,
    notificationPrefs: row.notification_prefs || {},
    carpoolCredits: row.carpool_credits ?? 0,
    createdAt: row.created_at,
    onboardedAt: row.onboarded_at,
    // The client resolves every displayed date/time against this — see client/src/utils/time.js's
    // resolveTz() — rather than a hardcoded constant, so times always read in the user's own
    // office's local wall-clock regardless of the viewing device's timezone.
    office: row.locations ? { id: row.locations.id, name: row.locations.name, timezone: row.locations.timezone } : null,
  };
}

const WITH_OFFICE = { locations: { select: { id: true, name: true, timezone: true } } };

export const userService = {
  async getById(userId) {
    const data = await prisma.users.findUnique({ where: { id: userId }, include: WITH_OFFICE });
    if (!data) throw new NotFoundError('User not found');
    return toPublicUser(data);
  },

  async updateProfile(userId, patch) {
    const update = {};
    if (patch.displayName !== undefined) update.display_name = patch.displayName;
    if (patch.vehicleDescription !== undefined) update.vehicle_description = patch.vehicleDescription || null;
    if (patch.notificationPrefs !== undefined) update.notification_prefs = patch.notificationPrefs;

    let data;
    try {
      data = await prisma.users.update({ where: { id: userId }, data: update, include: WITH_OFFICE });
    } catch {
      throw new NotFoundError('User not found');
    }
    await emit(EVENTS.USER_UPDATED, { userId, locationId: data.location_id });
    return toPublicUser(data);
  },

  async completeOnboarding(userId) {
    let data;
    try {
      data = await prisma.users.update({ where: { id: userId }, data: { onboarded_at: now() }, include: WITH_OFFICE });
    } catch {
      throw new NotFoundError('User not found');
    }
    await emit(EVENTS.USER_UPDATED, { userId, locationId: data.location_id });
    return toPublicUser(data);
  },

  async resetOnboarding(userId) {
    let data;
    try {
      data = await prisma.users.update({ where: { id: userId }, data: { onboarded_at: null }, include: WITH_OFFICE });
    } catch {
      throw new NotFoundError('User not found');
    }
    await emit(EVENTS.USER_UPDATED, { userId, locationId: data.location_id });
    return toPublicUser(data);
  },

  /** Weekly usage: sessions started this week vs. the configured max. */
  async getStats(userId, locationId, tz) {
    const weekStart = startOfWeek(now(), tz);
    // Per-office count (matches the per-office max, and assertWeeklyLimit): a user with sessions
    // across offices must not have this week's tile show a globally-summed figure for one office.
    const weekly = await prisma.sessions.count({
      where: {
        user_id: userId,
        location_id: locationId,
        started_at: { gte: weekStart },
        status: { in: [SESSION_STATUS.COMPLETED, SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME, SESSION_STATUS.FORCE_ENDED] },
      },
    });

    const max = await configService.getNumber(SETTING_KEYS.MAX_WEEKLY_SESSIONS, locationId);

    const total = await prisma.sessions.count({ where: { user_id: userId } });

    // Charging streak: pull recent session start dates (60 days is plenty for any realistic
    // run) and count consecutive local days. Bounded so this stays a cheap indexed read.
    const recentStarts = await prisma.sessions.findMany({
      where: { user_id: userId, started_at: { gte: new Date(now().getTime() - 60 * 86_400_000) } },
      select: { started_at: true },
      orderBy: { started_at: 'desc' },
    });
    const streak = computeStreak(recentStarts.map((s) => s.started_at), tz);

    // Carpool impact snapshot.
    const trips = await prisma.carpool_trip_logs.findMany({
      where: { user_id: userId },
      select: { miles: true, co2_grams_saved: true, credits_awarded: true },
    });
    const impact = trips.reduce(
      (acc, t) => ({
        trips: acc.trips + 1,
        miles: acc.miles + (t.miles || 0),
        co2Kg: acc.co2Kg + (t.co2_grams_saved || 0) / 1000,
      }),
      { trips: 0, miles: 0, co2Kg: 0 }
    );

    return {
      weeklySessionsUsed: weekly,
      weeklySessionsMax: max,
      totalSessions: total,
      streakDays: streak,
      carpool: { trips: impact.trips, miles: Math.round(impact.miles), co2Kg: Math.round(impact.co2Kg * 10) / 10 },
    };
  },

  async getHistory(userId, page = 1) {
    const skip = (page - 1) * PAGE_SIZE;
    const [data, count] = await Promise.all([
      prisma.sessions.findMany({
        where: { user_id: userId },
        include: { chargers: { select: { name: true } } },
        orderBy: { started_at: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.sessions.count({ where: { user_id: userId } }),
    ]);
    const items = data.map((s) => ({
      id: s.id,
      chargerId: s.charger_id,
      chargerName: s.chargers?.name,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      etaAt: s.eta_at,
      status: s.status,
    }));
    return { items, total: count, page };
  },
};
