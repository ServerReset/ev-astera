/**
 * Reliability module: the score/leaderboard read surface. Score changes themselves are
 * side-effects of session/carpool events (see listeners.js), not user-driven writes, so this
 * module exposes only reads.
 */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { ok } from '../../utils/respond.js';
import { reliabilityService } from './reliability.service.js';
import { reliabilityListeners } from './listeners.js';

export default defineModule({
  name: 'reliability',
  basePath: '/reliability',
  listeners: reliabilityListeners,
  routes(router) {
    router.use(authenticate);
    const uid = (req) => req.user.userId;

    router.get('/me', asyncHandler(async (req, res) => ok(res, await reliabilityService.getScore(uid(req), req.locationId))));
    router.get(
      '/leaderboard',
      asyncHandler(async (req, res) => {
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
        ok(res, await reliabilityService.leaderboard(req.locationId, { limit }));
      })
    );
  },
});
