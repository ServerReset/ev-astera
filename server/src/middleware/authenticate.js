/** Verify the Bearer access token and attach `req.user = { userId, email, role }`. */
import { authProvider } from '../providers/auth/index.js';
import { AuthenticationError } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AuthenticationError('Missing access token');

  try {
    req.user = await authProvider.verifyAccessToken(token);
  } catch {
    throw new AuthenticationError('Invalid or expired token');
  }
  next();
});
