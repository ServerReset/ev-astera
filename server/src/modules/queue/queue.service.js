/**
 * Queue service. A single virtual line per location; entries may target a specific charger
 * or "any" (charger_id null). Ordering is priority desc, joined_at asc — carpoolers can be
 * granted priority (see carpool listeners), everyone else is first-come-first-served.
 *
 * Lifecycle: waiting → notified (it's your turn, grace period) → claimed (claim window to
 * actually start a session) → fulfilled. Missed deadlines → skipped (back of the line).
 *
 * advance(locationId, chargerId) is the heart of it and is called from:
 *   - the queue listener on SESSION_ENDED / CHARGER_ONLINE
 *   - transitionExpiredQueueEntries() (compute-on-read replacement for the old
 *     gracePeriodCheck cron) when a notified/claimed entry has expired
 */
import { prisma } from '../../db/prisma.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { configService } from '../../services/config.service.js';
import { BusinessRuleError, ConflictError, NotFoundError, AuthorizationError } from '../../utils/errors.js';
import {
  QUEUE_STATUS,
  SESSION_STATUS,
  CHARGER_STATUS,
  SETTING_KEYS,
} from '../../../../shared/constants.js';
import { addMinutes, now } from '../../utils/timeUtils.js';

const ACTIVE_QUEUE = [QUEUE_STATUS.WAITING, QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED];

/** True if a charger currently has an active/overtime session. */
async function chargerBusy(chargerId) {
  const existing = await prisma.sessions.findFirst({
    where: { charger_id: chargerId, status: { in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME] } },
    select: { id: true },
  });
  return !!existing;
}

/** True if someone already holds a notified/claimed turn for this charger (grace running). */
async function turnInFlight(locationId, chargerId) {
  const existing = await prisma.queue_entries.findFirst({
    where: {
      location_id: locationId,
      charger_id: chargerId,
      status: { in: [QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] },
    },
    select: { id: true },
  });
  return !!existing;
}

export const queueService = {
  /** Everyone waiting/notified/claimed at a location, ordered, with computed positions. */
  async list(locationId) {
    const entries = await prisma.queue_entries.findMany({
      where: { location_id: locationId, status: { in: ACTIVE_QUEUE } },
      include: { users: { select: { display_name: true } } },
      orderBy: [{ priority: 'desc' }, { joined_at: 'asc' }],
    });

    await transitionExpiredQueueEntries(locationId, entries);
    const active = entries.filter((e) => ACTIVE_QUEUE.includes(e.status));

    return active.map((e, i) => ({
      id: e.id,
      position: i + 1,
      chargerId: e.charger_id,
      userId: e.user_id,
      userDisplayName: e.users?.display_name || 'Someone',
      status: e.status,
      priority: e.priority,
      prioritySource: e.priority_source,
      joinedAt: e.joined_at,
      notifiedAt: e.notified_at,
      expiresAt: e.expires_at,
    }));
  },

  /** The calling user's own active queue entry (with live position), or null. */
  async getMine(locationId, userId) {
    const all = await this.list(locationId);
    return all.find((e) => e.userId === userId) || null;
  },

  async join(locationId, userId, chargerId = null) {
    // One active queue entry per user.
    const existing = await prisma.queue_entries.findFirst({
      where: { location_id: locationId, user_id: userId, status: { in: ACTIVE_QUEUE } },
      select: { id: true },
    });
    if (existing) throw new BusinessRuleError("You're already in the queue.");

    // Can't queue while holding an active session.
    const activeSession = await prisma.sessions.findFirst({
      where: { user_id: userId, status: { in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME] } },
      select: { id: true },
    });
    if (activeSession) throw new BusinessRuleError('You already have an active charging session.');

    if (chargerId) {
      const charger = await prisma.chargers.findFirst({
        where: { id: chargerId, location_id: locationId },
        select: { id: true, status: true },
      });
      if (!charger) throw new NotFoundError('Charger not found');
    }

    let data;
    try {
      data = await prisma.queue_entries.create({
        data: { location_id: locationId, charger_id: chargerId, user_id: userId, status: QUEUE_STATUS.WAITING },
      });
    } catch {
      throw new ConflictError('Could not join the queue.');
    }

    await emit(EVENTS.QUEUE_JOINED, { locationId, chargerId, userId, queueEntryId: data.id });

    // If a matching charger is free right now, try to advance immediately.
    if (chargerId && !(await chargerBusy(chargerId))) {
      await this.advance(locationId, chargerId);
    } else if (!chargerId) {
      // "any" — see if any charger is free.
      const chargers = await prisma.chargers.findMany({
        where: { location_id: locationId, status: CHARGER_STATUS.AVAILABLE },
        select: { id: true },
      });
      for (const c of chargers) {
        if (!(await turnInFlight(locationId, c.id)) && !(await chargerBusy(c.id))) {
          await this.advance(locationId, c.id);
          break;
        }
      }
    }
    return this.getMine(locationId, userId);
  },

  async leave(locationId, userId, queueEntryId) {
    const entry = await prisma.queue_entries.findUnique({ where: { id: queueEntryId } });
    if (!entry) throw new NotFoundError('Queue entry not found');
    if (entry.user_id !== userId) throw new AuthorizationError('Not your queue entry');
    if (!ACTIVE_QUEUE.includes(entry.status)) throw new BusinessRuleError('You are not in the queue.');

    const wasHolding = [QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED].includes(entry.status);
    await prisma.queue_entries.update({ where: { id: queueEntryId }, data: { status: QUEUE_STATUS.CANCELLED } });
    await emit(EVENTS.QUEUE_LEFT, { locationId, chargerId: entry.charger_id, userId, queueEntryId });

    // If they were holding a turn, pass it to the next person.
    if (wasHolding && entry.charger_id) await this.advance(locationId, entry.charger_id);
    return { success: true };
  },

  /** Claim a notified turn: locks the claim window during which the user must start a session. */
  async claim(locationId, userId, queueEntryId) {
    const entry = await prisma.queue_entries.findUnique({ where: { id: queueEntryId } });
    if (!entry) throw new NotFoundError('Queue entry not found');
    if (entry.user_id !== userId) throw new AuthorizationError('Not your queue entry');
    if (entry.status !== QUEUE_STATUS.NOTIFIED) {
      throw new BusinessRuleError('This turn is no longer available to claim.');
    }
    const claimWindow = await configService.getNumber(SETTING_KEYS.CLAIM_WINDOW_MINUTES, locationId);
    const data = await prisma.queue_entries.update({
      where: { id: queueEntryId },
      data: {
        status: QUEUE_STATUS.CLAIMED,
        claimed_at: now(),
        expires_at: addMinutes(now(), claimWindow),
      },
    });
    await emit(EVENTS.QUEUE_CLAIMED, { locationId, chargerId: entry.charger_id, userId, queueEntryId });
    return {
      id: data.id,
      chargerId: data.charger_id,
      status: data.status,
      expiresAt: data.expires_at,
    };
  },

  /** Mark a claimed entry fulfilled — called by the session listener when a session starts. */
  async fulfillForUser(userId) {
    await prisma.queue_entries.updateMany({
      where: { user_id: userId, status: { in: [QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] } },
      data: { status: QUEUE_STATUS.FULFILLED },
    });
  },

  /**
   * Advance the queue for a charger that just became (or is) free.
   * No-op if the charger is busy or a turn is already in flight. Otherwise notifies the
   * highest-priority waiting entry (charger-specific or "any") and starts its grace period.
   */
  async advance(locationId, chargerId) {
    if (!chargerId) return { advanced: false };
    if (await chargerBusy(chargerId)) return { advanced: false };
    if (await turnInFlight(locationId, chargerId)) return { advanced: false };

    // Candidates: this charger OR "any" (null). Highest priority, then earliest.
    const candidates = await prisma.queue_entries.findMany({
      where: {
        location_id: locationId,
        status: QUEUE_STATUS.WAITING,
        OR: [{ charger_id: chargerId }, { charger_id: null }],
      },
      orderBy: [{ priority: 'desc' }, { joined_at: 'asc' }],
      take: 1,
    });

    const next = candidates[0];
    if (!next) return { advanced: false };

    const grace = await configService.getNumber(SETTING_KEYS.GRACE_PERIOD_MINUTES, locationId);
    const expiresAt = addMinutes(now(), grace);
    // Bind an "any" entry to this specific charger so the claim/start targets it.
    await prisma.queue_entries.update({
      where: { id: next.id },
      data: {
        status: QUEUE_STATUS.NOTIFIED,
        charger_id: chargerId,
        notified_at: now(),
        expires_at: expiresAt,
      },
    });

    await emit(EVENTS.QUEUE_ADVANCED, {
      locationId,
      chargerId,
      queueEntryId: next.id,
      userId: next.user_id,
      expiresAt: expiresAt.toISOString(),
    });
    return { advanced: true, queueEntryId: next.id, userId: next.user_id };
  },
};

/**
 * Compute-on-read replacement for the old gracePeriodCheck cron: notified/claimed entries
 * whose deadline passed are skipped (back of the line) and the queue advances. Mutates
 * `entries` in place (removing/flagging expired ones) so list()'s caller sees fresh state.
 */
export async function transitionExpiredQueueEntries(locationId, entries) {
  const nowTs = now();
  const expired = entries.filter(
    (e) =>
      [QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED].includes(e.status) &&
      e.expires_at &&
      new Date(e.expires_at) < nowTs
  );
  if (!expired.length) return;

  const chargersToAdvance = new Set();
  for (const entry of expired) {
    await prisma.queue_entries.update({
      where: { id: entry.id },
      data: { status: QUEUE_STATUS.SKIPPED, notified_at: null, expires_at: null },
    });
    entry.status = QUEUE_STATUS.SKIPPED;
    await emit(EVENTS.QUEUE_SKIPPED, {
      locationId: entry.location_id,
      chargerId: entry.charger_id,
      queueEntryId: entry.id,
      userId: entry.user_id,
    });
    if (entry.charger_id) chargersToAdvance.add(entry.charger_id);
  }

  for (const chargerId of chargersToAdvance) {
    await queueService.advance(locationId, chargerId);
  }
}
