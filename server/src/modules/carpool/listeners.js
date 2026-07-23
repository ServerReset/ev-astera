/**
 * Carpool listeners:
 *   - Notifications for booking lifecycle, matches, and credits.
 *   - EV-charging tie-in (Feature 3): grant charger-queue priority to a driver who has a
 *     confirmed carpool booking today; release it when their session ends.
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

async function displayName(userId) {
  const data = await prisma.users.findUnique({ where: { id: userId }, select: { display_name: true } });
  return data?.display_name || 'Someone';
}

export const carpoolListeners = [
  {
    event: EVENTS.CARPOOL_BOOKING_REQUESTED,
    handler: async (p) => {
      const rider = await displayName(p.riderId);
      await dispatchNotification(p.driverId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.CARPOOL_BOOKING,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: '🚗 New seat request',
        body: `${rider} requested a seat on your ride.`,
        actionUrl: '/carpool',
        metadata: { rideId: p.rideId, bookingId: p.bookingId },
      });
    },
  },
  {
    event: EVENTS.CARPOOL_BOOKING_CONFIRMED,
    handler: async (p) => {
      // Notify the rider.
      await dispatchNotification(p.riderId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.CARPOOL_BOOKING,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: '✅ Ride confirmed',
        body: 'Your carpool seat is confirmed. See you there!',
        actionUrl: '/carpool',
        metadata: { rideId: p.rideId },
      });

      // Feature 3: grant the driver charger-queue priority (if enabled and currently queued).
      const enabled = await configService.getBool(SETTING_KEYS.CARPOOL_PRIORITY_ENABLED, p.locationId);
      if (!enabled) return;
      const weight = await configService.getNumber(SETTING_KEYS.CARPOOL_PRIORITY_WEIGHT, p.locationId);
      const entry = await prisma.queue_entries.findFirst({
        where: {
          location_id: p.locationId,
          user_id: p.driverId,
          status: { in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] },
        },
        select: { id: true, priority: true },
      });
      if (entry && entry.priority < weight) {
        await prisma.queue_entries.update({
          where: { id: entry.id },
          data: { priority: weight, priority_source: 'carpool' },
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
      await dispatchNotification(p.riderId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.CARPOOL_BOOKING,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: 'Ride request declined',
        body: 'The driver could not take you this time. Try another ride.',
        actionUrl: '/carpool',
      });
    },
  },
  {
    event: EVENTS.CARPOOL_RIDE_CANCELLED,
    handler: async (p) => {
      for (const riderId of p.affectedRiders || []) {
        await dispatchNotification(riderId, {
          locationId: p.locationId,
          type: NOTIFICATION_TYPES.CARPOOL_BOOKING,
          priority: NOTIFICATION_PRIORITY.HIGH,
          title: '⚠️ Carpool cancelled',
          body: 'A ride you booked was cancelled by the driver.',
          actionUrl: '/carpool',
          metadata: { rideId: p.rideId },
        });
      }
    },
  },
  {
    event: EVENTS.CARPOOL_MATCH_FOUND,
    handler: async (p) => {
      await dispatchNotification(p.riderId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.CARPOOL_MATCH,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: '🔎 Carpool match found',
        body: `A ride departing ${formatTime(p.departAt)} matches your request.`,
        actionUrl: '/carpool',
        metadata: { rideId: p.rideId, score: p.score },
      });
      if (p.driverId) {
        await dispatchNotification(p.driverId, {
          locationId: p.locationId,
          type: NOTIFICATION_TYPES.CARPOOL_MATCH,
          priority: NOTIFICATION_PRIORITY.LOW,
          title: '🔎 A rider matches your ride',
          body: 'Someone nearby is looking for a ride like yours.',
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
      await dispatchNotification(p.userId, {
        locationId: p.locationId,
        type: NOTIFICATION_TYPES.CARPOOL_CREDITS,
        priority: NOTIFICATION_PRIORITY.LOW,
        title: `🌱 +${p.amount} carpool credits`,
        body: `${p.reason}. Balance: ${p.balanceAfter}.`,
        actionUrl: '/carpool/impact',
      });
    },
  },
  {
    // Release any carpool priority hold when the driver's session ends.
    event: EVENTS.SESSION_ENDED,
    handler: async (p) => {
      await prisma.queue_entries.updateMany({
        where: {
          user_id: p.userId,
          priority_source: 'carpool',
          status: { in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] },
        },
        data: { priority: 0, priority_source: null },
      });
    },
  },
];
