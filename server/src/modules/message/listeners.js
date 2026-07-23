/**
 * Message listeners: turn nudge/emergency events into notifications.
 * (Kept in the message module so all nudge/emergency logic lives together.)
 */
import { EVENTS } from '../../events/events.js';
import { dispatchNotification, dispatchBulk } from '../../providers/notifications/index.js';
import { prisma } from '../../db/prisma.js';
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITY, SESSION_STATUS } from '../../../../shared/constants.js';

async function displayName(userId) {
  const data = await prisma.users.findUnique({ where: { id: userId }, select: { display_name: true } });
  return data?.display_name || 'Someone';
}

export const messageListeners = [
  {
    event: EVENTS.NUDGE_SENT,
    handler: async (p) => {
      const from = await displayName(p.senderId);
      await dispatchNotification(p.recipientId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.NUDGE,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: `👋 Nudge from ${from}`,
        body: p.message,
        actionUrl: '/',
        metadata: { chargerId: p.chargerId, sessionId: p.sessionId },
      });
    },
  },
  {
    event: EVENTS.EMERGENCY_REQUESTED,
    handler: async (p) => {
      const from = await displayName(p.userId);
      // Alert everyone currently charging (they're the ones who can free a charger).
      const active = await prisma.sessions.findMany({
        where: { location_id: p.locationId, status: { in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME] } },
        select: { user_id: true },
      });
      await dispatchBulk(
        active.map((s) => s.user_id),
        {
          locationId: p.locationId,
          type: NOTIFICATION_TYPES.EMERGENCY,
          priority: NOTIFICATION_PRIORITY.URGENT,
          title: '🚨 Emergency charge request',
          body: `${from}: ${p.reason}. Can you wrap up your session?`,
          actionUrl: '/',
          metadata: { requestId: p.requestId },
        }
      );
    },
  },
  {
    event: EVENTS.EMERGENCY_RESPONDED,
    handler: async (p) => {
      const from = await displayName(p.responderId);
      await dispatchNotification(p.requesterId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.EMERGENCY,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: p.accept ? '✅ Someone is freeing a charger' : 'Emergency update',
        body: p.accept ? `${from} is wrapping up for you.` : `${from} can't help right now.`,
        actionUrl: '/',
        metadata: { requestId: p.requestId },
      });
    },
  },
];
