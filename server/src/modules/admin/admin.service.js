/**
 * Admin service: operational controls + config. Delegates to other services via the
 * registry where behavior must match user flows (e.g. force-ending a session, charger
 * on/offline), and reads aggregate stats directly.
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { services } from '../../services/index.js';
import { configService } from '../../services/config.service.js';
import { NotFoundError, ConflictError, AuthorizationError } from '../../utils/errors.js';
import { geocodeAddress } from '../../utils/geocode.js';
import { invalidateLocationMeta } from '../../utils/locationTz.js';
import {
  SESSION_STATUS,
  QUEUE_STATUS,
  RIDE_STATUS,
  CARPOOL_ROLE,
  PAGE_SIZE,
  ROLES,
} from '../../../../shared/constants.js';
import { startOfWeek, now, addDays } from '../../utils/timeUtils.js';

// Unambiguous character set (no 0/O/1/I/l) since an admin reads this aloud or types it once.
const TEMP_PW_SETS = {
  upper: 'ABCDEFGHJKMNPQRSTUVWXYZ',
  lower: 'abcdefghjkmnpqrstuvwxyz',
  digit: '23456789',
  symbol: '!@#$%&*?',
};
const TEMP_PW_ALL = Object.values(TEMP_PW_SETS).join('');

function randomChar(set) {
  return set[crypto.randomInt(set.length)];
}

/** A random temp password guaranteed to satisfy passwordSchema (upper/lower/digit/symbol). */
function generateTempPassword(length = 12) {
  const required = Object.values(TEMP_PW_SETS).map(randomChar);
  const rest = Array.from({ length: length - required.length }, () => randomChar(TEMP_PW_ALL));
  const chars = [...required, ...rest];
  // Fisher-Yates shuffle so the guaranteed classes aren't always in the same leading positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export const adminService = {
  /** High-level dashboard numbers for the admin home. */
  async overview(locationId, tz) {
    const weekStart = startOfWeek(now(), tz);
    const dayAgo = addDays(now(), -1);

    const [activeSessions, queueWaiting, users, sessionsToday, openRides] = await Promise.all([
      prisma.sessions.count({ where: { location_id: locationId, status: { in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME] } } }),
      prisma.queue_entries.count({ where: { location_id: locationId, status: { in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] } } }),
      prisma.users.count({ where: { location_id: locationId, active: true } }),
      prisma.sessions.count({ where: { location_id: locationId, started_at: { gte: dayAgo } } }),
      prisma.carpool_rides.count({ where: { location_id: locationId, status: RIDE_STATUS.OPEN } }),
    ]);

    // Carpool impact this week (location-wide). Count each ride's CO2 exactly ONCE:
    // completeRideImpact writes the FULL ride savings on the driver's trip log AND each rider's
    // share on their own row, so summing every row double-counts (2x). Filter to driver rows —
    // identical to carpool.service.js's leaderboardTotals(), which documents the same fix.
    const trips = await prisma.carpool_trip_logs.findMany({
      where: { location_id: locationId, role: CARPOOL_ROLE.DRIVER, created_at: { gte: weekStart } },
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
  async createCharger(locationId, name) {
    return services.charger.create(locationId, name);
  },
  async deleteCharger(locationId, chargerId) {
    return services.charger.remove(locationId, chargerId);
  },
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

  // ── Office identity (name/address/timezone) ─────────────────────────────────────
  async getOffice(locationId) {
    const o = await prisma.locations.findUnique({ where: { id: locationId } });
    if (!o) throw new NotFoundError('Office not found');
    return { id: o.id, name: o.name, address: o.address, timezone: o.timezone, active: o.active };
  },
  async updateOffice(locationId, patch) {
    const current = await prisma.locations.findUnique({ where: { id: locationId } });
    if (!current) throw new NotFoundError('Office not found');

    const data = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.timezone !== undefined) data.timezone = patch.timezone;
    if (patch.address !== undefined) {
      data.address = patch.address || null;
      // Only re-geocode when the address actually changed (or coordinates were never set) —
      // never re-hit the network on an unrelated field save.
      const needsGeocode = patch.address && (patch.address !== current.address || current.site_lat == null || current.site_lng == null);
      if (needsGeocode) {
        const geo = await geocodeAddress(patch.address); // throws — nothing written on failure
        data.site_lat = geo.lat;
        data.site_lng = geo.lng;
      }
    }

    const updated = await prisma.locations.update({ where: { id: locationId }, data });
    invalidateLocationMeta(locationId);
    await emit(EVENTS.LOCATION_UPDATED, { locationId });
    return { id: updated.id, name: updated.name, address: updated.address, timezone: updated.timezone, active: updated.active };
  },

  // ── Carpool (delegate to carpool service for location-wide admin views + force-cancel) ──
  async listCarpoolRides(locationId) {
    return services.carpool.adminListRides(locationId);
  },
  async cancelCarpoolRide(locationId, rideId) {
    return services.carpool.adminCancelRide(locationId, rideId);
  },
  async listCarpoolRequests(locationId) {
    return services.carpool.adminListRequests(locationId);
  },
  async cancelCarpoolRequest(locationId, requestId) {
    return services.carpool.adminCancelRequest(locationId, requestId);
  },
  async listCarpoolSchedules(locationId) {
    return services.carpool.adminListSchedules(locationId);
  },
  async deleteCarpoolSchedule(locationId, scheduleId) {
    return services.carpool.adminDeleteSchedule(locationId, scheduleId);
  },
  async listCarpoolGroups(locationId) {
    return services.carpool.adminListGroups(locationId);
  },
  async deleteCarpoolGroup(locationId, groupId) {
    return services.carpool.adminDeleteGroup(locationId, groupId);
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
      throw new ConflictError(`Could not create the announcement "${body.title}". Please try again.`);
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
  async updateUser(locationId, userId, patch, callerRole) {
    // Only a super-admin may grant super-admin — a site-admin escalating themselves or anyone
    // else to the role that can manage every office would be a privilege-escalation hole.
    if (patch.role === ROLES.SUPER_ADMIN && callerRole !== ROLES.SUPER_ADMIN) {
      throw new AuthorizationError('Only a super admin can grant super admin.');
    }
    // Symmetric guard on the TARGET's existing role: a site-admin sharing an office with a
    // super-admin could otherwise demote, disable, or (via resetWeek) reach into that
    // super-admin's account despite never being granted super-admin themselves.
    if (callerRole !== ROLES.SUPER_ADMIN) {
      const target = await prisma.users.findFirst({ where: { id: userId, location_id: locationId }, select: { role: true } });
      if (target?.role === ROLES.SUPER_ADMIN) {
        throw new AuthorizationError('Only a super admin can modify another super admin.');
      }
    }
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

  /**
   * Admin-driven password reset (no email sending in this deployment): generates a fresh
   * temporary password, sets it directly, and revokes all the user's refresh tokens so any
   * existing sessions are forced to sign in again with it. The plaintext is returned once —
   * the caller (admin UI) must show it to the admin immediately; it is never stored or logged.
   */
  async resetUserPassword(locationId, userId, callerRole) {
    const user = await prisma.users.findFirst({ where: { id: userId, location_id: locationId }, select: { id: true, role: true } });
    if (!user) throw new NotFoundError('User not found');
    if (user.role === ROLES.SUPER_ADMIN && callerRole !== ROLES.SUPER_ADMIN) {
      throw new AuthorizationError('Only a super admin can reset another super admin\'s password.');
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    await prisma.users.update({
      where: { id: userId },
      data: { password_hash: passwordHash, failed_attempts: 0, locked_until: null },
    });
    await prisma.refresh_tokens.updateMany({ where: { user_id: userId }, data: { revoked: true } });

    return { tempPassword };
  },

  /** Admin-delegated account creation: sets email + temp password + role directly, no invite email, no session issued. */
  async createUser(locationId, { email, password, displayName, role }, callerRole) {
    if (role === ROLES.SUPER_ADMIN && callerRole !== ROLES.SUPER_ADMIN) {
      throw new AuthorizationError('Only a super admin can create another super admin.');
    }
    const existing = await prisma.users.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictError('An account with this email already exists');

    const passwordHash = await bcrypt.hash(password, 12);
    let data;
    try {
      data = await prisma.users.create({
        data: {
          location_id: locationId,
          email,
          password_hash: passwordHash,
          display_name: displayName,
          role,
        },
      });
    } catch {
      throw new ConflictError('Could not create the account. Please check the details and try again.');
    }

    try {
      await emit(EVENTS.USER_REGISTERED, { locationId, userId: data.id });
    } catch {
      // Non-fatal: the account is created either way.
    }

    return {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      role: data.role,
      active: data.active,
      createdAt: data.created_at,
    };
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
