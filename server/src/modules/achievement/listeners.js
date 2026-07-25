/**
 * Achievement listeners: the ONLY place that decides when a badge unlocks. Every other module
 * just emits its normal domain events (session started/ended, trip completed, nudge sent/reacted,
 * queue claimed, match found) — this file reacts to them, so achievement logic never leaks into
 * the flows it observes (same decoupling rule as reliability/listeners.js).
 *
 * Count-based badges (sessions, trips, co2, nudges, queue claims, reliability) are re-evaluated
 * from live tables on every relevant event via achievementService.checkCounts(); event-based
 * badges (early_bird, night_owl, perfect_finish, peacemaker, match) are granted inline. All
 * grants are idempotent (see achievement.service.js), so re-fired events never double-grant.
 *
 * The final listener reacts to our OWN ACHIEVEMENT_UNLOCKED event to fan out the celebratory
 * notification — copy comes from the fixed catalog (shared/achievements.js), not the admin-editable
 * template system, because achievements are app-level content, not per-office copy (same reasoning
 * as announcements being excluded from NOTIFICATION_TEMPLATES).
 */
import { EVENTS } from '../../events/events.js';
import { dispatchNotification } from '../../providers/notifications/index.js';
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from '../../../../shared/constants.js';
import { ACHIEVEMENTS_BY_KEY } from '../../../../shared/achievements.js';
import { getLocationMeta } from '../../utils/locationTz.js';
import { localHour, diffMinutes } from '../../utils/timeUtils.js';
import { achievementService } from './achievement.service.js';

const EARLY_BEFORE_HOUR = 8; // start before 8 AM local
const NIGHT_AFTER_HOUR = 20; // start after 8 PM local

export const achievementListeners = [
  {
    event: EVENTS.SESSION_STARTED,
    handler: async (p) => {
      await achievementService.checkCounts(p.locationId, p.userId, ['sessions']);
      const meta = await getLocationMeta(p.locationId);
      const hour = localHour(new Date(), meta?.tz);
      if (hour < EARLY_BEFORE_HOUR) await achievementService.grant(p.locationId, p.userId, 'early_bird');
      if (hour >= NIGHT_AFTER_HOUR) await achievementService.grant(p.locationId, p.userId, 'night_owl');
    },
  },
  {
    event: EVENTS.SESSION_ENDED,
    handler: async (p) => {
      // Perfect finish: ended on or before ETA (no overtime). etaAt/endedAt are always present
      // on a self-ended session; a force-end omits neither (session.service re-emits with both).
      if (p.etaAt && p.endedAt && diffMinutes(p.etaAt, p.endedAt) <= 0) {
        await achievementService.grant(p.locationId, p.userId, 'perfect_finish');
      }
      // Reliability may have just changed (fast-unplug bonus fires on this same event); re-check.
      await achievementService.checkCounts(p.locationId, p.userId, ['reliability']);
    },
  },
  {
    // Credits are awarded once per participant (driver AND each rider) with their own userId, so
    // this is the reliable per-user hook for carpool count badges — CARPOOL_TRIP_COMPLETED only
    // carries the driverId. Trip logs are written before credits are awarded, so counts are current.
    event: EVENTS.CARPOOL_CREDITS_AWARDED,
    handler: async (p) => {
      await achievementService.checkCounts(p.locationId, p.userId, ['trips', 'co2_kg', 'reliability']);
    },
  },
  {
    event: EVENTS.CARPOOL_MATCH_FOUND,
    handler: async (p) => {
      await achievementService.grant(p.locationId, p.riderId, 'great_match', { rideId: p.rideId });
      if (p.driverId) await achievementService.grant(p.locationId, p.driverId, 'great_match', { rideId: p.rideId });
    },
  },
  {
    event: EVENTS.NUDGE_SENT,
    handler: async (p) => {
      await achievementService.checkCounts(p.locationId, p.senderId, ['nudges']);
    },
  },
  {
    event: EVENTS.NUDGE_REACTED,
    handler: async (p) => {
      // A positive reaction (anything but a thumbs-down) rewards the sender for a well-received nudge.
      if (p.reaction && p.reaction !== 'down') {
        await achievementService.grant(p.locationId, p.senderId, 'peacemaker', { messageId: p.messageId });
      }
    },
  },
  {
    event: EVENTS.QUEUE_CLAIMED,
    handler: async (p) => {
      await achievementService.checkCounts(p.locationId, p.userId, ['queue_claims']);
    },
  },
  {
    // Celebrate a fresh unlock with a notification. Its title/body come from the fixed catalog.
    event: EVENTS.ACHIEVEMENT_UNLOCKED,
    handler: async (p) => {
      const a = ACHIEVEMENTS_BY_KEY[p.key];
      if (!a) return;
      await dispatchNotification(p.userId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: `🏆 Achievement unlocked: ${a.label}`,
        body: a.description,
        actionUrl: '/achievements',
        metadata: { key: a.key, tier: a.tier, icon: a.icon, label: a.label },
      });
    },
  },
];
