/** User module: root-scoped /users/me profile, password, stats. */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { ok } from '../../utils/respond.js';
import { env } from '../../config/index.js';
import { updateProfileSchema, changePasswordSchema } from '../../../../shared/validation.js';
import { userService } from './user.service.js';
import { authService } from '../auth/auth.service.js';

export default defineModule({
  name: 'user',
  scope: 'root',
  basePath: '/users',
  routes(router) {
    router.use(authenticate);

    router.get(
      '/me',
      asyncHandler(async (req, res) => ok(res, await userService.getById(req.user.userId)))
    );

    router.patch(
      '/me',
      validate(updateProfileSchema),
      asyncHandler(async (req, res) => ok(res, await userService.updateProfile(req.user.userId, req.body)))
    );

    router.patch(
      '/me/password',
      validate(changePasswordSchema),
      asyncHandler(async (req, res) => {
        await authService.changePassword(req.user.userId, req.body.currentPassword, req.body.newPassword);
        ok(res, { success: true });
      })
    );

    router.get(
      '/me/stats',
      asyncHandler(async (req, res) =>
        ok(res, await userService.getStats(req.user.userId, req.user.locationId || env.defaultLocationId))
      )
    );

    router.get(
      '/me/history',
      asyncHandler(async (req, res) => {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        ok(res, await userService.getHistory(req.user.userId, page));
      })
    );
  },
});
