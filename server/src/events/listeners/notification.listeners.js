/**
 * Core notification listeners: turn domain events into user notifications.
 * Module-specific notifications (e.g. carpool) live in that module's listeners file;
 * this file covers the cross-cutting charger/queue/session flows.
 */
import { EVENTS } from '../events.js';
import { dispatchNotification, dispatchBulk } from '../../providers/notifications/index.js';
import { prisma } from '../../db/prisma.js';
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from '../../../../shared/constants.js';

async function chargerName(chargerId) {
  if (!chargerId) return 'a charger';
  const data = await prisma.chargers.findUnique({ where: { id: chargerId }, select: { name: true } });
  return data?.name || 'a charger';
}

export const notificationListeners = [
  {
    event: EVENTS.QUEUE_ADVANCED,
    handler: async (p) => {
      const name = await chargerName(p.chargerId);
      await dispatchNotification(p.userId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.QUEUE_TURN,
        priority: NOTIFICATION_PRIORITY.URGENT,
        title: "⚡ It's your turn!",
        body: `${name} is free. Claim your spot before it expires.`,
        actionUrl: '/',
        metadata: { chargerId: p.chargerId, queueEntryId: p.queueEntryId, expiresAt: p.expiresAt },
      });
    },
  },
  {
    event: EVENTS.QUEUE_SKIPPED,
    handler: async (p) => {
      await dispatchNotification(p.userId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.QUEUE_SKIPPED,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: 'You missed your spot',
        body: "You didn't claim in time and were moved to the back of the queue.",
        actionUrl: '/',
      });
    },
  },
  {
    event: EVENTS.SESSION_OVERTIME,
    handler: async (p) => {
      const name = await chargerName(p.chargerId);
      await dispatchNotification(p.userId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.SESSION_OVERTIME,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: '⚠️ Charging session overtime',
        body: `Your session on ${name} has passed its ETA. Please wrap up when you can.`,
        actionUrl: '/',
        metadata: { chargerId: p.chargerId, minutesOver: p.minutesOver },
      });
    },
  },
  {
    event: EVENTS.SESSION_OVERTIME_ESCALATED,
    handler: async (p) => {
      // Alert admins.
      const admins = await prisma.users.findMany({
        where: { location_id: p.locationId, role: 'admin' },
        select: { id: true },
      });
      const name = await chargerName(p.chargerId);
      await dispatchBulk(
        admins.map((a) => a.id),
        {
          locationId: p.locationId,
          type: NOTIFICATION_TYPES.ADMIN_ALERT,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: 'Overtime needs attention',
          body: `${name} is ${p.minutesOver} min past ETA.`,
          actionUrl: '/admin',
          metadata: { chargerId: p.chargerId, sessionId: p.sessionId },
        }
      );
    },
  },
  {
    event: EVENTS.ANNOUNCEMENT_CREATED,
    handler: async (p) => {
      const users = await prisma.users.findMany({
        where: { location_id: p.locationId, active: true },
        select: { id: true },
      });
      await dispatchBulk(
        users.map((u) => u.id),
        {
          locationId: p.locationId,
          type: NOTIFICATION_TYPES.ANNOUNCEMENT,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: p.title,
          body: p.body,
          actionUrl: '/',
        }
      );
    },
  },
];
