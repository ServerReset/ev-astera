/**
 * Reservation service: book a charger for a future window. Enforces min-advance,
 * work-hours, and overlap (including the configured buffer between reservations).
 *
 * transitionReservations() is the compute-on-read replacement for the old reservationCheck
 * cron: warns an active walk-up session before a reservation starts, activates reservations
 * at start time, and completes them once their window passes. Called from this service's own
 * read paths and from charger.service.listWithState() (which folds reservation state into
 * charger availability).
 */
import { prisma } from '../../db/prisma.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { configService } from '../../services/config.service.js';
import { BusinessRuleError, ConflictError, NotFoundError, AuthorizationError } from '../../utils/errors.js';
import { RESERVATION_STATUS, SESSION_STATUS, SETTING_KEYS, WORK_HOURS } from '../../../../shared/constants.js';
import { addMinutes, now, diffMinutes, localHour } from '../../utils/timeUtils.js';

function toDto(r) {
  return {
    id: r.id,
    chargerId: r.charger_id,
    chargerName: r.chargers?.name,
    userId: r.user_id,
    userDisplayName: r.users?.display_name,
    status: r.status,
    startAt: r.start_at,
    endAt: r.end_at,
  };
}

/**
 * Mutates `reservations` in place: warns walk-ups, activates, and completes as needed.
 * Reservations that transition to 'completed' are removed from the array (callers filter
 * on upcoming/active) so the returned list stays consistent with the old cron's timing.
 */
export async function transitionReservations(reservations) {
  const current = now();

  for (const r of reservations) {
    if (r.status === RESERVATION_STATUS.UPCOMING) {
      const bufferMin = await configService.getNumber(SETTING_KEYS.RESERVATION_BUFFER_MINUTES, r.location_id);
      const warnAt = addMinutes(new Date(r.start_at), -bufferMin);

      if (current >= warnAt && current < new Date(r.start_at) && !r.warned_at) {
        const active = await prisma.sessions.findFirst({
          where: { charger_id: r.charger_id, status: { in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.OVERTIME] } },
        });
        if (active && active.user_id !== r.user_id) {
          await emit(EVENTS.RESERVATION_WARN_WALKUP, {
            locationId: r.location_id,
            chargerId: r.charger_id,
            userId: active.user_id,
            reservationId: r.id,
            startAt: r.start_at,
          });
        }
        await prisma.reservations.update({ where: { id: r.id }, data: { warned_at: current } });
        r.warned_at = current;
      }

      if (current >= new Date(r.start_at) && current < new Date(r.end_at)) {
        await prisma.reservations.update({ where: { id: r.id }, data: { status: RESERVATION_STATUS.ACTIVE } });
        r.status = RESERVATION_STATUS.ACTIVE;
        await emit(EVENTS.RESERVATION_STARTING, {
          locationId: r.location_id,
          chargerId: r.charger_id,
          userId: r.user_id,
          reservationId: r.id,
        });
      }
    }

    if (
      [RESERVATION_STATUS.UPCOMING, RESERVATION_STATUS.ACTIVE].includes(r.status) &&
      current >= new Date(r.end_at)
    ) {
      await prisma.reservations.update({ where: { id: r.id }, data: { status: RESERVATION_STATUS.COMPLETED } });
      r.status = RESERVATION_STATUS.COMPLETED;
    }
  }

  return reservations;
}

export const reservationService = {
  async listMine(locationId, userId) {
    const reservations = await prisma.reservations.findMany({
      where: {
        location_id: locationId,
        user_id: userId,
        status: { in: [RESERVATION_STATUS.UPCOMING, RESERVATION_STATUS.ACTIVE] },
      },
      include: { chargers: { select: { name: true } } },
      orderBy: { start_at: 'asc' },
    });
    await transitionReservations(reservations);
    return reservations
      .filter((r) => [RESERVATION_STATUS.UPCOMING, RESERVATION_STATUS.ACTIVE].includes(r.status))
      .map(toDto);
  },

  /** All upcoming/active reservations at a location (for the schedule view). */
  async listUpcoming(locationId) {
    const reservations = await prisma.reservations.findMany({
      where: {
        location_id: locationId,
        status: { in: [RESERVATION_STATUS.UPCOMING, RESERVATION_STATUS.ACTIVE] },
        end_at: { gte: now() },
      },
      include: { chargers: { select: { name: true } }, users: { select: { display_name: true } } },
      orderBy: { start_at: 'asc' },
    });
    await transitionReservations(reservations);
    return reservations
      .filter((r) => [RESERVATION_STATUS.UPCOMING, RESERVATION_STATUS.ACTIVE].includes(r.status))
      .map(toDto);
  },

  async create(locationId, userId, { chargerId, startAt, endAt }) {
    const start = new Date(startAt);
    const end = new Date(endAt);

    const minAdvance = await configService.getNumber(SETTING_KEYS.RESERVATION_MIN_ADVANCE_MINUTES, locationId);
    if (diffMinutes(now(), start) < minAdvance) {
      throw new BusinessRuleError(`Reservations must be at least ${minAdvance} minutes in advance.`);
    }
    const maxHours = await configService.getNumber(SETTING_KEYS.MAX_SESSION_HOURS, locationId);
    if (diffMinutes(start, end) > maxHours * 60) {
      throw new BusinessRuleError(`Reservations cannot exceed ${maxHours} hours.`);
    }
    // Work-hours guard (site is open 8–18 local).
    const startHour = localHour(start);
    if (startHour < WORK_HOURS.START || startHour >= WORK_HOURS.END) {
      throw new BusinessRuleError(`Reservations must start during work hours (${WORK_HOURS.START}:00–${WORK_HOURS.END}:00).`);
    }

    const charger = await prisma.chargers.findFirst({
      where: { id: chargerId, location_id: locationId },
      select: { id: true },
    });
    if (!charger) throw new NotFoundError('Charger not found');

    // Overlap check with buffer padding on both sides.
    const buffer = await configService.getNumber(SETTING_KEYS.RESERVATION_BUFFER_MINUTES, locationId);
    const padStart = addMinutes(start, -buffer);
    const padEnd = addMinutes(end, buffer);
    const clashes = await prisma.reservations.findMany({
      where: {
        charger_id: chargerId,
        status: { in: [RESERVATION_STATUS.UPCOMING, RESERVATION_STATUS.ACTIVE] },
        start_at: { lt: padEnd },
        end_at: { gt: padStart },
      },
      select: { id: true },
    });
    if (clashes.length) {
      throw new ConflictError('That time overlaps an existing reservation (including buffer).');
    }

    let data;
    try {
      data = await prisma.reservations.create({
        data: {
          location_id: locationId,
          charger_id: chargerId,
          user_id: userId,
          start_at: start,
          end_at: end,
          status: RESERVATION_STATUS.UPCOMING,
        },
        include: { chargers: { select: { name: true } } },
      });
    } catch {
      throw new ConflictError('Could not create reservation.');
    }

    await emit(EVENTS.RESERVATION_CREATED, { locationId, chargerId, userId, reservationId: data.id, startAt: data.start_at });
    return toDto(data);
  },

  async cancel(locationId, userId, reservationId) {
    const r = await prisma.reservations.findUnique({ where: { id: reservationId } });
    if (!r) throw new NotFoundError('Reservation not found');
    if (r.user_id !== userId) throw new AuthorizationError('Not your reservation');
    if (![RESERVATION_STATUS.UPCOMING, RESERVATION_STATUS.ACTIVE].includes(r.status)) {
      throw new BusinessRuleError('Reservation cannot be cancelled.');
    }
    await prisma.reservations.update({ where: { id: reservationId }, data: { status: RESERVATION_STATUS.CANCELLED } });
    await emit(EVENTS.RESERVATION_CANCELLED, { locationId, chargerId: r.charger_id, userId, reservationId });
    return { success: true };
  },
};
