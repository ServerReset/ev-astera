/** Auth module: root-scoped routes for register/login/refresh/logout/password reset. */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import { ok, created } from '../../utils/respond.js';
import { registerSchema, loginSchema } from '../../../../shared/validation.js';
import { configService } from '../../services/config.service.js';
import { env } from '../../config/index.js';
import { SETTING_KEYS } from '../../../../shared/constants.js';
import { authService, setRefreshCookie, clearRefreshCookie, refreshCookieName } from './auth.service.js';

export default defineModule({
  name: 'auth',
  scope: 'root',
  basePath: '/auth',
  routes(router) {
    // Public — lets the register page show a locked/gated state before the user submits.
    // The real enforcement lives server-side in local.provider.js's register(); this route
    // exposes nothing sensitive, just the gate state.
    router.get(
      '/signup-status',
      asyncHandler(async (req, res) => {
        const loc = env.defaultLocationId;
        const releaseAt = await configService.get(SETTING_KEYS.SIGNUP_RELEASE_AT, loc);
        const geofenceEnabled = await configService.getBool(SETTING_KEYS.SIGNUP_GEOFENCE_ENABLED, loc);
        ok(res, { releaseAt: releaseAt || null, geofenceEnabled });
      })
    );

    router.post(
      '/register',
      authLimiter,
      validate(registerSchema),
      asyncHandler(async (req, res) => {
        const { user, accessToken, refreshToken } = await authService.register(req.body);
        setRefreshCookie(res, refreshToken, false);
        created(res, { user, accessToken });
      })
    );

    router.post(
      '/login',
      authLimiter,
      validate(loginSchema),
      asyncHandler(async (req, res) => {
        const { user, accessToken, refreshToken } = await authService.login(req.body);
        setRefreshCookie(res, refreshToken, req.body.rememberMe);
        ok(res, { user, accessToken });
      })
    );

    router.post(
      '/refresh',
      asyncHandler(async (req, res) => {
        const token = req.cookies?.[refreshCookieName];
        const { accessToken, user } = await authService.refresh(token);
        ok(res, { accessToken, user });
      })
    );

    router.post(
      '/logout',
      authenticate,
      asyncHandler(async (req, res) => {
        const token = req.cookies?.[refreshCookieName];
        await authService.logout(req.user.userId, token);
        clearRefreshCookie(res);
        ok(res, { success: true });
      })
    );
  },
});
