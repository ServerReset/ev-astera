/** User service: profile read/update, usage stats, session history. */
import { prisma } from '../../db/prisma.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { configService } from '../../services/config.service.js';
import { NotFoundError } from '../../utils/errors.js';
import { SETTING_KEYS, SESSION_STATUS, PAGE_SIZE } from '../../../../shared/constants.js';
import { startOfWeek, now } from '../../utils/timeUtils.js';

function toPublicUser(row) {
  return {
    id: row.id,
    locationId: row.location_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    vehicleDescription: row.vehicle_description,
    parkingSpot: row.parking_spot,
    notificationPrefs: row.notification_prefs || {},
    carpoolCredits: row.carpool_credits ?? 0,
    createdAt: row.created_at,
    onboardedAt: row.onboarded_at,
  };
}

export const userService = {
  async getById(userId) {
    const data = await prisma.users.findUnique({ where: { id: userId } });
    if (!data) throw new NotFoundError('User not found');
    return toPublicUser(data);
  },

  async updateProfile(userId, patch) {
    const update = {};
    if (patch.displayName !== undefined) update.display_name = patch.displayName;
    if (patch.vehicleDescription !== undefined) update.vehicle_description = patch.vehicleDescription || null;
    if (patch.parkingSpot !== undefined) update.parking_spot = patch.parkingSpot || null;
    if (patch.notificationPrefs !== undefined) update.notification_prefs = patch.notificationPrefs;

    let data;
    try {
      data = await prisma.users.update({ where: { id: userId }, data: update });
    } catch {
      throw new NotFoundError('User not found');
    }
    await emit(EVENTS.USER_UPDATED, { userId, locationId: data.location_id });
    return toPublicUser(data);
  },

  async completeOnboarding(userId) {
    let data;
    try {
      data = await prisma.users.update({ where: { id: userId }, data: { onboarded_at: now() } });
    } catch {
      throw new NotFoundError('User not found');
    }
    await emit(EVENTS.USER_UPDATED, { userId, locationId: data.location_id });
    return toPublicUser(data);
  },

  async resetOnboarding(userId) {
    let data;
    try {
      data = await prisma.users.update({ where: { id: userId }, data: { onboarded_at: null } });
    } catch {
      throw new NotFoundError('User not found');
    }
    await emit(EVENTS.USER_UPDATED, { userId, locationId: data.location_id });
    return toPublicUser(data);
  },

  /** Weekly usage: sessions started this week vs. the configured max. */
  async getStats(userId, locationId) {
    const weekStart = startOfWeek(now());
    const weekly = await prisma.sessions.count({
      where: {
        user_id: userId,
        started_at: { gte: weekStart },
        status: { in: [SESSION_STATUS.COMPLETED, SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME, SESSION_STATUS.FORCE_ENDED] },
      },
    });

    const max = await configService.getNumber(SETTING_KEYS.MAX_WEEKLY_SESSIONS, locationId);

    const total = await prisma.sessions.count({ where: { user_id: userId } });

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
