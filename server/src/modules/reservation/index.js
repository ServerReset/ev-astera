/** Reservation module: location-scoped booking of future charger windows. */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { ok, created } from '../../utils/respond.js';
import { createReservationSchema } from '../../../../shared/validation.js';
import { reservationService } from './reservation.service.js';

export default defineModule({
  name: 'reservation',
  basePath: '/reservations',
  realtimeTables: ['reservations'],
  routes(router) {
    router.use(authenticate);

    router.get(
      '/',
      asyncHandler(async (req, res) => ok(res, await reservationService.listUpcoming(req.locationId)))
    );

    router.get(
      '/me',
      asyncHandler(async (req, res) => ok(res, await reservationService.listMine(req.locationId, req.user.userId)))
    );

    router.post(
      '/',
      validate(createReservationSchema),
      asyncHandler(async (req, res) =>
        created(res, await reservationService.create(req.locationId, req.user.userId, req.body))
      )
    );

    router.delete(
      '/:reservationId',
      asyncHandler(async (req, res) =>
        ok(res, await reservationService.cancel(req.locationId, req.user.userId, req.params.reservationId))
      )
    );
  },
});
