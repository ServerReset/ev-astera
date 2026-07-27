/**
 * Core notification listeners: turn domain events into user notifications.
 * Module-specific notifications (e.g. carpool) live in that module's listeners file;
 * this file covers the cross-cutting charger/queue/session flows. Every title/body comes
 * from getNotificationCopy() — an admin-editable template, not a hardcoded literal — see
 * shared/constants.js's NOTIFICATION_TEMPLATES for the catalog.
 */
import { EVENTS } from '../events.js';
import { dispatchNotification, dispatchBulk } from '../../providers/notifications/index.js';
import { prisma } from '../../db/prisma.js';
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITY, ADMIN_ROLES } from '../../../../shared/constants.js';
import { getNotificationCopy } from '../../utils/notifTemplates.js';
import { getChargerName as chargerName } from '../../utils/chargerNameCache.js';

export const notificationListeners = [
  {
    event: EVENTS.QUEUE_ADVANCED,
    handler: async (p) => {
      const name = await chargerName(p.chargerId);
      const { title, body } = await getNotificationCopy('queue_turn', p.locationId, { chargerName: name });
      await dispatchNotification(p.userId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.QUEUE_TURN,
        priority: NOTIFICATION_PRIORITY.URGENT,
        title,
        body,
        actionUrl: '/',
        metadata: { chargerId: p.chargerId, queueEntryId: p.queueEntryId, expiresAt: p.expiresAt },
      });
    },
  },
  {
    event: EVENTS.QUEUE_SKIPPED,
    handler: async (p) => {
      const { title, body } = await getNotificationCopy('queue_skipped', p.locationId);
      await dispatchNotification(p.userId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.QUEUE_SKIPPED,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title,
        body,
        actionUrl: '/',
      });
    },
  },
  {
    event: EVENTS.SESSION_OVERTIME,
    handler: async (p) => {
      const name = await chargerName(p.chargerId);
      const { title, body } = await getNotificationCopy('session_overtime', p.locationId, { chargerName: name });
      await dispatchNotification(p.userId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.SESSION_OVERTIME,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title,
        body,
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
        where: { location_id: p.locationId, role: { in: ADMIN_ROLES } },
        select: { id: true },
      });
      const name = await chargerName(p.chargerId);
      const { title, body } = await getNotificationCopy('overtime_admin_alert', p.locationId, {
        chargerName: name,
        minutesOver: p.minutesOver,
      });
      await dispatchBulk(
        admins.map((a) => a.id),
        {
          locationId: p.locationId,
          type: NOTIFICATION_TYPES.ADMIN_ALERT,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title,
          body,
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
