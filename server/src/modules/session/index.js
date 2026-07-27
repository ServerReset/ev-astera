/** Session module: location-scoped session lifecycle (start / update ETA / end). */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { ok, created } from '../../utils/respond.js';
import { startSessionSchema, updateEtaSchema, endSessionSchema } from '../../../../shared/validation.js';
import { sessionService } from './session.service.js';
import { chargerService } from '../charger/charger.service.js';
import { queueService } from '../queue/queue.service.js';
import { messageService } from '../message/message.service.js';

export default defineModule({
  name: 'session',
  basePath: '/sessions',
  realtimeTables: ['sessions', 'chargers'],
  routes(router) {
    router.use(authenticate);

    // Real admin-configured bounds, so the client's duration slider never desyncs from what
    // start()/updateEta() actually enforce.
    router.get(
      '/config',
      asyncHandler(async (req, res) => ok(res, await sessionService.getConfig(req.locationId)))
    );

    // Current user's active session (if any).
    router.get(
      '/active',
      asyncHandler(async (req, res) => ok(res, await sessionService.getActive(req.user.userId)))
    );

    // Consolidated dashboard snapshot — ONE request that returns everything the dashboard polls
    // (chargers + state, my active session, the queue, my queue entry, active emergencies) instead
    // of the client firing 5 separate requests every poll tick. Same underlying queries, run in
    // parallel; the win is one round-trip per tick (and the client no longer fans out 5 polls).
    router.get(
      '/dashboard',
      asyncHandler(async (req, res) => {
        const { locationId } = req;
        const userId = req.user.userId;
        const [chargers, active, queue, mine, emergencies] = await Promise.all([
          chargerService.listWithState(locationId),
          sessionService.getActive(userId),
          queueService.list(locationId),
          queueService.getMine(locationId, userId),
          messageService.listActiveEmergencies(locationId),
        ]);
        ok(res, { chargers, active, queue, mine, emergencies });
      })
    );

    router.post(
      '/',
      validate(startSessionSchema),
      asyncHandler(async (req, res) =>
        created(res, await sessionService.start(req.locationId, req.locationTz, req.user.userId, req.body))
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
