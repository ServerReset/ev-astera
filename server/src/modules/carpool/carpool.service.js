/**
 * Carpool service — rides, bookings, requests, schedules, groups, matches, impact.
 * The four features from docs/CARPOOL.md all live here (matcher + impact math are split out
 * into matcher.js / impact.js). Every method is location-scoped.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { configService } from '../../services/config.service.js';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  AuthorizationError,
} from '../../utils/errors.js';
import {
  RIDE_STATUS,
  BOOKING_STATUS,
  RIDE_REQUEST_STATUS,
  CARPOOL_ROLE,
  SETTING_KEYS,
} from '../../../../shared/constants.js';
import { addMinutes, now, diffMinutes } from '../../utils/timeUtils.js';
import { rankRides } from './matcher.js';
import { completeRideImpact } from './impact.js';
import { carpoolMaterialize } from './jobs.js';

// ── helpers ────────────────────────────────────────────────────────────────────
// Recurring rides/requests are normally materialized once a day by the Vercel Cron job. If
// that cron is ever misconfigured or misses a run, schedules would silently stop appearing
// in "Find a ride" with no way to notice — so the read path opportunistically self-heals by
// re-running materialization for its own location, throttled so a page of traffic doesn't
// hammer the DB with the same scan. Per-instance in-memory throttle is fine here: worst case
// (a cold serverless instance) it just runs once more than strictly necessary.
const MATERIALIZE_THROTTLE_MS = 5 * 60_000;
const lastMaterializedAt = new Map();
async function ensureMaterialized(locationId) {
  const last = lastMaterializedAt.get(locationId) || 0;
  if (Date.now() - last < MATERIALIZE_THROTTLE_MS) return;
  lastMaterializedAt.set(locationId, Date.now());
  try {
    await carpoolMaterialize(locationId);
  } catch {
    // Best-effort — a failed self-heal must never break the read it's backing.
  }
}

async function myGroupIds(userId) {
  if (!userId) return [];
  const data = await prisma.carpool_group_members.findMany({ where: { user_id: userId }, select: { group_id: true } });
  return data.map((r) => r.group_id);
}

/**
 * Batched driver stats for a SET of drivers — ONE grouped query for all of them, returning a
 * Map<driverId, {completed, cancelled}>. Replaces the old per-driver driverStats() that was called
 * inside ride loops (a classic N+1, and worse: non-deduped, so a driver with 3 open rides was
 * queried 3×). Callers dedupe driverIds and look up in the returned map.
 */
async function driverStatsFor(driverIds) {
  const map = new Map();
  const ids = [...new Set(driverIds)].filter(Boolean);
  if (!ids.length) return map;
  const grouped = await prisma.carpool_rides.groupBy({
    by: ['driver_id', 'status'],
    where: { driver_id: { in: ids }, status: { in: [RIDE_STATUS.COMPLETED, RIDE_STATUS.CANCELLED] } },
    _count: { _all: true },
  });
  for (const id of ids) map.set(id, { completed: 0, cancelled: 0 });
  for (const g of grouped) {
    const entry = map.get(g.driver_id);
    if (!entry) continue;
    if (g.status === RIDE_STATUS.COMPLETED) entry.completed = g._count._all;
    else if (g.status === RIDE_STATUS.CANCELLED) entry.cancelled = g._count._all;
  }
  return map;
}

function rideDto(r, extra = {}) {
  return {
    id: r.id,
    driverId: r.driver_id,
    driverName: r.driver?.display_name,
    direction: r.direction,
    origin: { label: r.origin_label },
    departAt: r.depart_at,
    seatsTotal: r.seats_total,
    seatsAvailable: r.seats_available,
    status: r.status,
    notes: r.notes,
    groupId: r.group_id,
    linkedSessionId: r.linked_session_id,
    miles: r.miles,
    co2GramsSaved: r.co2_grams_saved,
    ...extra,
  };
}

async function assertLead(locationId, departAt) {
  const lead = await configService.getNumber(SETTING_KEYS.CARPOOL_MIN_LEAD_MINUTES, locationId);
  if (diffMinutes(now(), new Date(departAt)) < lead) {
    throw new BusinessRuleError(`Rides must be at least ${lead} minutes ahead.`);
  }
}

export const carpoolService = {
  /** Read-only config values riders need client-side (e.g. HQ address for "from work" auto-fill). */
  async getConfig(locationId) {
    const hqAddress = await configService.get(SETTING_KEYS.CARPOOL_HQ_ADDRESS, locationId);
    return { hqAddress: hqAddress || '' };
  },

  // ── Feature 1: rides & bookings ───────────────────────────────────────────────
  async listRides(locationId, userId, { direction, around } = {}) {
    await ensureMaterialized(locationId);
    const rides = await prisma.carpool_rides.findMany({
      where: {
        location_id: locationId,
        status: RIDE_STATUS.OPEN,
        seats_available: { gt: 0 },
        depart_at: { gte: now() },
        ...(direction ? { direction } : {}),
      },
      include: { driver: { select: { display_name: true } } },
      orderBy: { depart_at: 'asc' },
    });

    const groupIds = await myGroupIds(userId);

    const windowCenter = around ? new Date(around) : now();
    // One grouped query for all drivers' stats (was one findMany per ride).
    const stats = await driverStatsFor(rides.map((r) => r.driver_id));
    const enriched = rides.map((r) => ({ ...r, driverStats: stats.get(r.driver_id) || { completed: 0, cancelled: 0 } }));
    const rider = {
      windowStart: addMinutes(windowCenter, -90),
      windowEnd: addMinutes(windowCenter, 90),
      groupIds,
    };
    const ranked = rankRides(enriched, rider);
    return ranked
      .filter((x) => x.ride.driver_id !== userId)
      .map((x) => rideDto(x.ride, { matchScore: x.score, matchParts: x.parts }));
  },

  async getRide(locationId, rideId) {
    const r = await prisma.carpool_rides.findFirst({
      where: { id: rideId, location_id: locationId },
      include: { driver: { select: { display_name: true } } },
    });
    if (!r) throw new NotFoundError('Ride not found');
    const bookings = await prisma.carpool_bookings.findMany({
      where: { ride_id: rideId, status: { in: [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.CONFIRMED] } },
      include: { rider: { select: { display_name: true } } },
    });
    return rideDto(r, {
      bookings: bookings.map((b) => ({
        id: b.id,
        riderId: b.rider_id,
        riderName: b.rider?.display_name,
        status: b.status,
        seats: b.seats,
        pickup: { label: b.pickup_label },
      })),
    });
  },

  async listMyRides(locationId, userId) {
    const driven = await prisma.carpool_rides.findMany({
      where: { location_id: locationId, driver_id: userId },
      include: { driver: { select: { display_name: true } } },
      orderBy: { depart_at: 'desc' },
    });

    const bookings = await prisma.carpool_bookings.findMany({
      where: { rider_id: userId, status: { in: [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] } },
      select: { ride_id: true },
    });
    const rideIds = [...new Set(bookings.map((b) => b.ride_id))];
    const ridden = rideIds.length
      ? await prisma.carpool_rides.findMany({
          where: { id: { in: rideIds } },
          include: { driver: { select: { display_name: true } } },
          orderBy: { depart_at: 'desc' },
        })
      : [];

    return {
      driving: driven.map((r) => rideDto(r)),
      riding: ridden.map((r) => rideDto(r)),
    };
  },

  async postRide(locationId, driverId, body) {
    await assertLead(locationId, body.departAt);
    // If linking a charging session, it must belong to the driver.
    if (body.linkedSessionId) {
      const s = await prisma.sessions.findUnique({ where: { id: body.linkedSessionId }, select: { user_id: true } });
      if (!s || s.user_id !== driverId) throw new BusinessRuleError('Cannot link a session that is not yours.');
    }
    let data;
    try {
      data = await prisma.carpool_rides.create({
        data: {
          location_id: locationId,
          driver_id: driverId,
          direction: body.direction,
          origin_label: body.origin.label,
          depart_at: body.departAt,
          seats_total: body.seatsTotal,
          seats_available: body.seatsTotal,
          notes: body.notes || null,
          linked_session_id: body.linkedSessionId || null,
          group_id: body.groupId || null,
          status: RIDE_STATUS.OPEN,
        },
        include: { driver: { select: { display_name: true } } },
      });
    } catch (err) {
      if (err?.name?.startsWith('PrismaClient')) throw err; // DB failure → classified by the handler
      throw new ConflictError("Couldn't post your ride — double-check the departure time and seat count, then try again.");
    }
    await emit(EVENTS.CARPOOL_RIDE_POSTED, { locationId, rideId: data.id, driverId, direction: data.direction, departAt: data.depart_at, groupId: data.group_id });
    return rideDto(data);
  },

  async updateRide(locationId, driverId, rideId, patch) {
    const r = await prisma.carpool_rides.findUnique({ where: { id: rideId } });
    if (!r) throw new NotFoundError('Ride not found');
    if (r.driver_id !== driverId) throw new AuthorizationError('Not your ride');
    if (![RIDE_STATUS.OPEN, RIDE_STATUS.FULL].includes(r.status)) throw new BusinessRuleError('Ride can no longer be edited.');

    const update = {};
    if (patch.departAt) {
      await assertLead(locationId, patch.departAt);
      update.depart_at = patch.departAt;
    }
    if (patch.notes !== undefined) update.notes = patch.notes || null;
    if (patch.seatsTotal !== undefined) {
      const confirmed = r.seats_total - r.seats_available;
      if (patch.seatsTotal < confirmed) throw new BusinessRuleError(`You already have ${confirmed} seats taken.`);
      update.seats_total = patch.seatsTotal;
      update.seats_available = patch.seatsTotal - confirmed;
      update.status = update.seats_available > 0 ? RIDE_STATUS.OPEN : RIDE_STATUS.FULL;
    }
    const data = await prisma.carpool_rides.update({
      where: { id: rideId },
      data: update,
      include: { driver: { select: { display_name: true } } },
    });
    await emit(EVENTS.CARPOOL_RIDE_UPDATED, { locationId, rideId, driverId });
    return rideDto(data);
  },

  async cancelRide(locationId, driverId, rideId) {
    const r = await prisma.carpool_rides.findUnique({ where: { id: rideId } });
    if (!r) throw new NotFoundError('Ride not found');
    if (r.driver_id !== driverId) throw new AuthorizationError('Not your ride');
    if ([RIDE_STATUS.COMPLETED, RIDE_STATUS.CANCELLED].includes(r.status)) throw new BusinessRuleError('Ride already closed.');

    await prisma.carpool_rides.update({ where: { id: rideId }, data: { status: RIDE_STATUS.CANCELLED } });
    // Cancel outstanding bookings & notify riders via event.
    const bookings = await prisma.carpool_bookings.findMany({
      where: { ride_id: rideId, status: { in: [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.CONFIRMED] } },
      select: { id: true, rider_id: true },
    });
    await prisma.carpool_bookings.updateMany({
      where: { ride_id: rideId, status: { in: [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.CONFIRMED] } },
      data: { status: BOOKING_STATUS.CANCELLED },
    });
    await emit(EVENTS.CARPOOL_RIDE_CANCELLED, {
      locationId,
      rideId,
      driverId,
      affectedRiders: bookings.map((b) => b.rider_id),
    });
    return { success: true };
  },

  async bookRide(locationId, riderId, rideId, { pickup, seats = 1 }) {
    const r = await prisma.carpool_rides.findFirst({ where: { id: rideId, location_id: locationId } });
    if (!r) throw new NotFoundError('Ride not found');
    if (r.driver_id === riderId) throw new BusinessRuleError('You cannot book your own ride.');
    if (r.status !== RIDE_STATUS.OPEN) throw new BusinessRuleError('This ride is not open for booking.');
    if (r.seats_available < seats) throw new BusinessRuleError('Not enough seats available.');
    await assertLead(locationId, r.depart_at);

    let data;
    try {
      data = await prisma.carpool_bookings.create({
        data: {
          location_id: locationId,
          ride_id: rideId,
          rider_id: riderId,
          seats,
          pickup_label: pickup.label,
          status: BOOKING_STATUS.REQUESTED,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('You already requested a seat on this ride.');
      }
      if (err?.name?.startsWith('PrismaClient')) throw err; // DB failure → classified by the handler
      throw new ConflictError("Couldn't request a seat — the ride may have just filled up or been cancelled. Refresh the ride list and try again.");
    }
    await emit(EVENTS.CARPOOL_BOOKING_REQUESTED, { locationId, rideId, bookingId: data.id, riderId, driverId: r.driver_id });
    return { id: data.id, status: data.status };
  },

  async confirmBooking(locationId, driverId, bookingId) {
    const b = await prisma.carpool_bookings.findUnique({ where: { id: bookingId }, include: { carpool_rides: true } });
    if (!b) throw new NotFoundError('Booking not found');
    const ride = b.carpool_rides;
    if (!ride || ride.driver_id !== driverId) throw new AuthorizationError('Not your ride');
    if (b.status !== BOOKING_STATUS.REQUESTED) throw new BusinessRuleError('Booking is not pending.');
    // Guard against confirming into a ride that's no longer accepting bookings. Without this, a
    // leftover REQUESTED booking on a COMPLETED ride could be confirmed, which rewrites the ride's
    // status back to OPEN/FULL below — un-completing it and letting completeRide run a second time,
    // paying out credits + trip logs twice for the same ride.
    if (![RIDE_STATUS.OPEN, RIDE_STATUS.FULL].includes(ride.status)) {
      throw new BusinessRuleError('This ride is no longer accepting bookings.');
    }
    if (ride.seats_available < b.seats) throw new BusinessRuleError('Not enough seats left to confirm.');

    // Atomic seat claim: decrement only if enough seats remain RIGHT NOW (conditional updateMany),
    // rather than writing an absolute value computed from the earlier read. Two drivers confirming
    // two riders concurrently both read seats_available=2 and, with an absolute write, both wrote 1
    // — overbooking the car. The guarded decrement lets exactly one win; the loser's count is 0.
    const claim = await prisma.carpool_rides.updateMany({
      where: { id: ride.id, seats_available: { gte: b.seats } },
      data: { seats_available: { decrement: b.seats } },
    });
    if (claim.count === 0) throw new BusinessRuleError('Not enough seats left to confirm.');

    await prisma.carpool_bookings.update({ where: { id: bookingId }, data: { status: BOOKING_STATUS.CONFIRMED } });
    // Re-read the now-authoritative seat count to set OPEN/FULL correctly.
    const after = await prisma.carpool_rides.findUnique({ where: { id: ride.id }, select: { seats_available: true } });
    await prisma.carpool_rides.update({
      where: { id: ride.id },
      data: { status: after.seats_available > 0 ? RIDE_STATUS.OPEN : RIDE_STATUS.FULL },
    });

    await emit(EVENTS.CARPOOL_BOOKING_CONFIRMED, {
      locationId,
      rideId: ride.id,
      bookingId,
      riderId: b.rider_id,
      driverId,
      linkedSessionId: ride.linked_session_id,
      departAt: ride.depart_at,
    });
    return { success: true };
  },

  async declineBooking(locationId, driverId, bookingId) {
    const b = await prisma.carpool_bookings.findUnique({ where: { id: bookingId }, include: { carpool_rides: { select: { driver_id: true } } } });
    if (!b) throw new NotFoundError('Booking not found');
    if (b.carpool_rides?.driver_id !== driverId) throw new AuthorizationError('Not your ride');
    if (b.status !== BOOKING_STATUS.REQUESTED) throw new BusinessRuleError('Booking is not pending.');
    await prisma.carpool_bookings.update({ where: { id: bookingId }, data: { status: BOOKING_STATUS.DECLINED } });
    await emit(EVENTS.CARPOOL_BOOKING_DECLINED, { locationId, bookingId, riderId: b.rider_id, driverId });
    return { success: true };
  },

  async cancelBooking(locationId, userId, bookingId) {
    const b = await prisma.carpool_bookings.findUnique({ where: { id: bookingId }, include: { carpool_rides: true } });
    if (!b) throw new NotFoundError('Booking not found');
    const ride = b.carpool_rides;
    const isRider = b.rider_id === userId;
    const isDriver = ride?.driver_id === userId;
    if (!isRider && !isDriver) throw new AuthorizationError('Not your booking');
    if (![BOOKING_STATUS.REQUESTED, BOOKING_STATUS.CONFIRMED].includes(b.status)) {
      throw new BusinessRuleError('Booking cannot be cancelled.');
    }
    const wasConfirmed = b.status === BOOKING_STATUS.CONFIRMED;
    await prisma.carpool_bookings.update({ where: { id: bookingId }, data: { status: BOOKING_STATUS.CANCELLED } });
    // Return the seat if it had been confirmed.
    if (wasConfirmed && ride) {
      const remaining = ride.seats_available + b.seats;
      await prisma.carpool_rides.update({
        where: { id: ride.id },
        data: { seats_available: remaining, status: ride.status === RIDE_STATUS.FULL ? RIDE_STATUS.OPEN : ride.status },
      });
    }
    await emit(EVENTS.CARPOOL_BOOKING_CANCELLED, { locationId, bookingId, rideId: ride?.id, riderId: b.rider_id, byDriver: isDriver });
    return { success: true };
  },

  async completeRide(locationId, driverId, rideId, { milesOverride } = {}) {
    const r = await prisma.carpool_rides.findFirst({ where: { id: rideId, location_id: locationId } });
    if (!r) throw new NotFoundError('Ride not found');
    if (r.driver_id !== driverId) throw new AuthorizationError('Not your ride');
    if ([RIDE_STATUS.COMPLETED, RIDE_STATUS.CANCELLED].includes(r.status)) throw new BusinessRuleError('Ride already closed.');
    if (new Date(r.depart_at) > now()) {
      throw new BusinessRuleError("This ride hasn't departed yet.");
    }

    // Mirror carpoolComplete's (jobs.js) rule exactly: a ride with no confirmed riders closes
    // out with zero impact/credits/reliability bonus, instead of the driver being able to
    // post-then-immediately-complete an empty ride for free carpool_credit_per_trip credits
    // and a RELIABILITY_CARPOOL_DRIVER_BONUS on repeat.
    const confirmedCount = await prisma.carpool_bookings.count({
      where: { ride_id: rideId, status: BOOKING_STATUS.CONFIRMED },
    });
    if (confirmedCount === 0) {
      await prisma.carpool_rides.update({ where: { id: rideId }, data: { status: RIDE_STATUS.COMPLETED, completed_at: now() } });
      return { miles: 0, co2Grams: 0, riders: 0, driverCredits: 0 };
    }

    return completeRideImpact(r, milesOverride ?? null);
  },

  // ── Feature 1b: ride requests (rider "I need a ride") ─────────────────────────
  // Scoped to the caller's own requests — the client (CarpoolPage's "Requests" tab) renders
  // this as personal request management (a "Request a ride" button, a Cancel action per row,
  // and the caller's own suggested-drivers matches merged in), not a public browse list, so
  // an unscoped query here leaked every rider's pickup address and time window to everyone.
  async listRequests(locationId, riderId) {
    await ensureMaterialized(locationId);
    const data = await prisma.carpool_requests.findMany({
      // Include MATCHED, not just OPEN: once the matcher cron flips a request to MATCHED it must
      // stay visible so the rider can follow through on the ride the system just found for them —
      // filtering to OPEN made matched requests (and their notification's destination) silently
      // vanish from the Requests tab, stranding the rider.
      where: {
        location_id: locationId,
        rider_id: riderId,
        status: { in: [RIDE_REQUEST_STATUS.OPEN, RIDE_REQUEST_STATUS.MATCHED] },
        window_end: { gte: now() },
      },
      include: { rider: { select: { display_name: true } } },
      orderBy: { window_start: 'asc' },
    });
    return data.map((r) => ({
      id: r.id,
      riderId: r.rider_id,
      riderName: r.rider?.display_name,
      direction: r.direction,
      origin: { label: r.origin_label },
      windowStart: r.window_start,
      windowEnd: r.window_end,
      groupId: r.group_id,
      status: r.status,
      matchedRideId: r.matched_ride_id,
    }));
  },

  async postRequest(locationId, riderId, body) {
    if (new Date(body.windowEnd) <= new Date(body.windowStart)) {
      throw new BusinessRuleError('Window end must be after start.');
    }
    let data;
    try {
      data = await prisma.carpool_requests.create({
        data: {
          location_id: locationId,
          rider_id: riderId,
          direction: body.direction,
          origin_label: body.origin.label,
          window_start: body.windowStart,
          window_end: body.windowEnd,
          group_id: body.groupId || null,
          status: RIDE_REQUEST_STATUS.OPEN,
        },
      });
    } catch (err) {
      if (err?.name?.startsWith('PrismaClient')) throw err; // DB failure → classified by the handler
      throw new ConflictError("Couldn't post your ride request — check the direction and time window, then try again.");
    }
    return { id: data.id, status: data.status };
  },

  async cancelRequest(locationId, riderId, requestId) {
    const r = await prisma.carpool_requests.findUnique({ where: { id: requestId } });
    if (!r) throw new NotFoundError('Request not found');
    if (r.rider_id !== riderId) throw new AuthorizationError('Not your request');
    await prisma.carpool_requests.update({ where: { id: requestId }, data: { status: RIDE_REQUEST_STATUS.CANCELLED } });
    return { success: true };
  },

  // ── Feature 2: recurring schedules ────────────────────────────────────────────
  async listSchedules(locationId, userId) {
    const data = await prisma.carpool_schedules.findMany({
      where: { location_id: locationId, user_id: userId },
      orderBy: { created_at: 'desc' },
    });
    return data.map((s) => ({
      id: s.id,
      role: s.role,
      direction: s.direction,
      daysOfWeek: s.days_of_week,
      departTime: s.depart_time,
      origin: { label: s.origin_label },
      seats: s.seats,
      groupId: s.group_id,
      active: s.active,
    }));
  },

  async createSchedule(locationId, userId, body) {
    let data;
    try {
      data = await prisma.carpool_schedules.create({
        data: {
          location_id: locationId,
          user_id: userId,
          role: body.role,
          direction: body.direction,
          days_of_week: body.daysOfWeek,
          depart_time: body.departTime,
          origin_label: body.origin.label,
          seats: body.seats ?? 1,
          group_id: body.groupId || null,
          active: body.active ?? true,
        },
      });
    } catch (err) {
      if (err?.name?.startsWith('PrismaClient')) throw err; // DB failure → classified by the handler
      throw new ConflictError("Couldn't save your recurring commute — check the days and time, then try again.");
    }
    await emit(EVENTS.CARPOOL_SCHEDULE_CREATED, { locationId, scheduleId: data.id, userId, role: data.role });
    return { id: data.id };
  },

  async updateSchedule(locationId, userId, scheduleId, patch) {
    const s = await prisma.carpool_schedules.findUnique({ where: { id: scheduleId } });
    if (!s) throw new NotFoundError('Schedule not found');
    if (s.user_id !== userId) throw new AuthorizationError('Not your schedule');
    const update = {};
    if (patch.role) update.role = patch.role;
    if (patch.direction) update.direction = patch.direction;
    if (patch.daysOfWeek) update.days_of_week = patch.daysOfWeek;
    if (patch.departTime) update.depart_time = patch.departTime;
    if (patch.origin) {
      update.origin_label = patch.origin.label;
    }
    if (patch.seats !== undefined) update.seats = patch.seats;
    if (patch.groupId !== undefined) update.group_id = patch.groupId || null;
    if (patch.active !== undefined) update.active = patch.active;
    await prisma.carpool_schedules.update({ where: { id: scheduleId }, data: update });
    return { success: true };
  },

  async deleteSchedule(locationId, userId, scheduleId) {
    const s = await prisma.carpool_schedules.findUnique({ where: { id: scheduleId }, select: { user_id: true } });
    if (!s) throw new NotFoundError('Schedule not found');
    if (s.user_id !== userId) throw new AuthorizationError('Not your schedule');
    await prisma.carpool_schedules.delete({ where: { id: scheduleId } });
    await emit(EVENTS.CARPOOL_SCHEDULE_CANCELLED, { locationId, scheduleId, userId });
    return { success: true };
  },

  // ── Groups ─────────────────────────────────────────────────────────────────────
  async listGroups(locationId, userId) {
    const groups = await prisma.carpool_groups.findMany({
      where: { location_id: locationId },
      orderBy: { created_at: 'asc' },
    });
    const mine = new Set(await myGroupIds(userId));
    // member counts
    const ids = groups.map((g) => g.id);
    const counts = {};
    if (ids.length) {
      const members = await prisma.carpool_group_members.findMany({ where: { group_id: { in: ids } }, select: { group_id: true } });
      for (const m of members) counts[m.group_id] = (counts[m.group_id] || 0) + 1;
    }
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      memberCount: counts[g.id] || 0,
      isMember: mine.has(g.id),
    }));
  },

  async createGroup(locationId, userId, { name, description }) {
    let data;
    try {
      data = await prisma.carpool_groups.create({
        data: { location_id: locationId, name, description: description || null, created_by: userId },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(`A group named "${name}" already exists.`);
      }
      if (err?.name?.startsWith('PrismaClient')) throw err; // DB failure → classified by the handler
      throw new ConflictError(`Couldn't create the group "${name}". Try a different name, or try again in a moment.`);
    }
    await prisma.carpool_group_members.create({ data: { group_id: data.id, user_id: userId } });
    return { id: data.id };
  },

  async joinGroup(locationId, userId, groupId) {
    const g = await prisma.carpool_groups.findFirst({ where: { id: groupId, location_id: locationId }, select: { id: true } });
    if (!g) throw new NotFoundError('Group not found');
    await prisma.carpool_group_members.upsert({
      where: { group_id_user_id: { group_id: groupId, user_id: userId } },
      create: { group_id: groupId, user_id: userId },
      update: {},
    });
    return { success: true };
  },

  async leaveGroup(locationId, userId, groupId) {
    await prisma.carpool_group_members.deleteMany({ where: { group_id: groupId, user_id: userId } });
    return { success: true };
  },

  // ── Feature 4: matches, leaderboard, impact ────────────────────────────────────
  async myMatches(locationId, userId) {
    // My still-actionable requests → rank open rides for each. Include MATCHED (not only OPEN) so
    // a request the matcher already paired still shows its suggested rides — otherwise a matched
    // request disappears from both the Requests tab and its match suggestions, leaving the rider
    // unable to act on the ride they were notified about.
    const requests = await prisma.carpool_requests.findMany({
      where: {
        location_id: locationId,
        rider_id: userId,
        status: { in: [RIDE_REQUEST_STATUS.OPEN, RIDE_REQUEST_STATUS.MATCHED] },
      },
    });
    if (!requests.length) return [];

    const groupIds = await myGroupIds(userId);
    const minScore = await configService.getNumber(SETTING_KEYS.CARPOOL_MIN_MATCH_SCORE, locationId);

    // Candidate rides per request (windows differ per request, so these stay per-request), but
    // fetched first WITHOUT any per-ride query...
    const perRequestRides = await Promise.all(
      requests.map((req) =>
        prisma.carpool_rides.findMany({
          where: {
            location_id: locationId,
            direction: req.direction,
            status: RIDE_STATUS.OPEN,
            seats_available: { gt: 0 },
            depart_at: { gte: req.window_start, lte: req.window_end },
            driver_id: { not: userId },
          },
          include: { driver: { select: { display_name: true } } },
        })
      )
    );

    // ...then ONE grouped driver-stats query across every candidate driver (was an N+1 nested one
    // level deep: a driverStats query per candidate ride per request).
    const allDriverIds = perRequestRides.flat().map((r) => r.driver_id);
    const stats = await driverStatsFor(allDriverIds);

    const out = requests.map((req, i) => {
      const enriched = perRequestRides[i].map((r) => ({
        ...r,
        driverStats: stats.get(r.driver_id) || { completed: 0, cancelled: 0 },
      }));
      const rider = { windowStart: req.window_start, windowEnd: req.window_end, groupIds };
      const ranked = rankRides(enriched, rider).filter((x) => x.score >= minScore);
      return {
        requestId: req.id,
        direction: req.direction,
        matches: ranked.slice(0, 5).map((x) => rideDto(x.ride, { matchScore: x.score, matchParts: x.parts })),
      };
    });
    return out;
  },

  async leaderboard(locationId, { window = 'week', scope = 'location', groupId } = {}) {
    const since = window === 'all' ? null : window === 'month' ? addMinutes(now(), -43200) : addMinutes(now(), -10080);

    // Optional group filter — resolve the allowed user set first so it can go into the WHERE
    // clause (rather than pulling every log and discarding non-members in JS).
    let allowedIds = null;
    if (scope === 'group' && groupId) {
      const members = await prisma.carpool_group_members.findMany({ where: { group_id: groupId }, select: { user_id: true } });
      allowedIds = members.map((m) => m.user_id);
      if (!allowedIds.length) return [];
    }

    // Aggregate per user IN THE DB (was: pull every trip-log row for the window and sum in JS).
    // Postgres returns one row per user with the sums + trip count, already ordered, top 50.
    const grouped = await prisma.carpool_trip_logs.groupBy({
      by: ['user_id'],
      where: {
        location_id: locationId,
        ...(since ? { created_at: { gte: since } } : {}),
        ...(allowedIds ? { user_id: { in: allowedIds } } : {}),
      },
      _sum: { co2_grams_saved: true, credits_awarded: true },
      _count: { _all: true },
      orderBy: { _sum: { co2_grams_saved: 'desc' } },
      take: 50,
    });
    if (!grouped.length) return [];

    // One lookup for the display names of just the top-50 users (not every logger).
    const names = await prisma.users.findMany({
      where: { id: { in: grouped.map((g) => g.user_id) } },
      select: { id: true, display_name: true },
    });
    const nameById = new Map(names.map((u) => [u.id, u.display_name]));

    return grouped.map((g) => ({
      userId: g.user_id,
      name: nameById.get(g.user_id),
      trips: g._count._all,
      co2Kg: Math.round(((g._sum.co2_grams_saved || 0) / 1000) * 10) / 10,
      credits: g._sum.credits_awarded || 0,
    }));
  },

  /**
   * True location-wide totals for a window — unlike leaderboard(), which caps at the top 50
   * users by design (a ranked board, not a report). Summed directly from the DB with an
   * aggregate query rather than the capped in-memory leaderboard array, so this number is
   * correct even when more than 50 distinct users logged trips in the window.
   */
  async leaderboardTotals(locationId, { window = 'week' } = {}) {
    const since = window === 'all' ? null : window === 'month' ? addMinutes(now(), -43200) : addMinutes(now(), -10080);
    // Count each ride's CO2 exactly ONCE. completeRideImpact stores the FULL ride savings on the
    // driver's trip log AND each rider's share on their own row, so the driver rows alone already
    // sum to the true total — filtering to driver rows avoids the 2x double-count that summing
    // every row produced. `trips` = number of distinct completed rides (one driver row each).
    const agg = await prisma.carpool_trip_logs.aggregate({
      where: { location_id: locationId, role: CARPOOL_ROLE.DRIVER, ...(since ? { created_at: { gte: since } } : {}) },
      _sum: { co2_grams_saved: true },
      _count: { _all: true },
    });
    return {
      co2Kg: Math.round(((agg._sum.co2_grams_saved || 0) / 1000) * 10) / 10,
      trips: agg._count._all,
    };
  },

  // ── Admin overrides: location-wide visibility + force-cancel, no ownership check ──────
  async adminListRides(locationId) {
    const rides = await prisma.carpool_rides.findMany({
      where: { location_id: locationId, status: { in: [RIDE_STATUS.OPEN, RIDE_STATUS.FULL] } },
      include: { driver: { select: { display_name: true } } },
      orderBy: { depart_at: 'asc' },
    });
    return rides.map((r) => rideDto(r, { driverName: r.driver?.display_name }));
  },

  async adminCancelRide(locationId, rideId) {
    const r = await prisma.carpool_rides.findFirst({ where: { id: rideId, location_id: locationId } });
    if (!r) throw new NotFoundError('Ride not found');
    if ([RIDE_STATUS.COMPLETED, RIDE_STATUS.CANCELLED].includes(r.status)) throw new BusinessRuleError('Ride already closed.');

    await prisma.carpool_rides.update({ where: { id: rideId }, data: { status: RIDE_STATUS.CANCELLED } });
    const bookings = await prisma.carpool_bookings.findMany({
      where: { ride_id: rideId, status: { in: [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.CONFIRMED] } },
      select: { id: true, rider_id: true },
    });
    await prisma.carpool_bookings.updateMany({
      where: { ride_id: rideId, status: { in: [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.CONFIRMED] } },
      data: { status: BOOKING_STATUS.CANCELLED },
    });
    await emit(EVENTS.CARPOOL_RIDE_CANCELLED, {
      locationId,
      rideId,
      driverId: r.driver_id,
      affectedRiders: bookings.map((b) => b.rider_id),
    });
    return { success: true };
  },

  async adminListRequests(locationId) {
    const data = await prisma.carpool_requests.findMany({
      where: { location_id: locationId, status: RIDE_REQUEST_STATUS.OPEN },
      include: { rider: { select: { display_name: true } } },
      orderBy: { window_start: 'asc' },
    });
    return data.map((r) => ({
      id: r.id,
      riderId: r.rider_id,
      riderName: r.rider?.display_name,
      direction: r.direction,
      origin: { label: r.origin_label },
      windowStart: r.window_start,
      windowEnd: r.window_end,
      groupId: r.group_id,
    }));
  },

  async adminCancelRequest(locationId, requestId) {
    const r = await prisma.carpool_requests.findFirst({ where: { id: requestId, location_id: locationId } });
    if (!r) throw new NotFoundError('Request not found');
    await prisma.carpool_requests.update({ where: { id: requestId }, data: { status: RIDE_REQUEST_STATUS.CANCELLED } });
    return { success: true };
  },

  async adminListSchedules(locationId) {
    const data = await prisma.carpool_schedules.findMany({
      where: { location_id: locationId },
      include: { users: { select: { display_name: true } } },
      orderBy: { created_at: 'desc' },
    });
    return data.map((s) => ({
      id: s.id,
      userId: s.user_id,
      userName: s.users?.display_name,
      role: s.role,
      direction: s.direction,
      daysOfWeek: s.days_of_week,
      departTime: s.depart_time,
      origin: { label: s.origin_label },
      seats: s.seats,
      groupId: s.group_id,
      active: s.active,
    }));
  },

  async adminDeleteSchedule(locationId, scheduleId) {
    const s = await prisma.carpool_schedules.findFirst({ where: { id: scheduleId, location_id: locationId }, select: { user_id: true } });
    if (!s) throw new NotFoundError('Schedule not found');
    await prisma.carpool_schedules.delete({ where: { id: scheduleId } });
    await emit(EVENTS.CARPOOL_SCHEDULE_CANCELLED, { locationId, scheduleId, userId: s.user_id });
    return { success: true };
  },

  async adminListGroups(locationId) {
    return this.listGroups(locationId, null).then((groups) => groups.map(({ isMember, ...g }) => g));
  },

  async adminDeleteGroup(locationId, groupId) {
    const g = await prisma.carpool_groups.findFirst({ where: { id: groupId, location_id: locationId }, select: { id: true } });
    if (!g) throw new NotFoundError('Group not found');
    await prisma.carpool_group_members.deleteMany({ where: { group_id: groupId } });
    await prisma.carpool_groups.delete({ where: { id: groupId } });
    return { success: true };
  },

  async myImpact(locationId, userId) {
    const logs = await prisma.carpool_trip_logs.findMany({
      where: { location_id: locationId, user_id: userId },
      select: { miles: true, co2_grams_saved: true, credits_awarded: true, role: true },
    });
    const totals = logs.reduce(
      (a, l) => ({
        trips: a.trips + 1,
        miles: a.miles + (l.miles || 0),
        co2Kg: a.co2Kg + (l.co2_grams_saved || 0) / 1000,
        asDriver: a.asDriver + (l.role === CARPOOL_ROLE.DRIVER ? 1 : 0),
      }),
      { trips: 0, miles: 0, co2Kg: 0, asDriver: 0 }
    );
    const user = await prisma.users.findUnique({ where: { id: userId }, select: { carpool_credits: true } });
    // A tree absorbs ~21 kg CO2/year → ~1.75 kg/month. Fun comparison for the impact page.
    const treesMonth = Math.round((totals.co2Kg / 1.75) * 10) / 10;
    return {
      trips: totals.trips,
      asDriver: totals.asDriver,
      asRider: totals.trips - totals.asDriver,
      miles: Math.round(totals.miles),
      co2Kg: Math.round(totals.co2Kg * 10) / 10,
      credits: user?.carpool_credits ?? 0,
      treesEquivalentPerMonth: treesMonth,
    };
  },
};
