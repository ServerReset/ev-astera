/**
 * Auth provider interface (documentation-only; JS has no interfaces).
 * Every provider (local, entra, …) MUST implement these methods with these shapes.
 * See docs/CONTRACTS.md and the original spec §"Auth Provider Pattern".
 *
 * register({ email, password, displayName, vehicleDescription?, locationId })
 *   → { user, accessToken, refreshToken }
 * login({ email, password, rememberMe?, locationId })
 *   → { user, accessToken, refreshToken }
 * verifyAccessToken(token)            → { userId, email, role }
 * refreshAccessToken(refreshToken)    → { accessToken, user }
 * changePassword(userId, currentPassword, newPassword) → void
 * logout(userId, refreshToken)        → void
 *
 * There is no self-service "forgot password" — this deployment has no outbound email, so a
 * locked-out user must ask an admin to reset their password (Admin → Users → Reset password),
 * which sets and reveals a one-time temp password server-side (see admin.service.js).
 */
export const AUTH_PROVIDER_METHODS = [
  'register',
  'login',
  'verifyAccessToken',
  'refreshAccessToken',
  'changePassword',
  'logout',
];
