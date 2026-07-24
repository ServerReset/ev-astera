/**
 * Reliability score service: a persisted per-user score (baseline 100) that goes up for
 * carpool driving and ending a session without going over, and down — increasingly steeply
 * the longer it runs — for overtime. Drives an additive queue-priority component (see
 * queue.service.js) and can hard-lock a chronically bad user out of the queue entirely.
 *
 * Score reads are "compute on read": every read first applies passive decay toward baseline
 * (so neither punishment nor reward is permanent absent new behavior) and persists the result,
 * mirroring session.service.js's transitionOvertimeSessions() pattern.
 */
import { prisma } from '../../db/prisma.js';
import { configService } from '../../services/config.service.js';
import { SETTING_KEYS } from '../../../../shared/constants.js';
import { now } from '../../utils/timeUtils.js';

const RELIABILITY_EVENT = {
  OVERTIME_PENALTY: 'overtime_penalty',
  FAST_UNPLUG_BONUS: 'fast_unplug_bonus',
  CARPOOL_DRIVER_BONUS: 'carpool_driver_bonus',
  LOCKOUT_TRIGGERED: 'lockout_triggered',
};

/** Escalating-cost overtime penalty: minute 1 past grace costs `perMinute`, minute 2 costs
 * `perMinute * factor`, etc. — a geometric series closed form so long overtimes cost
 * disproportionately more than short ones, using only 3 admin-tunable numbers. */
export function computeOvertimePenalty(overtimeMinutes, { graceMinutes, perMinute, factor }) {
  if (overtimeMinutes <= graceMinutes) return 0;
  const excess = overtimeMinutes - graceMinutes;
  if (factor === 1) return perMinute * excess;
  return perMinute * (factor ** excess - 1) / (factor - 1);
}

async function applyDecay(user, locationId) {
  if (!user.last_reliability_event_at) return user;
  const baseline = await configService.getNumber(SETTING_KEYS.RELIABILITY_BASELINE, locationId);
  const decayPerDay = await configService.getNumber(SETTING_KEYS.RELIABILITY_DECAY_PER_DAY, locationId);
  const daysSince = (now().getTime() - new Date(user.last_reliability_event_at).getTime()) / 86_400_000;
  if (daysSince <= 0 || decayPerDay <= 0) return user;

  const distance = baseline - user.reliability_score;
  const drift = Math.sign(distance) * Math.min(Math.abs(distance), decayPerDay * daysSince);
  if (drift === 0) return user;

  const newScore = user.reliability_score + drift;
  await prisma.users.update({ where: { id: user.id }, data: { reliability_score: newScore } });
  return { ...user, reliability_score: newScore };
}

export const reliabilityService = {
  /** Current (decayed, write-back) score + lockout state for a user. */
  async getScore(userId, locationId) {
    let user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, reliability_score: true, reliability_locked_until: true, last_reliability_event_at: true },
    });
    if (!user) return null;
    user = await applyDecay(user, locationId);
    return { score: user.reliability_score, lockedUntil: user.reliability_locked_until };
  },

  /** True if the user is currently hard-locked out of the queue. */
  async isLockedOut(userId, locationId) {
    const { lockedUntil } = (await this.getScore(userId, locationId)) || {};
    return Boolean(lockedUntil && new Date(lockedUntil) > now());
  },

  /**
   * Apply a signed delta to a user's score: decays first, adds delta, clamps, checks the
   * lockout threshold, writes the ledger row, persists the user, and — if the user currently
   * holds an active queue entry — refreshes its reliability_priority_delta/priority so the
   * effect is immediate, not just visible on next join.
   */
  async applyEvent(locationId, userId, type, delta, { sessionId = null, metadata = {} } = {}) {
    if (!delta) return null;
    let user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, reliability_score: true, reliability_locked_until: true, last_reliability_event_at: true },
    });
    if (!user) return null;
    user = await applyDecay(user, locationId);

    const newScore = Math.max(0, Math.min(200, user.reliability_score + delta));
    const lockoutThreshold = await configService.getNumber(SETTING_KEYS.RELIABILITY_LOCKOUT_THRESHOLD, locationId);
    const alreadyLocked = user.reliability_locked_until && new Date(user.reliability_locked_until) > now();
    const triggersLockout = newScore <= lockoutThreshold && !alreadyLocked;

    const data = { reliability_score: newScore, last_reliability_event_at: now() };
    if (triggersLockout) {
      const lockoutHours = await configService.getNumber(SETTING_KEYS.RELIABILITY_LOCKOUT_DURATION_HOURS, locationId);
      data.reliability_locked_until = new Date(now().getTime() + lockoutHours * 3_600_000);
    }

    await prisma.users.update({ where: { id: userId }, data });
    await prisma.reliability_events.create({
      data: { user_id: userId, type, delta, score_after: newScore, session_id: sessionId, metadata },
    });
    if (triggersLockout) {
      await prisma.reliability_events.create({
        data: {
          user_id: userId,
          type: RELIABILITY_EVENT.LOCKOUT_TRIGGERED,
          delta: 0,
          score_after: newScore,
          session_id: sessionId,
          metadata: { threshold: lockoutThreshold },
        },
      });
    }

    await this.refreshQueuePriority(locationId, userId, newScore);
    return { score: newScore, lockedUntil: data.reliability_locked_until || user.reliability_locked_until };
  },

  /** Recompute a user's active queue entry's reliability_priority_delta from their current
   * score, and resum priority = carpool_priority_delta + reliability_priority_delta. No-op if
   * the user has no active entry. */
  async refreshQueuePriority(locationId, userId, score) {
    const entry = await prisma.queue_entries.findFirst({
      where: { location_id: locationId, user_id: userId, status: { in: ['waiting', 'notified', 'claimed'] } },
      select: { id: true, carpool_priority_delta: true },
    });
    if (!entry) return;
    const baseline = await configService.getNumber(SETTING_KEYS.RELIABILITY_BASELINE, locationId);
    const weight = await configService.getNumber(SETTING_KEYS.RELIABILITY_QUEUE_WEIGHT, locationId);
    const reliabilityDelta = Math.round((score - baseline) * weight);
    await prisma.queue_entries.update({
      where: { id: entry.id },
      data: {
        reliability_priority_delta: reliabilityDelta,
        priority: entry.carpool_priority_delta + reliabilityDelta,
      },
    });
  },

  /** Best/worst performers for the leaderboard. Applies lazy decay to every candidate first
   * so the ranking reflects current, not stale, scores. */
  async leaderboard(locationId, { limit = 10 } = {}) {
    const users = await prisma.users.findMany({
      where: { location_id: locationId, active: true },
      select: {
        id: true,
        display_name: true,
        reliability_score: true,
        reliability_locked_until: true,
        last_reliability_event_at: true,
      },
    });
    const decayed = await Promise.all(users.map((u) => applyDecay(u, locationId)));
    const rows = decayed
      .map((u) => ({
        userId: u.id,
        name: u.display_name,
        score: Math.round(u.reliability_score * 10) / 10,
        lockedOut: Boolean(u.reliability_locked_until && new Date(u.reliability_locked_until) > now()),
      }))
      .sort((a, b) => b.score - a.score);

    // Keep top/bottom strictly disjoint: with a small user base (< 2*limit), a naive
    // slice(0, limit) + slice(-limit) would show the same people in both panels — including
    // the single best scorer appearing at the tail of "Needs improvement" and vice versa.
    // Math.floor (not ceil) guarantees the two halves never overlap — any odd-one-out middle
    // row is simply excluded from both, which is correct: it's neither best nor worst.
    // (Guard splitAt === 0 explicitly: `rows.slice(-0)` is `-0 === 0`, which JS treats as
    // "no negative offset" and returns the WHOLE array, not an empty one.)
    const splitAt = Math.min(limit, Math.floor(rows.length / 2));
    return {
      top: rows.slice(0, splitAt),
      bottom: splitAt === 0 ? [] : rows.slice(-splitAt).reverse(),
    };
  },
};

export { RELIABILITY_EVENT };
