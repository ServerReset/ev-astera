/**
 * Reliability listeners: turn session-end and carpool-trip-completion events into reliability
 * score changes. Kept decoupled from session.service.js / carpool/impact.js (they only emit
 * events; this module reacts) so this feature can't break the flows it observes.
 */
import { EVENTS } from '../../events/events.js';
import { configService } from '../../services/config.service.js';
import { SETTING_KEYS } from '../../../../shared/constants.js';
import { diffMinutes } from '../../utils/timeUtils.js';
import { reliabilityService, RELIABILITY_EVENT, computeOvertimePenalty } from './reliability.service.js';

export const reliabilityListeners = [
  {
    event: EVENTS.SESSION_ENDED,
    handler: async (p) => {
      const enabled = await configService.getBool(SETTING_KEYS.RELIABILITY_ENABLED, p.locationId);
      if (!enabled || !p.etaAt || !p.endedAt) return;

      const overtimeMinutes = Math.max(0, diffMinutes(p.etaAt, p.endedAt));
      if (overtimeMinutes === 0) {
        const bonus = await configService.getNumber(SETTING_KEYS.RELIABILITY_FAST_UNPLUG_BONUS, p.locationId);
        if (bonus > 0) {
          await reliabilityService.applyEvent(p.locationId, p.userId, RELIABILITY_EVENT.FAST_UNPLUG_BONUS, bonus, {
            sessionId: p.sessionId,
          });
        }
        return;
      }

      const graceMinutes = await configService.getNumber(SETTING_KEYS.RELIABILITY_OVERTIME_GRACE_MINUTES, p.locationId);
      if (overtimeMinutes <= graceMinutes) return; // within grace, neutral

      const perMinute = await configService.getNumber(SETTING_KEYS.RELIABILITY_OVERTIME_PENALTY_PER_MINUTE, p.locationId);
      const factor = await configService.getNumber(SETTING_KEYS.RELIABILITY_OVERTIME_ESCALATION_FACTOR, p.locationId);
      const penalty = computeOvertimePenalty(overtimeMinutes, { graceMinutes, perMinute, factor });
      if (penalty > 0) {
        await reliabilityService.applyEvent(p.locationId, p.userId, RELIABILITY_EVENT.OVERTIME_PENALTY, -penalty, {
          sessionId: p.sessionId,
          metadata: { overtimeMinutes, graceMinutes },
        });
      }
    },
  },
  {
    event: EVENTS.CARPOOL_TRIP_COMPLETED,
    handler: async (p) => {
      const enabled = await configService.getBool(SETTING_KEYS.RELIABILITY_ENABLED, p.locationId);
      if (!enabled || !p.driverId) return;
      const bonus = await configService.getNumber(SETTING_KEYS.RELIABILITY_CARPOOL_DRIVER_BONUS, p.locationId);
      if (bonus <= 0) return;
      await reliabilityService.applyEvent(p.locationId, p.driverId, RELIABILITY_EVENT.CARPOOL_DRIVER_BONUS, bonus, {
        metadata: { rideId: p.rideId },
      });
    },
  },
];
