/** Message module: location-scoped nudges + emergency requests. */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { ok, created } from '../../utils/respond.js';
import { nudgeSchema, nudgeReactSchema, emergencyRequestSchema, emergencyRespondSchema } from '../../../../shared/validation.js';
import { messageService } from './message.service.js';
import { messageListeners } from './listeners.js';

export default defineModule({
  name: 'message',
  basePath: '/messages',
  listeners: messageListeners,
  routes(router) {
    router.use(authenticate);

    router.post(
      '/nudge',
      validate(nudgeSchema),
      asyncHandler(async (req, res) =>
        created(res, await messageService.nudge(req.locationId, req.user.userId, req.body))
      )
    );

    router.post(
      '/nudge/react',
      validate(nudgeReactSchema),
      asyncHandler(async (req, res) =>
        ok(res, await messageService.reactToNudge(req.user.userId, req.body))
      )
    );

    router.get(
      '/emergencies',
      asyncHandler(async (req, res) => ok(res, await messageService.listActiveEmergencies(req.locationId)))
    );

    router.post(
      '/emergency',
      validate(emergencyRequestSchema),
      asyncHandler(async (req, res) =>
        created(res, await messageService.requestEmergency(req.locationId, req.user.userId, req.body))
      )
    );

    router.post(
      '/emergency/respond',
      validate(emergencyRespondSchema),
      asyncHandler(async (req, res) =>
        ok(res, await messageService.respondEmergency(req.locationId, req.user.userId, req.body))
      )
    );
  },
});
