/** Auth module: root-scoped routes for register/login/refresh/logout/password reset. */
import { defineModule } from '../_kit/defineModule.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import { ok, created } from '../../utils/respond.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../../../shared/validation.js';
import { authService, setRefreshCookie, clearRefreshCookie, refreshCookieName } from './auth.service.js';

export default defineModule({
  name: 'auth',
  scope: 'root',
  basePath: '/auth',
  routes(router) {
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

    router.post(
      '/forgot-password',
      authLimiter,
      validate(forgotPasswordSchema),
      asyncHandler(async (req, res) => {
        await authService.requestPasswordReset(req.body.email);
        // Always generic — no user enumeration.
        ok(res, { message: 'If that email exists, a reset link has been sent.' });
      })
    );

    router.post(
      '/reset-password',
      authLimiter,
      validate(resetPasswordSchema),
      asyncHandler(async (req, res) => {
        await authService.resetPassword(req.body.token, req.body.password);
        ok(res, { success: true });
      })
    );
  },
});
