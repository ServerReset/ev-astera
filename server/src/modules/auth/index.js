/** Auth module: root-scoped routes for register/login/refresh/logout/password reset. */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import { ok, created } from '../../utils/respond.js';
import { prisma } from '../../db/prisma.js';
import { registerSchema, loginSchema, signupStatusQuerySchema } from '../../../../shared/validation.js';
import { configService } from '../../services/config.service.js';
import { SETTING_KEYS } from '../../../../shared/constants.js';
import { authService, setRefreshCookie, clearRefreshCookie, refreshCookieName } from './auth.service.js';

export default defineModule({
  name: 'auth',
  scope: 'root',
  basePath: '/auth',
  routes(router) {
    // Public — lets the register page show a locked/gated state before the user submits, for
    // whichever office they've picked. The real enforcement lives server-side in
    // local.provider.js's register(); this route exposes nothing sensitive, just the gate state.
    router.get(
      '/signup-status',
      validate(signupStatusQuerySchema, 'query'),
      asyncHandler(async (req, res) => {
        const loc = req.query.locationId;
        const releaseAt = await configService.get(SETTING_KEYS.SIGNUP_RELEASE_AT, loc);
        const geofenceEnabled = await configService.getBool(SETTING_KEYS.SIGNUP_GEOFENCE_ENABLED, loc);
        // The geofence can only be enforced when the office actually has coordinates. Report the
        // effective (enforceable) state so the client only prompts for location when it matters —
        // a geofence-on office with no coords should not make users grant location for nothing.
        const office = await prisma.locations.findUnique({ where: { id: loc }, select: { site_lat: true, site_lng: true } });
        const geofenceEnforceable = geofenceEnabled && office?.site_lat != null && office?.site_lng != null;
        ok(res, { releaseAt: releaseAt || null, geofenceEnabled, geofenceEnforceable });
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

    // Deliberately NOT behind `authenticate`: logout must succeed even when the access token has
    // expired. We revoke the server-side session by the refresh-token cookie and always clear it,
    // so "sign out" truly ends the session regardless of access-token state.
    router.post(
      '/logout',
      asyncHandler(async (req, res) => {
        const token = req.cookies?.[refreshCookieName];
        await authService.logoutByRefreshToken(token);
        clearRefreshCookie(res);
        ok(res, { success: true });
      })
    );
  },
});
