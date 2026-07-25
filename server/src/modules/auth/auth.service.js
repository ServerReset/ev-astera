/** Auth service: thin orchestration over the active auth provider + refresh-cookie helpers. */
import { authProvider } from '../../providers/auth/index.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { env } from '../../config/index.js';

// This module still needs `env` for the cookie helpers below (isProd, refresh expiry) even
// though register()/login() no longer inject env.defaultLocationId — locationId now comes from
// the request body (register: user-selected office) or is unused (login: looked up by email).

const COOKIE_NAME = 'ev_refresh';

export function setRefreshCookie(res, token, remember) {
  const maxDays = remember ? parseInt(env.refreshExpiryRemember, 10) || 30 : parseInt(env.refreshExpiry, 10) || 7;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'strict',
    maxAge: maxDays * 86_400_000,
    path: '/api',
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/api' });
}

export const refreshCookieName = COOKIE_NAME;

export const authService = {
  async register(input) {
    const result = await authProvider.register(input);
    emit(EVENTS.USER_REGISTERED, { locationId: result.user.locationId, userId: result.user.id });
    return result;
  },

  async login(input) {
    return authProvider.login(input);
  },

  async refresh(refreshToken) {
    return authProvider.refreshAccessToken(refreshToken);
  },

  async logout(userId, refreshToken) {
    return authProvider.logout(userId, refreshToken);
  },

  async changePassword(userId, currentPassword, newPassword) {
    return authProvider.changePassword(userId, currentPassword, newPassword);
  },
};
