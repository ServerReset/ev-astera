/**
 * Carpool module — the full feature: rides, bookings, requests, schedules, groups,
 * matches, leaderboard, impact. Mounted location-scoped at /api/locations/:lid/carpool.
 * Contributes 7 listeners and 4 cron jobs. See docs/CARPOOL.md.
 */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { ok, created } from '../../utils/respond.js';
import {
  postRideSchema,
  updateRideSchema,
  bookRideSchema,
  completeRideSchema,
  postRequestSchema,
  createScheduleSchema,
  updateScheduleSchema,
  createGroupSchema,
  listRidesQuerySchema,
  leaderboardQuerySchema,
} from '../../../../shared/validation.js';
import { carpoolService } from './carpool.service.js';
import { carpoolListeners } from './listeners.js';

export default defineModule({
  name: 'carpool',
  basePath: '/carpool',
  realtimeTables: ['carpool_rides', 'carpool_bookings'],
  listeners: carpoolListeners,
  routes(router) {
    router.use(authenticate);
    const uid = (req) => req.user.userId;

    // ── Config (read-only, non-admin-gated values riders need to compose a ride) ──
    router.get('/config', asyncHandler(async (req, res) => ok(res, await carpoolService.getConfig(req.locationId))));

    // ── Rides ──────────────────────────────────────────────────────────────────
    router.get(
      '/rides',
      validate(listRidesQuerySchema, 'query'),
      asyncHandler(async (req, res) => ok(res, await carpoolService.listRides(req.locationId, uid(req), req.query)))
    );
    router.get(
      '/rides/mine',
      asyncHandler(async (req, res) => ok(res, await carpoolService.listMyRides(req.locationId, uid(req))))
    );
    router.post(
      '/rides',
      validate(postRideSchema),
      asyncHandler(async (req, res) => created(res, await carpoolService.postRide(req.locationId, uid(req), req.body)))
    );
    router.get(
      '/rides/:rideId',
      asyncHandler(async (req, res) => ok(res, await carpoolService.getRide(req.locationId, req.params.rideId)))
    );
    router.patch(
      '/rides/:rideId',
      validate(updateRideSchema),
      asyncHandler(async (req, res) => ok(res, await carpoolService.updateRide(req.locationId, uid(req), req.params.rideId, req.body)))
    );
    router.delete(
      '/rides/:rideId',
      asyncHandler(async (req, res) => ok(res, await carpoolService.cancelRide(req.locationId, uid(req), req.params.rideId)))
    );
    router.post(
      '/rides/:rideId/book',
      validate(bookRideSchema),
      asyncHandler(async (req, res) => created(res, await carpoolService.bookRide(req.locationId, uid(req), req.params.rideId, req.body)))
    );
    router.post(
      '/rides/:rideId/complete',
      validate(completeRideSchema),
      asyncHandler(async (req, res) => ok(res, await carpoolService.completeRide(req.locationId, uid(req), req.params.rideId, req.body)))
    );

    // ── Bookings ─────────────────────────────────────────────────────────────────
    router.post(
      '/bookings/:bookingId/confirm',
      asyncHandler(async (req, res) => ok(res, await carpoolService.confirmBooking(req.locationId, uid(req), req.params.bookingId)))
    );
    router.post(
      '/bookings/:bookingId/decline',
      asyncHandler(async (req, res) => ok(res, await carpoolService.declineBooking(req.locationId, uid(req), req.params.bookingId)))
    );
    router.post(
      '/bookings/:bookingId/cancel',
      asyncHandler(async (req, res) => ok(res, await carpoolService.cancelBooking(req.locationId, uid(req), req.params.bookingId)))
    );

    // ── Requests ─────────────────────────────────────────────────────────────────
    router.get(
      '/requests',
      asyncHandler(async (req, res) => ok(res, await carpoolService.listRequests(req.locationId, uid(req))))
    );
    router.post(
      '/requests',
      validate(postRequestSchema),
      asyncHandler(async (req, res) => created(res, await carpoolService.postRequest(req.locationId, uid(req), req.body)))
    );
    router.delete(
      '/requests/:requestId',
      asyncHandler(async (req, res) => ok(res, await carpoolService.cancelRequest(req.locationId, uid(req), req.params.requestId)))
    );

    // ── Schedules ────────────────────────────────────────────────────────────────
    router.get(
      '/schedules',
      asyncHandler(async (req, res) => ok(res, await carpoolService.listSchedules(req.locationId, uid(req))))
    );
    router.post(
      '/schedules',
      validate(createScheduleSchema),
      asyncHandler(async (req, res) => created(res, await carpoolService.createSchedule(req.locationId, uid(req), req.body)))
    );
    router.patch(
      '/schedules/:scheduleId',
      validate(updateScheduleSchema),
      asyncHandler(async (req, res) => ok(res, await carpoolService.updateSchedule(req.locationId, uid(req), req.params.scheduleId, req.body)))
    );
    router.delete(
      '/schedules/:scheduleId',
      asyncHandler(async (req, res) => ok(res, await carpoolService.deleteSchedule(req.locationId, uid(req), req.params.scheduleId)))
    );

    // ── Groups ───────────────────────────────────────────────────────────────────
    router.get(
      '/groups',
      asyncHandler(async (req, res) => ok(res, await carpoolService.listGroups(req.locationId, uid(req))))
    );
    router.post(
      '/groups',
      validate(createGroupSchema),
      asyncHandler(async (req, res) => created(res, await carpoolService.createGroup(req.locationId, uid(req), req.body)))
    );
    router.post(
      '/groups/:groupId/join',
      asyncHandler(async (req, res) => ok(res, await carpoolService.joinGroup(req.locationId, uid(req), req.params.groupId)))
    );
    router.post(
      '/groups/:groupId/leave',
      asyncHandler(async (req, res) => ok(res, await carpoolService.leaveGroup(req.locationId, uid(req), req.params.groupId)))
    );

    // ── Matches / impact / leaderboard ─────────────────────────────────────────────
    router.get(
      '/matches',
      asyncHandler(async (req, res) => ok(res, await carpoolService.myMatches(req.locationId, uid(req))))
    );
    router.get(
      '/leaderboard',
      validate(leaderboardQuerySchema, 'query'),
      asyncHandler(async (req, res) => ok(res, await carpoolService.leaderboard(req.locationId, req.query)))
    );
    router.get(
      '/leaderboard/totals',
      validate(leaderboardQuerySchema, 'query'),
      asyncHandler(async (req, res) => ok(res, await carpoolService.leaderboardTotals(req.locationId, req.query)))
    );
    router.get(
      '/impact/me',
      asyncHandler(async (req, res) => ok(res, await carpoolService.myImpact(req.locationId, uid(req))))
    );
  },
});
