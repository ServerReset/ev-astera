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
import { services } from '../../services/index.js';
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
    // Chronically unreliable users (repeated severe overtime) are locked out entirely —
    // a priority penalty alone wouldn't stop them from still occupying a spot.
    if (await services.reliability.isLockedOut(userId, locationId)) {
      const { lockedUntil } = await services.reliability.getScore(userId, locationId);
      throw new BusinessRuleError(
        `Your account is temporarily restricted from joining the queue due to low reliability. Try again after ${new Date(lockedUntil).toLocaleString()}.`
      );
    }

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

    // Reliability contributes an additive priority component from the start (carpool's
    // component is granted later, on CARPOOL_BOOKING_CONFIRMED — see carpool/listeners.js).
    const baseline = await configService.getNumber(SETTING_KEYS.RELIABILITY_BASELINE, locationId);
    const weight = await configService.getNumber(SETTING_KEYS.RELIABILITY_QUEUE_WEIGHT, locationId);
    const { score } = (await services.reliability.getScore(userId, locationId)) || { score: baseline };
    const reliabilityDelta = Math.round((score - baseline) * weight);

    let data;
    try {
      data = await prisma.queue_entries.create({
        data: {
          location_id: locationId,
          charger_id: chargerId,
          preferred_charger_id: chargerId,
          user_id: userId,
          status: QUEUE_STATUS.WAITING,
          reliability_priority_delta: reliabilityDelta,
          priority: reliabilityDelta,
          priority_source: reliabilityDelta !== 0 ? 'reliability' : null,
        },
      });
    } catch {
      throw new ConflictError('Could not join the queue for this charger. Please try again.');
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
   *
   * Two chargers freeing up near-simultaneously can both pick the same top "any" candidate
   * before either writes back — the update is therefore conditioned on the row still being
   * WAITING (`updateMany` + checking `count`), so only the first writer actually wins the
   * entry; a loser retries against the next-best remaining candidate instead of silently
   * overwriting the winner's charger_id and sending a notification for a charger the entry
   * doesn't actually end up bound to.
   */
  async advance(locationId, chargerId, _excludeIds = []) {
    if (!chargerId) return { advanced: false };
    if (await chargerBusy(chargerId)) return { advanced: false };
    if (await turnInFlight(locationId, chargerId)) return { advanced: false };

    // Candidates: this charger OR "any" (null). Highest priority, then earliest.
    const candidates = await prisma.queue_entries.findMany({
      where: {
        location_id: locationId,
        status: QUEUE_STATUS.WAITING,
        id: { notIn: _excludeIds },
        OR: [{ charger_id: chargerId }, { charger_id: null }],
      },
      orderBy: [{ priority: 'desc' }, { joined_at: 'asc' }],
      take: 1,
    });

    const next = candidates[0];
    if (!next) return { advanced: false };

    const grace = await configService.getNumber(SETTING_KEYS.GRACE_PERIOD_MINUTES, locationId);
    const expiresAt = addMinutes(now(), grace);
    // Bind an "any" entry to this specific charger so the claim/start targets it. Conditioned
    // on status still being WAITING — if a concurrent advance() call already won this row
    // (e.g. for a different charger), this updateMany affects 0 rows and we fall through to
    // retry against the next candidate rather than clobbering the winner's write.
    const { count } = await prisma.queue_entries.updateMany({
      where: { id: next.id, status: QUEUE_STATUS.WAITING },
      data: {
        status: QUEUE_STATUS.NOTIFIED,
        charger_id: chargerId,
        notified_at: now(),
        expires_at: expiresAt,
      },
    });
    if (count === 0) {
      return this.advance(locationId, chargerId, [..._excludeIds, next.id]);
    }

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
 * whose deadline passed are skipped, then — unless they've already been auto-requeued
 * QUEUE_MAX_AUTO_REQUEUES times — genuinely put back at the end of the line with a fresh
 * `joined_at`, carrying over their earned priority (a lapsed claim window isn't the user's
 * fault in a way that should cost them a carpool/reliability boost). This is what makes the
 * "moved to the back of the queue" notification copy actually true. Mutates `entries` in
 * place (removing/flagging expired ones, and appending the replacement row) so list()'s
 * caller sees fresh state without a second DB round-trip.
 *
 * The SKIP + replacement-create for a single entry runs inside one `$transaction` — without
 * that, a process kill between the two writes (this app's own eventBus.js notes the Vercel
 * serverless runtime can freeze right after a response is sent) would leave the user SKIPPED
 * with no replacement row and no way to ever be revisited, since nothing re-scans SKIPPED rows.
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

  const maxAutoRequeues = await configService.getNumber(SETTING_KEYS.QUEUE_MAX_AUTO_REQUEUES, locationId);
  const chargersToAdvance = new Set();
  for (const entry of expired) {
    const willRequeue = entry.requeue_count < maxAutoRequeues;
    // Restore the user's original preference (a specific charger, or "any") rather than the
    // concrete charger_id they happened to be pinned to when notified — see the
    // preferred_charger_id doc comment on the model for why these two can now differ.
    const [, replacement] = await prisma.$transaction([
      prisma.queue_entries.update({
        where: { id: entry.id },
        data: { status: QUEUE_STATUS.SKIPPED, notified_at: null, expires_at: null },
      }),
      ...(willRequeue
        ? [
            prisma.queue_entries.create({
              data: {
                location_id: entry.location_id,
                charger_id: entry.preferred_charger_id,
                preferred_charger_id: entry.preferred_charger_id,
                user_id: entry.user_id,
                status: QUEUE_STATUS.WAITING,
                priority: entry.priority,
                priority_source: entry.priority_source,
                carpool_priority_delta: entry.carpool_priority_delta,
                reliability_priority_delta: entry.reliability_priority_delta,
                requeue_count: entry.requeue_count + 1,
              },
            }),
          ]
        : []),
    ]);

    entry.status = QUEUE_STATUS.SKIPPED;
    await emit(EVENTS.QUEUE_SKIPPED, {
      locationId: entry.location_id,
      chargerId: entry.charger_id,
      queueEntryId: entry.id,
      userId: entry.user_id,
    });

    if (replacement) entries.push({ ...replacement, users: entry.users });
    // Re-advance whatever charger this entry had been pinned to — it's free again since the
    // user never claimed it (not the replacement's restored preference, which may be "any").
    if (entry.charger_id) chargersToAdvance.add(entry.charger_id);
  }

  for (const chargerId of chargersToAdvance) {
    await queueService.advance(locationId, chargerId);
  }
}
