/**
 * Admin service: operational controls + config. Delegates to other services via the
 * registry where behavior must match user flows (e.g. force-ending a session, charger
 * on/offline), and reads aggregate stats directly.
 */
import { prisma } from '../../db/prisma.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { services } from '../../services/index.js';
import { configService } from '../../services/config.service.js';
import { NotFoundError } from '../../utils/errors.js';
import {
  SESSION_STATUS,
  QUEUE_STATUS,
  RIDE_STATUS,
  PAGE_SIZE,
} from '../../../../shared/constants.js';
import { startOfWeek, now, addDays } from '../../utils/timeUtils.js';

export const adminService = {
  /** High-level dashboard numbers for the admin home. */
  async overview(locationId) {
    const weekStart = startOfWeek(now());
    const dayAgo = addDays(now(), -1);

    const [activeSessions, queueWaiting, users, sessionsToday, openRides] = await Promise.all([
      prisma.sessions.count({ where: { location_id: locationId, status: { in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME] } } }),
      prisma.queue_entries.count({ where: { location_id: locationId, status: { in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] } } }),
      prisma.users.count({ where: { location_id: locationId, active: true } }),
      prisma.sessions.count({ where: { location_id: locationId, started_at: { gte: dayAgo } } }),
      prisma.carpool_rides.count({ where: { location_id: locationId, status: RIDE_STATUS.OPEN } }),
    ]);

    // Carpool impact this week (location-wide).
    const trips = await prisma.carpool_trip_logs.findMany({
      where: { location_id: locationId, created_at: { gte: weekStart } },
      select: { co2_grams_saved: true },
    });
    const co2KgWeek = Math.round((trips.reduce((a, t) => a + (t.co2_grams_saved || 0), 0) / 1000) * 10) / 10;

    return {
      activeSessions,
      queueWaiting,
      activeUsers: users,
      sessionsLast24h: sessionsToday,
      carpoolOpenRides: openRides,
      carpoolCo2KgThisWeek: co2KgWeek,
    };
  },

  // ── Chargers (delegate to charger service so events/side-effects match) ─────────
  async setChargerOffline(locationId, chargerId, reason) {
    return services.charger.setOffline(locationId, chargerId, reason);
  },
  async setChargerOnline(locationId, chargerId) {
    return services.charger.setOnline(locationId, chargerId);
  },
  async renameCharger(locationId, chargerId, name) {
    return services.charger.rename(locationId, chargerId, name);
  },

  // ── Sessions ─────────────────────────────────────────────────────────────────────
  async forceEndSession(locationId, sessionId, adminId) {
    return services.session.forceEnd(locationId, sessionId, adminId);
  },

  // ── Settings ───────────────────────────────────────────────────────────────────
  async getSettings(locationId) {
    return configService.getAll(locationId);
  },
  async updateSettings(locationId, patch, adminId) {
    const updated = await configService.update(locationId, patch);
    await emit(EVENTS.USER_UPDATED, { locationId, userId: adminId, action: 'settings_updated' });
    return updated;
  },

  // ── Announcements ────────────────────────────────────────────────────────────────
  async listAnnouncements(locationId) {
    return prisma.announcements.findMany({
      where: { location_id: locationId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  },
  async createAnnouncement(locationId, adminId, body) {
    let data;
    try {
      data = await prisma.announcements.create({
        data: {
          location_id: locationId,
          title: body.title,
          body: body.body,
          active: body.active ?? true,
          expires_at: body.expiresAt || null,
          created_by: adminId,
        },
      });
    } catch {
      throw new NotFoundError('Could not create announcement');
    }
    if (data.active) {
      await emit(EVENTS.ANNOUNCEMENT_CREATED, { locationId, title: data.title, body: data.body, announcementId: data.id });
    }
    return data;
  },
  async deleteAnnouncement(locationId, announcementId) {
    await prisma.announcements.deleteMany({ where: { id: announcementId, location_id: locationId } });
    return { success: true };
  },

  // ── Users ──────────────────────────────────────────────────────────────────────
  async listUsers(locationId, page = 1, search = '') {
    const skip = (page - 1) * PAGE_SIZE;
    const where = {
      location_id: locationId,
      ...(search ? { display_name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const [data, count] = await Promise.all([
      prisma.users.findMany({
        where,
        select: { id: true, email: true, display_name: true, role: true, active: true, carpool_credits: true, created_at: true },
        orderBy: { created_at: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.users.count({ where }),
    ]);
    return {
      items: data.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        role: u.role,
        active: u.active,
        carpoolCredits: u.carpool_credits,
        createdAt: u.created_at,
      })),
      total: count,
      page,
    };
  },
  async updateUser(locationId, userId, patch) {
    const update = {};
    if (patch.role) update.role = patch.role;
    if (patch.active !== undefined) update.active = patch.active;
    if (patch.resetWeek) {
      // "Reset week" = cancel their queue entries; session counts are derived so nothing to zero.
      await prisma.queue_entries.updateMany({
        where: { user_id: userId, status: { in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] } },
        data: { status: QUEUE_STATUS.CANCELLED },
      });
    }
    if (Object.keys(update).length) {
      const { count } = await prisma.users.updateMany({ where: { id: userId, location_id: locationId }, data: update });
      if (!count) throw new NotFoundError('User not found');
    }
    return { success: true };
  },

  /** Recent audit log entries for the admin activity feed. */
  async auditFeed(locationId, page = 1) {
    const skip = (page - 1) * PAGE_SIZE;
    const [data, count] = await Promise.all([
      prisma.audit_log.findMany({
        where: { location_id: locationId },
        select: { id: true, action: true, details: true, user_id: true, created_at: true },
        orderBy: { created_at: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.audit_log.count({ where: { location_id: locationId } }),
    ]);
    return { items: data, total: count, page };
  },
};
