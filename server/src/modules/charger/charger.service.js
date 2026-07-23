/**
 * Charger service: the dashboard aggregation. Returns every charger with its active session,
 * queue counts, next reservation, and any carpool tie-in ("driver is carpooling today").
 *
 * listWithState() is the main read path for charger/session/reservation state, so it also
 * drives the compute-on-read lazy transitions (overtime sessions, reservation
 * activation/completion) that replace the old per-minute cron jobs.
 */
import { prisma } from '../../db/prisma.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { NotFoundError } from '../../utils/errors.js';
import {
  CHARGER_STATUS,
  SESSION_STATUS,
  QUEUE_STATUS,
  RESERVATION_STATUS,
  RIDE_STATUS,
} from '../../../../shared/constants.js';
import { now } from '../../utils/timeUtils.js';
import { transitionOvertimeSessions } from '../session/session.service.js';
import { transitionReservations } from '../reservation/reservation.service.js';

function sessionDto(s, driver) {
  if (!s) return null;
  return {
    id: s.id,
    userId: s.user_id,
    userDisplayName: driver?.display_name || 'Someone',
    vehicleDescription: s.vehicle_description,
    parkingSpot: s.parking_spot,
    startedAt: s.started_at,
    etaAt: s.eta_at,
    status: s.status,
  };
}

export const chargerService = {
  /** Full dashboard payload for a location. */
  async listWithState(locationId) {
    const chargers = await prisma.chargers.findMany({
      where: { location_id: locationId },
      orderBy: { position: 'asc' },
    });

    const chargerIds = chargers.map((c) => c.id);

    // Active/overtime sessions on these chargers.
    const sessions = await prisma.sessions.findMany({
      where: { charger_id: { in: chargerIds }, status: { in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME] } },
      include: { users: { select: { display_name: true } } },
    });
    await transitionOvertimeSessions(sessions);

    // Waiting queue entries.
    const queue = await prisma.queue_entries.findMany({
      where: { location_id: locationId, status: { in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] } },
      select: { id: true, charger_id: true, status: true },
    });

    // Upcoming reservations today.
    const reservations = await prisma.reservations.findMany({
      where: { location_id: locationId, status: RESERVATION_STATUS.UPCOMING, end_at: { gte: now() } },
      select: { id: true, charger_id: true, user_id: true, start_at: true, end_at: true, location_id: true, warned_at: true, status: true, users: { select: { display_name: true } } },
      orderBy: { start_at: 'asc' },
    });
    await transitionReservations(reservations);
    const upcomingReservations = reservations.filter((r) => r.status === RESERVATION_STATUS.UPCOMING);

    // Carpool tie-in: rides today linked to a session on these chargers.
    const sessionIds = sessions.map((s) => s.id);
    const rides = sessionIds.length
      ? await prisma.carpool_rides.findMany({
          where: {
            linked_session_id: { in: sessionIds },
            status: { in: [RIDE_STATUS.OPEN, RIDE_STATUS.FULL, RIDE_STATUS.IN_PROGRESS] },
          },
          select: { id: true, linked_session_id: true, depart_at: true, seats_available: true, direction: true },
        })
      : [];

    const bySession = new Map(sessions.map((s) => [s.charger_id, s]));
    const anyQueueCount = queue.filter((q) => q.charger_id === null).length;

    return chargers.map((c) => {
      const s = bySession.get(c.id);
      const queueCount = queue.filter((q) => q.charger_id === c.id).length + anyQueueCount;
      const nextRes = upcomingReservations.find((r) => r.charger_id === c.id);
      const ride = s ? rides.find((r) => r.linked_session_id === s.id) : null;

      let status = c.status;
      if (status !== CHARGER_STATUS.OFFLINE) {
        status = s ? s.status === SESSION_STATUS.OVERTIME ? CHARGER_STATUS.OVERTIME : CHARGER_STATUS.IN_USE : CHARGER_STATUS.AVAILABLE;
      }

      return {
        id: c.id,
        name: c.name,
        position: c.position,
        status,
        offlineReason: c.offline_reason,
        session: sessionDto(s, s?.users),
        queueCount,
        nextReservation: nextRes
          ? { id: nextRes.id, startAt: nextRes.start_at, userDisplayName: nextRes.users?.display_name }
          : null,
        carpool: ride
          ? { rideId: ride.id, departAt: ride.depart_at, seatsAvailable: ride.seats_available, direction: ride.direction }
          : null,
      };
    });
  },

  async getOne(locationId, chargerId) {
    const list = await this.listWithState(locationId);
    const charger = list.find((c) => c.id === chargerId);
    if (!charger) throw new NotFoundError('Charger not found');
    return charger;
  },

  async setOffline(locationId, chargerId, reason) {
    const { count } = await prisma.chargers.updateMany({
      where: { id: chargerId, location_id: locationId },
      data: { status: CHARGER_STATUS.OFFLINE, offline_reason: reason || 'Temporarily unavailable' },
    });
    if (!count) throw new NotFoundError('Charger not found');
    const data = await prisma.chargers.findUnique({ where: { id: chargerId } });
    await emit(EVENTS.CHARGER_OFFLINE, { locationId, chargerId, reason });
    return data;
  },

  async setOnline(locationId, chargerId) {
    const { count } = await prisma.chargers.updateMany({
      where: { id: chargerId, location_id: locationId },
      data: { status: CHARGER_STATUS.AVAILABLE, offline_reason: null },
    });
    if (!count) throw new NotFoundError('Charger not found');
    const data = await prisma.chargers.findUnique({ where: { id: chargerId } });
    await emit(EVENTS.CHARGER_ONLINE, { locationId, chargerId });
    return data;
  },

  async rename(locationId, chargerId, name) {
    const { count } = await prisma.chargers.updateMany({
      where: { id: chargerId, location_id: locationId },
      data: { name },
    });
    if (!count) throw new NotFoundError('Charger not found');
    return prisma.chargers.findUnique({ where: { id: chargerId } });
  },
};
