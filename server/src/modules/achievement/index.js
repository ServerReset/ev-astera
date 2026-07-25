/**
 * Achievement module: read surface for a user's badge wall. Badge grants themselves are
 * side-effects of domain events (see listeners.js), never user-driven writes — so this module
 * exposes only reads, mirroring the reliability module's shape.
 */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { ok } from '../../utils/respond.js';
import { achievementService } from './achievement.service.js';
import { achievementListeners } from './listeners.js';

export default defineModule({
  name: 'achievement',
  basePath: '/achievements',
  listeners: achievementListeners,
  routes(router) {
    router.use(authenticate);
    router.get(
      '/me',
      asyncHandler(async (req, res) => ok(res, await achievementService.listForUser(req.user.userId, req.locationId)))
    );
  },
});
