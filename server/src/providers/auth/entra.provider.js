/**
 * Microsoft Entra ID (Azure AD) auth provider — STUB.
 * Intentionally unbuilt: demonstrates the provider seam. Set AUTH_PROVIDER=entra to activate
 * (and implement these methods against MSAL / OIDC). Every method throws until built.
 */
import { NotImplementedError } from '../../utils/errors.js';

const nope = (method) => () => {
  throw new NotImplementedError(`entra.provider.${method}() is not implemented yet`);
};

export const entraProvider = {
  register: nope('register'),
  login: nope('login'),
  verifyAccessToken: nope('verifyAccessToken'),
  refreshAccessToken: nope('refreshAccessToken'),
  changePassword: nope('changePassword'),
  requestPasswordReset: nope('requestPasswordReset'),
  resetPassword: nope('resetPassword'),
  logout: nope('logout'),
};
