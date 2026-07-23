/** Session module: location-scoped session lifecycle (start / update ETA / end). */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { ok, created } from '../../utils/respond.js';
import { startSessionSchema, updateEtaSchema, endSessionSchema } from '../../../../shared/validation.js';
import { sessionService } from './session.service.js';

export default defineModule({
  name: 'session',
  basePath: '/sessions',
  realtimeTables: ['sessions', 'chargers'],
  routes(router) {
    router.use(authenticate);

    // Current user's active session (if any).
    router.get(
      '/active',
      asyncHandler(async (req, res) => ok(res, await sessionService.getActive(req.user.userId)))
    );

    router.post(
      '/',
      validate(startSessionSchema),
      asyncHandler(async (req, res) =>
        created(res, await sessionService.start(req.locationId, req.user.userId, req.body))
      )
    );

    router.patch(
      '/:sessionId/eta',
      validate(updateEtaSchema),
      asyncHandler(async (req, res) =>
        ok(res, await sessionService.updateEta(req.locationId, req.user.userId, req.params.sessionId, req.body.durationMinutes))
      )
    );

    // End requires the full "clean up" checklist (validated) but the flags themselves are advisory.
    router.post(
      '/:sessionId/end',
      validate(endSessionSchema),
      asyncHandler(async (req, res) =>
        ok(res, await sessionService.end(req.locationId, req.user.userId, req.params.sessionId))
      )
    );
  },
});
