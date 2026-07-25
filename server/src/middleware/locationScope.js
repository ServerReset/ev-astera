/**
 * Validates :locationId in the route and attaches req.locationId + req.locationTz.
 * Caches known-good locations briefly to avoid a DB hit per request (see utils/locationTz.js).
 *
 * Mounted after `authenticate` (see app.js), so req.user is already set — this also enforces
 * that the caller's own home location matches the route param. Without this, any authenticated
 * user could act on another location's queue/sessions/admin data simply by editing the
 * :locationId segment of the URL, since nothing else in the request path checks it.
 *
 * A super-admin is exempt from that equality check — they manage every office, not just their
 * own home one — which is what lets them reuse every site-admin route (chargers/carpool/
 * settings/users) against any :locationId with no separate cross-office admin routes.
 */
import { NotFoundError, AuthorizationError } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getLocationMeta } from '../utils/locationTz.js';
import { ROLES } from '../../../shared/constants.js';

export const locationScope = asyncHandler(async (req, _res, next) => {
  const { locationId } = req.params;
  if (!locationId) throw new NotFoundError('Location not specified');

  const isSuperAdmin = req.user?.role === ROLES.SUPER_ADMIN;
  if (!isSuperAdmin && req.user?.locationId && req.user.locationId !== locationId) {
    throw new AuthorizationError('Not authorized for this location');
  }

  const meta = await getLocationMeta(locationId);
  // A deactivated office is fully inert to every scoped route, not just newly-hidden from
  // signup — treating it as 404 (not 403) matches how it already looks to anyone who doesn't
  // already know it exists.
  if (!meta || !meta.active) throw new NotFoundError('Location not found');

  req.locationId = locationId;
  req.locationTz = meta.tz;
  next();
});
