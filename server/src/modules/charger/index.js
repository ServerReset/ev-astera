/** Charger module: location-scoped read endpoints for the dashboard. */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/respond.js';
import { chargerService } from './charger.service.js';

export default defineModule({
  name: 'charger',
  basePath: '/chargers',
  realtimeTables: ['chargers', 'sessions', 'queue_entries'],
  routes(router) {
    router.get(
      '/',
      asyncHandler(async (req, res) => ok(res, await chargerService.listWithState(req.locationId)))
    );
    router.get(
      '/:chargerId',
      asyncHandler(async (req, res) => ok(res, await chargerService.getOne(req.locationId, req.params.chargerId)))
    );
  },
});
