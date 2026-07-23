/**
 * Audit listener: writes an audit_log row for EVERY event. Emitting an event is auditing it.
 * Subscribes to the full EVENTS vocabulary so new events are logged without extra wiring.
 */
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/index.js';
import { EVENTS } from '../events.js';
import { logger } from '../../utils/logger.js';

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

export const auditListeners = Object.values(EVENTS).map((event) => ({
  event,
  handler: (payload) => record(event, payload),
}));
