/** Queue module: location-scoped virtual line with grace/claim windows. */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { ok, created } from '../../utils/respond.js';
import { joinQueueSchema, leaveQueueSchema, claimQueueSchema } from '../../../../shared/validation.js';
import { queueService } from './queue.service.js';
import { queueListeners } from './listeners.js';

export default defineModule({
  name: 'queue',
  basePath: '/queue',
  realtimeTables: ['queue_entries'],
  listeners: queueListeners,
  routes(router) {
    router.use(authenticate);

    router.get('/', asyncHandler(async (req, res) => ok(res, await queueService.list(req.locationId))));

    router.get(
      '/me',
      asyncHandler(async (req, res) => ok(res, await queueService.getMine(req.locationId, req.user.userId)))
    );

    router.post(
      '/',
      validate(joinQueueSchema),
      asyncHandler(async (req, res) =>
        created(res, await queueService.join(req.locationId, req.user.userId, req.body.chargerId ?? null))
      )
    );

    router.post(
      '/claim',
      validate(claimQueueSchema),
      asyncHandler(async (req, res) =>
        ok(res, await queueService.claim(req.locationId, req.user.userId, req.body.queueEntryId))
      )
    );

    router.post(
      '/leave',
      validate(leaveQueueSchema),
      asyncHandler(async (req, res) =>
        ok(res, await queueService.leave(req.locationId, req.user.userId, req.body.queueEntryId))
      )
    );
  },
});
