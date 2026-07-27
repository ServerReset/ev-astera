/**
 * Achievement service: grants badges and reads a user's badge wall.
 *
 * Grants are idempotent by construction — `unlock()` relies on the user_achievements
 * @@unique([user_id, achievement_key]) constraint via createMany({ skipDuplicates: true }),
 * so a re-fired event (double-tap, listener retry, a force-end that re-emits SESSION_ENDED)
 * can never grant the same badge twice, and only a genuinely-new row emits ACHIEVEMENT_UNLOCKED.
 *
 * Progress for the locked-state UI is computed on read from tables that already exist (no new
 * counters): sessions, carpool_trip_logs, messages, queue_entries, and the reliability score.
 */
import { prisma } from '../../db/prisma.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { logger } from '../../utils/logger.js';
import { ACHIEVEMENTS, ACHIEVEMENTS_BY_KEY, COUNT_METRICS, isCountMetric } from '../../../../shared/achievements.js';
import { reliabilityService } from '../reliability/reliability.service.js';

/**
 * Grant one badge to a user. No-op (returns false) if they already have it. On a genuine new
 * unlock, emits ACHIEVEMENT_UNLOCKED so the notification listener can celebrate it. Swallows a
 * missing-table/model error (returns false) so a not-yet-migrated deploy can't turn an ordinary
 * domain event (session start, trip complete) into a listener error storm.
 */
async function unlock(locationId, userId, key, metadata = {}) {
  if (!ACHIEVEMENTS_BY_KEY[key]) return false; // guard against a typo'd key
  let count = 0;
  try {
    ({ count } = await prisma.user_achievements.createMany({
      data: [{ location_id: locationId, user_id: userId, achievement_key: key, metadata }],
      skipDuplicates: true,
    }));
  } catch (err) {
    logger.error('achievement unlock: user_achievements unavailable', { key, message: err.message });
    return false;
  }
  if (count === 0) return false; // already had it
  await emit(EVENTS.ACHIEVEMENT_UNLOCKED, { locationId, userId, key });
  return true;
}

/**
 * Current value of the requested count-metrics for a user (also powers the locked-state progress
 * bars). `wanted` limits which queries run so the hot event-driven path (checkCounts) only touches
 * the tables whose metric actually changed. Note 'reliability' resolves via getScore(), which is
 * now READ-ONLY (computes passive decay in memory, no DB write — see reliability.service.js). On a
 * SESSION_ENDED cascade the reliability listener has just persisted the fresh score via applyEvent;
 * this getScore is a second read of that row, but no longer a second write. The badge-wall read
 * (listForUser) intentionally requests it so the reliable_pro progress bar can render.
 * @param {string[]} [wanted]  metric keys to compute; omit for all (used by the badge-wall read).
 */
async function computeCountMetrics(userId, locationId, wanted = COUNT_METRICS) {
  const want = (m) => wanted.includes(m);
  const [sessions, trips, co2Agg, nudges, queueClaims, reliability] = await Promise.all([
    want('sessions') ? prisma.sessions.count({ where: { user_id: userId } }) : null,
    want('trips') ? prisma.carpool_trip_logs.count({ where: { user_id: userId } }) : null,
    want('co2_kg') ? prisma.carpool_trip_logs.aggregate({ where: { user_id: userId }, _sum: { co2_grams_saved: true } }) : null,
    want('nudges') ? prisma.messages.count({ where: { sender_id: userId, kind: 'nudge' } }) : null,
    want('queue_claims') ? prisma.queue_entries.count({ where: { user_id: userId, claimed_at: { not: null } } }) : null,
    want('reliability') ? reliabilityService.getScore(userId, locationId) : null,
  ]);
  return {
    sessions: sessions ?? 0,
    trips: trips ?? 0,
    co2_kg: Math.round(((co2Agg?._sum.co2_grams_saved || 0) / 1000) * 10) / 10,
    nudges: nudges ?? 0,
    queue_claims: queueClaims ?? 0,
    reliability: reliability?.score ?? 0,
  };
}

export const achievementService = {
  unlock,

  /**
   * Evaluate every count-based achievement for the given metrics and unlock any that are met.
   * Called from listeners after a count-changing event (session start, trip, nudge, queue claim).
   * @param {string[]} metrics  which count metrics changed — only those achievements are checked
   */
  async checkCounts(locationId, userId, metrics) {
    const values = await computeCountMetrics(userId, locationId, metrics);
    for (const a of ACHIEVEMENTS) {
      if (!isCountMetric(a.metric) || !metrics.includes(a.metric)) continue;
      if (values[a.metric] >= a.target) {
        await unlock(locationId, userId, a.key, { value: values[a.metric] });
      }
    }
  },

  /** Grant a single event-based achievement (early_bird, night_owl, perfect_finish, match, ...). */
  async grant(locationId, userId, key, metadata = {}) {
    return unlock(locationId, userId, key, metadata);
  },

  /**
   * The full badge wall for one user: every catalog entry with its unlocked state, unlock date,
   * and (for count metrics) progress toward the target. Locked catalog entries are included so
   * the UI can show greyed silhouettes with "3 / 10" hints.
   */
  async listForUser(userId, locationId) {
    // Degrade gracefully if the user_achievements table/model isn't available yet (e.g. the
    // Prisma client hasn't been regenerated after adding the model, or the migration hasn't been
    // applied): show the catalog with nothing unlocked rather than 500-ing the whole page.
    const fetchRows = async () => {
      try {
        return await prisma.user_achievements.findMany({
          where: { user_id: userId },
          select: { achievement_key: true, created_at: true },
        });
      } catch (err) {
        logger.error('achievement listForUser: user_achievements unavailable', { message: err.message });
        return [];
      }
    };
    const [rows, values] = await Promise.all([fetchRows(), computeCountMetrics(userId, locationId)]);
    const unlockedAt = new Map(rows.map((r) => [r.achievement_key, r.created_at]));

    const items = ACHIEVEMENTS.map((a) => {
      const unlocked = unlockedAt.has(a.key);
      const item = {
        key: a.key,
        label: a.label,
        description: a.description,
        icon: a.icon,
        tier: a.tier,
        unlocked,
        unlockedAt: unlocked ? unlockedAt.get(a.key) : null,
      };
      if (isCountMetric(a.metric)) {
        item.progress = { current: Math.min(values[a.metric], a.target), target: a.target };
      }
      return item;
    });

    return {
      items,
      unlockedCount: rows.length,
      total: ACHIEVEMENTS.length,
    };
  },
};
