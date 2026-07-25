/**
 * Message listeners: turn nudge/emergency events into notifications.
 * (Kept in the message module so all nudge/emergency logic lives together.) Every title/body
 * comes from getNotificationCopy() — an admin-editable template — see shared/constants.js's
 * NOTIFICATION_TEMPLATES for the catalog.
 */
import { EVENTS } from '../../events/events.js';
import { dispatchNotification, dispatchBulk } from '../../providers/notifications/index.js';
import { prisma } from '../../db/prisma.js';
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITY, SESSION_STATUS } from '../../../../shared/constants.js';
import { getNotificationCopy } from '../../utils/notifTemplates.js';

async function displayName(userId) {
  const data = await prisma.users.findUnique({ where: { id: userId }, select: { display_name: true } });
  return data?.display_name || 'Someone';
}

// Maps each nudge reaction (shared/validation.js's nudgeReactSchema enum) to its notification
// template key. Any reaction not listed falls back to the thumbs-down template — a defensive
// default so an unexpected value can never crash the handler on a missing template lookup.
const NUDGE_REACTION_TEMPLATE = {
  up: 'nudge_reaction_up',
  down: 'nudge_reaction_down',
  pray: 'nudge_reaction_pray',
  run: 'nudge_reaction_run',
  eyes: 'nudge_reaction_eyes',
};

export const messageListeners = [
  {
    event: EVENTS.NUDGE_SENT,
    handler: async (p) => {
      // Nudges are anonymous to the recipient — never look up or surface the sender's name here.
      const { title, body } = await getNotificationCopy('nudge_received', p.locationId, { message: p.message });
      await dispatchNotification(p.recipientId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.NUDGE,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title,
        body,
        actionUrl: '/',
        messageId: p.messageId,
        metadata: { messageId: p.messageId, chargerId: p.chargerId, sessionId: p.sessionId },
      });
    },
  },
  {
    event: EVENTS.NUDGE_REACTED,
    handler: async (p) => {
      const templateKey = NUDGE_REACTION_TEMPLATE[p.reaction] || 'nudge_reaction_down';
      const { title, body } = await getNotificationCopy(templateKey, p.locationId);
      await dispatchNotification(p.senderId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.NUDGE_REACTION,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title,
        body,
        actionUrl: '/',
        metadata: { messageId: p.messageId, reaction: p.reaction, chargerId: p.chargerId },
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
      const { title, body } = await getNotificationCopy('emergency_requested', p.locationId, { from, reason: p.reason });
      await dispatchBulk(
        active.map((s) => s.user_id),
        {
          locationId: p.locationId,
          type: NOTIFICATION_TYPES.EMERGENCY,
          priority: NOTIFICATION_PRIORITY.URGENT,
          title,
          body,
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
      const { title, body } = await getNotificationCopy(
        p.accept ? 'emergency_responded_accept' : 'emergency_responded_decline',
        p.locationId,
        { from }
      );
      await dispatchNotification(p.requesterId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.EMERGENCY,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title,
        body,
        actionUrl: '/',
        metadata: { requestId: p.requestId },
      });
    },
  },
];
