/** Notification module: root-scoped read/mark endpoints + Web Push subscription management. */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { ok } from '../../utils/respond.js';
import { pushSubscribeSchema } from '../../../../shared/validation.js';
import { notificationService } from './notification.service.js';

export default defineModule({
  name: 'notification',
  scope: 'root',
  basePath: '/notifications',
  realtimeTables: ['notifications'],
  routes(router) {
    router.use(authenticate);

    router.get(
      '/',
      asyncHandler(async (req, res) => {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        ok(res, await notificationService.list(req.user.userId, page));
      })
    );

    router.get(
      '/unread-count',
      asyncHandler(async (req, res) => ok(res, await notificationService.unreadCount(req.user.userId)))
    );

    router.post(
      '/read-all',
      asyncHandler(async (req, res) => ok(res, await notificationService.markAllRead(req.user.userId)))
    );

    router.post(
      '/:notificationId/read',
      asyncHandler(async (req, res) =>
        ok(res, await notificationService.markRead(req.user.userId, req.params.notificationId))
      )
    );

    router.post(
      '/push/subscribe',
      validate(pushSubscribeSchema),
      asyncHandler(async (req, res) => ok(res, await notificationService.subscribePush(req.user.userId, req.body)))
    );

    router.post(
      '/push/unsubscribe',
      asyncHandler(async (req, res) =>
        ok(res, await notificationService.unsubscribePush(req.user.userId, req.body?.endpoint))
      )
    );
  },
});
