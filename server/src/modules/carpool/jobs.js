/**
 * Carpool daily jobs (run via the Vercel Cron endpoint, api/cron/daily.js):
 *   carpoolMaterialize  recurring schedules → concrete rides/requests
 *   carpoolMatch        pair open requests with open rides above threshold
 *   carpoolComplete     auto-complete departed rides w/ confirmed riders
 *
 * carpoolReminder (the old 5-min imminent-departure nudge) has no daily-cron equivalent
 * and was dropped when the frequent-cron sweeps were replaced by compute-on-read + daily cron.
 */
import { prisma } from '../../db/prisma.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { configService } from '../../services/config.service.js';
import {
  RIDE_STATUS,
  BOOKING_STATUS,
  RIDE_REQUEST_STATUS,
  CARPOOL_ROLE,
  SETTING_KEYS,
} from '../../../../shared/constants.js';
import { addDays, addMinutes, now, atLocalTime, localWeekday } from '../../utils/timeUtils.js';
import { rankRides } from './matcher.js';
import { completeRideImpact } from './impact.js';

async function activeLocations() {
  return prisma.locations.findMany({ select: { id: true, site_lat: true, site_lng: true } });
}

// ── carpoolMaterialize ───────────────────────────────────────────────────────
export async function carpoolMaterialize() {
  let actions = 0;
  for (const loc of await activeLocations()) {
    const days = await configService.getNumber(SETTING_KEYS.CARPOOL_MATERIALIZE_DAYS, loc.id);
    const schedules = await prisma.carpool_schedules.findMany({ where: { location_id: loc.id, active: true } });

    for (const s of schedules) {
      for (let d = 0; d <= days; d++) {
        const target = addDays(now(), d);
        const dow = localWeekday(target);
        if (!s.days_of_week.includes(dow)) continue;
        const departAt = atLocalTime(target, s.depart_time);
        if (departAt <= now()) continue;

        // Skip if a concrete ride/request already exists for this schedule around that time.
        const windowLo = addMinutes(departAt, -60);
        const windowHi = addMinutes(departAt, 60);

        if (s.role === CARPOOL_ROLE.DRIVER) {
          const existing = await prisma.carpool_rides.findFirst({
            where: { schedule_id: s.id, depart_at: { gte: windowLo, lte: windowHi } },
            select: { id: true },
          });
          if (existing) continue;
          await prisma.carpool_rides.create({
            data: {
              location_id: loc.id,
              driver_id: s.user_id,
              direction: s.direction,
              origin_label: s.origin_label,
              origin_lat: s.origin_lat,
              origin_lng: s.origin_lng,
              depart_at: departAt,
              seats_total: s.seats,
              seats_available: s.seats,
              schedule_id: s.id,
              group_id: s.group_id,
              status: RIDE_STATUS.OPEN,
            },
          });
          actions++;
        } else {
          const existing = await prisma.carpool_requests.findFirst({
            where: {
              schedule_id: s.id,
              window_start: { gte: addMinutes(departAt, -120) },
              window_end: { lte: addMinutes(departAt, 120) },
            },
            select: { id: true },
          });
          if (existing) continue;
          await prisma.carpool_requests.create({
            data: {
              location_id: loc.id,
              rider_id: s.user_id,
              direction: s.direction,
              origin_label: s.origin_label,
              origin_lat: s.origin_lat,
              origin_lng: s.origin_lng,
              window_start: addMinutes(departAt, -30),
              window_end: addMinutes(departAt, 30),
              schedule_id: s.id,
              group_id: s.group_id,
              status: RIDE_REQUEST_STATUS.OPEN,
            },
          });
          actions++;
        }
      }
    }
  }
  return { actions };
}

// ── carpoolMatch ─────────────────────────────────────────────────────────────
export async function carpoolMatch() {
  let actions = 0;
  for (const loc of await activeLocations()) {
    const site = { lat: loc.site_lat, lng: loc.site_lng };
    const maxDetourMiles = await configService.getNumber(SETTING_KEYS.CARPOOL_MAX_DETOUR_MILES, loc.id);
    const minScore = await configService.getNumber(SETTING_KEYS.CARPOOL_MIN_MATCH_SCORE, loc.id);

    const requests = await prisma.carpool_requests.findMany({
      where: { location_id: loc.id, status: RIDE_REQUEST_STATUS.OPEN, window_end: { gte: now() } },
    });

    for (const req of requests) {
      const rides = await prisma.carpool_rides.findMany({
        where: {
          location_id: loc.id,
          direction: req.direction,
          status: RIDE_STATUS.OPEN,
          seats_available: { gt: 0 },
          depart_at: { gte: req.window_start, lte: req.window_end },
        },
      });
      if (!rides.length) continue;

      const enriched = rides.map((r) => ({ ...r, origin: { lat: r.origin_lat, lng: r.origin_lng } }));
      const rider = {
        pickup: { lat: req.origin_lat, lng: req.origin_lng },
        windowStart: req.window_start,
        windowEnd: req.window_end,
        groupIds: [],
      };
      const [best] = rankRides(enriched, rider, site, { maxDetourMiles });
      if (best && best.score >= minScore) {
        // Mark matched (soft — rider still books explicitly) and notify both sides once.
        await prisma.carpool_requests.update({
          where: { id: req.id },
          data: { status: RIDE_REQUEST_STATUS.MATCHED, matched_ride_id: best.ride.id },
        });
        await emit(EVENTS.CARPOOL_MATCH_FOUND, {
          locationId: loc.id,
          requestId: req.id,
          rideId: best.ride.id,
          riderId: req.rider_id,
          driverId: best.ride.driver_id,
          departAt: best.ride.depart_at,
          score: best.score,
        });
        actions++;
      }
    }
  }
  return { actions };
}

// ── carpoolComplete ──────────────────────────────────────────────────────────
export async function carpoolComplete() {
  let actions = 0;
  for (const loc of await activeLocations()) {
    const site = { lat: loc.site_lat, lng: loc.site_lng };
    // Rides whose departure passed (with a grace of 2h) and still open/full/in_progress.
    const cutoff = addMinutes(now(), -120);
    const rides = await prisma.carpool_rides.findMany({
      where: {
        location_id: loc.id,
        status: { in: [RIDE_STATUS.OPEN, RIDE_STATUS.FULL, RIDE_STATUS.IN_PROGRESS] },
        depart_at: { lte: cutoff },
        completed_at: null,
      },
    });

    for (const ride of rides) {
      const count = await prisma.carpool_bookings.count({ where: { ride_id: ride.id, status: BOOKING_STATUS.CONFIRMED } });
      if (count > 0) {
        await completeRideImpact(ride, site, null);
      } else {
        // No riders — just close it out without impact.
        await prisma.carpool_rides.update({ where: { id: ride.id }, data: { status: RIDE_STATUS.COMPLETED, completed_at: now() } });
      }
      actions++;
    }

    // Expire stale open requests whose window fully passed.
    await prisma.carpool_requests.updateMany({
      where: { location_id: loc.id, status: RIDE_REQUEST_STATUS.OPEN, window_end: { lt: now() } },
      data: { status: RIDE_REQUEST_STATUS.EXPIRED },
    });
  }
  return { actions };
}
