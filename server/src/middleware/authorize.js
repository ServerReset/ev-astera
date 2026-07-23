/** Role gate. Use after `authenticate`. `authorize('admin')` → 403 unless req.user.role matches. */
import { AuthorizationError, AuthenticationError } from '../utils/errors.js';

export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(new AuthenticationError());
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new AuthorizationError());
    }
    next();
  };
