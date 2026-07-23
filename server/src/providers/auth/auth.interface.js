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
 * requestPasswordReset(email)         → void   (never reveals existence)
 * resetPassword(token, newPassword)   → void
 * logout(userId, refreshToken)        → void
 */
export const AUTH_PROVIDER_METHODS = [
  'register',
  'login',
  'verifyAccessToken',
  'refreshAccessToken',
  'changePassword',
  'requestPasswordReset',
  'resetPassword',
  'logout',
];
