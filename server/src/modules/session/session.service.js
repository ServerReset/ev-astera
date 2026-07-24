/**
 * Session service: start / update ETA / end, with business-rule enforcement:
 *   - max weekly sessions
 *   - max session hours
 *   - one active session per user
 *   - race-safe charger claim (unique partial index + conflict handling)
 *
 * transitionOvertimeSessions() is the compute-on-read replacement for the old overtimeCheck
 * cron: called from getActive() and charger.service.listWithState() so overtime status and
 * its admin-alert escalation are always current by the time anyone reads session state.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { configService } from '../../services/config.service.js';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  AuthorizationError,
} from '../../utils/errors.js';
import {
  SESSION_STATUS,
  CHARGER_STATUS,
  SETTING_KEYS,
} from '../../../../shared/constants.js';
import { addMinutes, startOfWeek, now, diffMinutes } from '../../utils/timeUtils.js';

async function assertWeeklyLimit(userId, locationId) {
  const max = await configService.getNumber(SETTING_KEYS.MAX_WEEKLY_SESSIONS, locationId);
  const weekStart = startOfWeek(now());
  const count = await prisma.sessions.count({
    where: { user_id: userId, started_at: { gte: weekStart } },
  });
  if (count >= max) {
    throw new BusinessRuleError(`You've used all ${max} sessions this week. Resets Monday.`, {
      rule: SETTING_KEYS.MAX_WEEKLY_SESSIONS,
      current: count,
      max,
    });
  }
}

async function assertNoActiveSession(userId) {
  const existing = await prisma.sessions.findFirst({
    where: { user_id: userId, status: { in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME] } },
    select: { id: true },
  });
  if (existing) throw new BusinessRuleError('You already have an active charging session.');
}

/**
 * For each active/overtime session past its eta_at: flip session+charger to overtime (once),
 * then escalate to admins once minutes-over crosses the configured threshold. Mutates each
 * session object in place so callers see up-to-date status without a re-fetch.
 */
export async function transitionOvertimeSessions(sessions) {
  for (const s of sessions) {
    if (![SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME].includes(s.status)) continue;
    const minutesOver = diffMinutes(s.eta_at, now());
    if (minutesOver <= 0) continue;

    if (s.status !== SESSION_STATUS.OVERTIME) {
      await prisma.sessions.update({ where: { id: s.id }, data: { status: SESSION_STATUS.OVERTIME } });
      await prisma.chargers.update({ where: { id: s.charger_id }, data: { status: CHARGER_STATUS.OVERTIME } });
      s.status = SESSION_STATUS.OVERTIME;
      await emit(EVENTS.SESSION_OVERTIME, {
        locationId: s.location_id,
        sessionId: s.id,
        chargerId: s.charger_id,
        userId: s.user_id,
        minutesOver,
      });
    }

    const adminAlertMin = await configService.getNumber(SETTING_KEYS.OVERTIME_ADMIN_ALERT_MINUTES, s.location_id);
    if (minutesOver >= adminAlertMin && !s.overtime_notified_at) {
      const notifiedAt = now();
      await prisma.sessions.update({ where: { id: s.id }, data: { overtime_notified_at: notifiedAt } });
      s.overtime_notified_at = notifiedAt;
      await emit(EVENTS.SESSION_OVERTIME_ESCALATED, {
        locationId: s.location_id,
        sessionId: s.id,
        chargerId: s.charger_id,
        userId: s.user_id,
        minutesOver,
      });
    }
  }
  return sessions;
}

export const sessionService = {
  async start(locationId, userId, { chargerId, durationMinutes, vehicleDescription }) {
    const maxHours = await configService.getNumber(SETTING_KEYS.MAX_SESSION_HOURS, locationId);
    if (durationMinutes > maxHours * 60) {
      throw new BusinessRuleError(`Maximum session is ${maxHours} hours.`, {
        rule: SETTING_KEYS.MAX_SESSION_HOURS,
        max: maxHours * 60,
      });
    }

    // Charger must exist & be available.
    const charger = await prisma.chargers.findFirst({
      where: { id: chargerId, location_id: locationId },
    });
    if (!charger) throw new NotFoundError('Charger not found');
    if (charger.status === CHARGER_STATUS.OFFLINE) throw new BusinessRuleError('This charger is offline.');

    await assertNoActiveSession(userId);
    await assertWeeklyLimit(userId, locationId);

    const etaAt = addMinutes(now(), durationMinutes);
    let data;
    try {
      data = await prisma.sessions.create({
        data: {
          location_id: locationId,
          charger_id: chargerId,
          user_id: userId,
          status: SESSION_STATUS.ACTIVE,
          vehicle_description: vehicleDescription || null,
          started_at: now(),
          eta_at: etaAt,
        },
      });
    } catch (err) {
      // Unique partial index violation => someone else already charging here.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('Someone just started charging on this charger.');
      }
      throw new ConflictError('Could not start session.');
    }

    await prisma.chargers.update({ where: { id: chargerId }, data: { status: CHARGER_STATUS.IN_USE } });

    await emit(EVENTS.SESSION_STARTED, {
      locationId,
      sessionId: data.id,
      chargerId,
      userId,
      etaAt: data.eta_at,
    });
    return data;
  },

  async getActive(userId) {
    const session = await prisma.sessions.findFirst({
      where: { user_id: userId, status: { in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME] } },
      include: { chargers: { select: { name: true } } },
    });
    if (!session) return null;
    await transitionOvertimeSessions([session]);
    return session;
  },

  async updateEta(locationId, userId, sessionId, durationMinutes) {
    const s = await prisma.sessions.findUnique({ where: { id: sessionId } });
    if (!s) throw new NotFoundError('Session not found');
    if (s.user_id !== userId) throw new AuthorizationError('Not your session');
    if (![SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME].includes(s.status)) {
      throw new BusinessRuleError('Session is not active.');
    }
    const maxHours = await configService.getNumber(SETTING_KEYS.MAX_SESSION_HOURS, locationId);
    const newEta = addMinutes(new Date(s.started_at), durationMinutes);
    if (diffMinutes(s.started_at, newEta) > maxHours * 60) {
      throw new BusinessRuleError(`Total session cannot exceed ${maxHours} hours from start.`);
    }

    const patch = { eta_at: newEta };
    // If new ETA is in the future, clear overtime.
    if (newEta > now() && s.status === SESSION_STATUS.OVERTIME) {
      patch.status = SESSION_STATUS.ACTIVE;
      patch.overtime_notified_at = null;
      await prisma.chargers.update({ where: { id: s.charger_id }, data: { status: CHARGER_STATUS.IN_USE } });
    }
    const data = await prisma.sessions.update({ where: { id: sessionId }, data: patch });
    await emit(EVENTS.SESSION_UPDATED, { locationId, sessionId, chargerId: s.charger_id, userId, etaAt: data.eta_at });
    return data;
  },

  async end(locationId, userId, sessionId) {
    const s = await prisma.sessions.findUnique({ where: { id: sessionId } });
    if (!s) throw new NotFoundError('Session not found');
    if (s.user_id !== userId) throw new AuthorizationError('Not your session');
    if (![SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME].includes(s.status)) {
      throw new BusinessRuleError('Session already ended.');
    }
    const endedAt = now();
    await prisma.sessions.update({
      where: { id: sessionId },
      data: { status: SESSION_STATUS.COMPLETED, ended_at: endedAt },
    });
    await prisma.chargers.update({ where: { id: s.charger_id }, data: { status: CHARGER_STATUS.AVAILABLE } });

    await emit(EVENTS.SESSION_ENDED, {
      locationId,
      sessionId,
      chargerId: s.charger_id,
      userId,
      etaAt: s.eta_at,
      endedAt,
    });
    return { success: true };
  },

  /** Admin force-end. */
  async forceEnd(locationId, sessionId, adminId) {
    const s = await prisma.sessions.findUnique({ where: { id: sessionId } });
    if (!s) throw new NotFoundError('Session not found');
    const endedAt = now();
    await prisma.sessions.update({
      where: { id: sessionId },
      data: { status: SESSION_STATUS.FORCE_ENDED, ended_at: endedAt },
    });
    await prisma.chargers.update({ where: { id: s.charger_id }, data: { status: CHARGER_STATUS.AVAILABLE } });
    await emit(EVENTS.SESSION_FORCE_ENDED, {
      locationId,
      sessionId,
      chargerId: s.charger_id,
      userId: s.user_id,
      adminId,
    });
    // Also emit SESSION_ENDED so the queue advances and reliability scoring applies — a
    // force-end almost always means the user overstayed, so it should count the same as a
    // self-ended overtime session, not be exempt from the penalty.
    await emit(EVENTS.SESSION_ENDED, {
      locationId,
      sessionId,
      chargerId: s.charger_id,
      userId: s.user_id,
      etaAt: s.eta_at,
      endedAt,
    });
    return { success: true };
  },
};
