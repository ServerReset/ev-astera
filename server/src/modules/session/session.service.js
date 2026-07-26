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
  QUEUE_STATUS,
  SETTING_KEYS,
} from '../../../../shared/constants.js';
import { addMinutes, startOfWeek, now, diffMinutes } from '../../utils/timeUtils.js';

async function assertWeeklyLimit(userId, locationId, tz) {
  const max = await configService.getNumber(SETTING_KEYS.MAX_WEEKLY_SESSIONS, locationId);
  const weekStart = startOfWeek(now(), tz);
  // Scope the count to THIS office: the max is per-location, so the count must be too. Without the
  // location_id filter a user with sessions in more than one office (a super-admin travelling
  // between sites) is counted globally and wrongly told they're over-cap at an office they've
  // barely used.
  const count = await prisma.sessions.count({
    where: { user_id: userId, location_id: locationId, started_at: { gte: weekStart } },
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
    // Direct timestamp comparison (not a rounded whole-minute diff): with Math.round, a session
    // in its first ~29s past ETA rounded to 0 and stayed "on time", delaying the overtime flip.
    if (now() <= new Date(s.eta_at)) continue;
    const minutesOver = diffMinutes(s.eta_at, now());

    if (s.status !== SESSION_STATUS.OVERTIME) {
      // Conditional flip: only the writer that actually transitions the row (status still ACTIVE)
      // gets count === 1 and emits. Two concurrent reads (dashboard fires listWithState + getActive
      // in the same tick) each loaded status=active, but only one UPDATE matches — the other's
      // count is 0, so it doesn't double-emit SESSION_OVERTIME. Mirrors queue.advance()'s pattern.
      const { count } = await prisma.sessions.updateMany({
        where: { id: s.id, status: SESSION_STATUS.ACTIVE },
        data: { status: SESSION_STATUS.OVERTIME },
      });
      s.status = SESSION_STATUS.OVERTIME;
      if (count === 1) {
        // Don't overwrite an admin's OFFLINE flag with OVERTIME (see freeChargerUnlessOffline).
        await prisma.chargers.updateMany({
          where: { id: s.charger_id, NOT: { status: CHARGER_STATUS.OFFLINE } },
          data: { status: CHARGER_STATUS.OVERTIME },
        });
        await emit(EVENTS.SESSION_OVERTIME, {
          locationId: s.location_id,
          sessionId: s.id,
          chargerId: s.charger_id,
          userId: s.user_id,
          minutesOver,
        });
      }
    }

    const adminAlertMin = await configService.getNumber(SETTING_KEYS.OVERTIME_ADMIN_ALERT_MINUTES, s.location_id);
    if (minutesOver >= adminAlertMin && !s.overtime_notified_at) {
      const notifiedAt = now();
      // Same conditional-write guard: only the first writer to set overtime_notified_at (still
      // null) emits the admin escalation, so concurrent reads can't double-alert admins.
      const { count } = await prisma.sessions.updateMany({
        where: { id: s.id, overtime_notified_at: null },
        data: { overtime_notified_at: notifiedAt },
      });
      s.overtime_notified_at = notifiedAt;
      if (count === 1) {
        await emit(EVENTS.SESSION_OVERTIME_ESCALATED, {
          locationId: s.location_id,
          sessionId: s.id,
          chargerId: s.charger_id,
          userId: s.user_id,
          minutesOver,
        });
      }
    }
  }
  return sessions;
}

/**
 * Free a charger when a session ends — but never clobber an admin's OFFLINE flag. An admin can
 * mark a charger offline while it's occupied; when the occupant then ends, an unconditional flip
 * to AVAILABLE would silently revert that (and re-expose an unsafe charger for the next user). The
 * NOT-offline guard leaves an offline charger offline; a healthy charger becomes available.
 */
async function freeChargerUnlessOffline(chargerId) {
  await prisma.chargers.updateMany({
    where: { id: chargerId, NOT: { status: CHARGER_STATUS.OFFLINE } },
    data: { status: CHARGER_STATUS.AVAILABLE },
  });
}

export const sessionService = {
  /** Real admin-configured bounds, so the client's slider/pre-check never desyncs from what
   * the server actually enforces (see shared/validation.js's durationMinutesSchema comment). */
  async getConfig(locationId) {
    const maxSessionHours = await configService.getNumber(SETTING_KEYS.MAX_SESSION_HOURS, locationId);
    return { maxSessionMinutes: maxSessionHours * 60 };
  },

  async start(locationId, tz, userId, { chargerId, durationMinutes, vehicleDescription }) {
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

    // Respect an in-flight queue turn: if someone else holds a NOTIFIED/CLAIMED turn on this
    // charger (their grace/claim window is running), the charger is reserved for them even though
    // it has no active session yet and thus reads AVAILABLE on the board. Without this check any
    // passer-by could "steal" the charger the queue just handed to the next person. The turn's own
    // holder is allowed through (that's exactly them claiming it).
    const heldTurn = await prisma.queue_entries.findFirst({
      where: {
        location_id: locationId,
        charger_id: chargerId,
        status: { in: [QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] },
      },
      select: { user_id: true },
    });
    if (heldTurn && heldTurn.user_id !== userId) {
      throw new ConflictError('This charger is reserved for the next person in the queue.');
    }

    await assertNoActiveSession(userId);
    await assertWeeklyLimit(userId, locationId, tz);

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
      // Partial unique-index violations close the two TOCTOU races the app-level checks above
      // can't (concurrent starts slipping between SELECT and INSERT):
      //   - uniq_active_session_per_charger → two people racing for the same charger
      //   - uniq_active_session_per_user    → one user double-tapping two different chargers
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = Array.isArray(err.meta?.target) ? err.meta.target.join(',') : String(err.meta?.target || '');
        if (target.includes('user')) {
          throw new ConflictError('You already have an active charging session.');
        }
        throw new ConflictError('Someone just started charging on this charger.');
      }
      // Don't mask a DB-connectivity failure as a "conflict" — let the global handler classify it
      // (→ 503 DATABASE_UNAVAILABLE) so the user sees the honest cause.
      if (err?.name?.startsWith('PrismaClient')) throw err;
      throw new ConflictError("Couldn't start your charging session — the charger may have just changed state. Refresh the dashboard and try again.");
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
    await freeChargerUnlessOffline(s.charger_id);

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
    // Conditional terminal-status guard: only the call that actually transitions a live session
    // proceeds to emit. Without this, a double-click (or duplicate request) on an already-ended
    // session re-emits SESSION_ENDED — and the reliability listener isn't idempotent per session,
    // so the user would be penalized twice and the queue would advance twice. Mirrors end()'s guard.
    const { count } = await prisma.sessions.updateMany({
      where: { id: sessionId, status: { in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME] } },
      data: { status: SESSION_STATUS.FORCE_ENDED, ended_at: endedAt },
    });
    if (count === 0) throw new BusinessRuleError('Session already ended.');
    await freeChargerUnlessOffline(s.charger_id);
    await emit(EVENTS.SESSION_FORCE_ENDED, {
      locationId,
      sessionId,
      chargerId: s.charger_id,
      userId: s.user_id,
      adminId,
    });
    // Also emit SESSION_ENDED so the queue advances and reliability scoring applies — a
    // force-end almost always means the user overstayed, so it should count the same as a
    // self-ended overtime session, not be exempt from the penalty. `forced: true` marks this as
    // an admin action so listeners that only make sense for a genuine self-finish (e.g. the
    // perfect_finish achievement) can skip it — a user terminated early by an admin did NOT
    // finish on time and shouldn't be rewarded for it.
    await emit(EVENTS.SESSION_ENDED, {
      locationId,
      sessionId,
      chargerId: s.charger_id,
      userId: s.user_id,
      etaAt: s.eta_at,
      endedAt,
      forced: true,
    });
    return { success: true };
  },
};
