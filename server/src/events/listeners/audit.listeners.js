/**
 * Audit listener: writes an audit_log row per event — but NOT for high-frequency derived/cascade
 * events. One user action fans out into many emits (a session end triggers QUEUE_ADVANCED; a
 * completed carpool ride emits one CARPOOL_CREDITS_AWARDED PER rider plus CARPOOL_TRIP_COMPLETED;
 * every achievement check may emit ACHIEVEMENT_UNLOCKED), so auditing the whole vocabulary turned
 * one action into 3-10 audit inserts and made the audit table the app's single biggest sustained
 * write driver. We keep the "new events are audited by default" convenience (still derived from
 * EVENTS, so nothing needs re-wiring) and only SUBTRACT a small deny-list of cascade/fan-out events
 * whose audit value doesn't justify their volume — the meaningful business action that triggered
 * them is already audited on its own event.
 */
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/index.js';
import { EVENTS } from '../events.js';
import { logger } from '../../utils/logger.js';

// Derived/cascade or per-participant fan-out events — deliberately NOT audited (their originating
// action is). These are the volume multipliers the audit table doesn't need a row for.
const AUDIT_EXCLUDE = new Set([
  EVENTS.QUEUE_ADVANCED,          // cascade of SESSION_ENDED / QUEUE_LEFT (those are audited)
  EVENTS.CARPOOL_CREDITS_AWARDED, // one PER participant on every completed ride (N× per trip)
  EVENTS.CARPOOL_PRIORITY_GRANTED,// cascade of a carpool booking/priority calc
  EVENTS.ACHIEVEMENT_UNLOCKED,    // fan-out of routine count checks
  EVENTS.SESSION_ENDING_SOON,     // timer-driven notification signal, not a user action
  EVENTS.SESSION_OVERTIME,        // computed-on-read state transition, can fire often
]);

async function record(action, payload) {
  try {
    await prisma.audit_log.create({
      data: {
        location_id: payload.locationId || env.defaultLocationId,
        user_id: payload.userId || payload.driverId || payload.riderId || payload.actorId || null,
        action,
        details: payload,
      },
    });
  } catch (err) {
    logger.debug('audit insert failed', { action, message: err.message });
  }
}

export const auditListeners = Object.values(EVENTS)
  .filter((event) => !AUDIT_EXCLUDE.has(event))
  .map((event) => ({
    event,
    handler: (payload) => record(event, payload),
  }));
