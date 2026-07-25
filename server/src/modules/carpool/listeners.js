/**
 * Carpool listeners:
 *   - Notifications for booking lifecycle, matches, and credits.
 *   - EV-charging tie-in (Feature 3): grant charger-queue priority to a driver who has a
 *     confirmed carpool booking today; release it when their session ends.
 * Every title/body comes from getNotificationCopy() — an admin-editable template — see
 * shared/constants.js's NOTIFICATION_TEMPLATES for the catalog.
 */
import { EVENTS } from '../../events/events.js';
import { emit } from '../../events/eventBus.js';
import { prisma } from '../../db/prisma.js';
import { configService } from '../../services/config.service.js';
import { dispatchNotification } from '../../providers/notifications/index.js';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY,
  QUEUE_STATUS,
  SETTING_KEYS,
} from '../../../../shared/constants.js';
import { formatTime } from '../../utils/timeUtils.js';
import { getLocationMeta } from '../../utils/locationTz.js';
import { getNotificationCopy } from '../../utils/notifTemplates.js';

async function displayName(userId) {
  const data = await prisma.users.findUnique({ where: { id: userId }, select: { display_name: true } });
  return data?.display_name || 'Someone';
}

export const carpoolListeners = [
  {
    event: EVENTS.CARPOOL_BOOKING_REQUESTED,
    handler: async (p) => {
      const rider = await displayName(p.riderId);
      const { title, body } = await getNotificationCopy('carpool_booking_requested', p.locationId, { rider });
      await dispatchNotification(p.driverId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.CARPOOL_BOOKING,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title,
        body,
        actionUrl: '/carpool',
        metadata: { rideId: p.rideId, bookingId: p.bookingId },
      });
    },
  },
  {
    event: EVENTS.CARPOOL_BOOKING_CONFIRMED,
    handler: async (p) => {
      // Notify the rider.
      const { title, body } = await getNotificationCopy('carpool_booking_confirmed', p.locationId);
      await dispatchNotification(p.riderId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.CARPOOL_BOOKING,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title,
        body,
        actionUrl: '/carpool',
        metadata: { rideId: p.rideId },
      });

      // Feature 3: grant the driver charger-queue priority (if enabled and currently queued).
      // Tracked in its own carpool_priority_delta column (not written directly to `priority`)
      // so it can coexist with an independent reliability boost on the same entry — releasing
      // one on SESSION_ENDED must not stomp the other (see the SESSION_ENDED handler below).
      const enabled = await configService.getBool(SETTING_KEYS.CARPOOL_PRIORITY_ENABLED, p.locationId);
      if (!enabled) return;
      const weight = await configService.getNumber(SETTING_KEYS.CARPOOL_PRIORITY_WEIGHT, p.locationId);
      const entry = await prisma.queue_entries.findFirst({
        where: {
          location_id: p.locationId,
          user_id: p.driverId,
          status: { in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] },
        },
        select: { id: true, carpool_priority_delta: true, reliability_priority_delta: true },
      });
      if (entry && entry.carpool_priority_delta < weight) {
        await prisma.queue_entries.update({
          where: { id: entry.id },
          data: {
            carpool_priority_delta: weight,
            priority: weight + entry.reliability_priority_delta,
            priority_source: 'carpool',
          },
        });
        await emit(EVENTS.CARPOOL_PRIORITY_GRANTED, {
          locationId: p.locationId,
          userId: p.driverId,
          queueEntryId: entry.id,
          weight,
        });
      }
    },
  },
  {
    event: EVENTS.CARPOOL_BOOKING_DECLINED,
    handler: async (p) => {
      const { title, body } = await getNotificationCopy('carpool_booking_declined', p.locationId);
      await dispatchNotification(p.riderId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.CARPOOL_BOOKING,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title,
        body,
        actionUrl: '/carpool',
      });
    },
  },
  {
    event: EVENTS.CARPOOL_RIDE_CANCELLED,
    handler: async (p) => {
      const { title, body } = await getNotificationCopy('carpool_ride_cancelled', p.locationId);
      for (const riderId of p.affectedRiders || []) {
        await dispatchNotification(riderId, {
          locationId: p.locationId,
          type: NOTIFICATION_TYPES.CARPOOL_BOOKING,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title,
          body,
          actionUrl: '/carpool',
          metadata: { rideId: p.rideId },
        });
      }
    },
  },
  {
    event: EVENTS.CARPOOL_MATCH_FOUND,
    handler: async (p) => {
      const meta = await getLocationMeta(p.locationId);
      const riderCopy = await getNotificationCopy('carpool_match_found_rider', p.locationId, {
        departTime: formatTime(p.departAt, meta?.tz),
      });
      await dispatchNotification(p.riderId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.CARPOOL_MATCH,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: riderCopy.title,
        body: riderCopy.body,
        actionUrl: '/carpool',
        metadata: { rideId: p.rideId, score: p.score },
      });
      if (p.driverId) {
        const driverCopy = await getNotificationCopy('carpool_match_found_driver', p.locationId);
        await dispatchNotification(p.driverId, {
          locationId: p.locationId,
          type: NOTIFICATION_TYPES.CARPOOL_MATCH,
          priority: NOTIFICATION_PRIORITY.LOW,
          title: driverCopy.title,
          body: driverCopy.body,
          actionUrl: '/carpool',
          metadata: { rideId: p.rideId },
        });
      }
    },
  },
  {
    event: EVENTS.CARPOOL_CREDITS_AWARDED,
    handler: async (p) => {
      if (p.amount <= 0) return;
      const { title, body } = await getNotificationCopy('carpool_credits_awarded', p.locationId, {
        amount: p.amount,
        reason: p.reason,
        balanceAfter: p.balanceAfter,
      });
      await dispatchNotification(p.userId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.CARPOOL_CREDITS,
        priority: NOTIFICATION_PRIORITY.LOW,
        title,
        body,
        actionUrl: '/carpool/impact',
      });
    },
  },
  {
    // Release any carpool priority hold when the driver's session ends. Only the carpool
    // component is cleared — a concurrently-active reliability boost/penalty on the same
    // entry (see reliability/queue.service.js) must survive this.
    event: EVENTS.SESSION_ENDED,
    handler: async (p) => {
      const entries = await prisma.queue_entries.findMany({
        where: {
          user_id: p.userId,
          carpool_priority_delta: { not: 0 },
          status: { in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] },
        },
        select: { id: true, reliability_priority_delta: true },
      });
      for (const entry of entries) {
        await prisma.queue_entries.update({
          where: { id: entry.id },
          data: {
            carpool_priority_delta: 0,
            priority: entry.reliability_priority_delta,
            priority_source: entry.reliability_priority_delta !== 0 ? 'reliability' : null,
          },
        });
      }
    },
  },
];
