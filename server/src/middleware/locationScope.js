/**
 * Validates :locationId in the route and attaches req.locationId.
 * Caches known-good location ids briefly to avoid a DB hit per request.
 *
 * Mounted after `authenticate` (see app.js), so req.user is already set — this also enforces
 * that the caller's own home location matches the route param. Without this, any authenticated
 * user could act on another location's queue/sessions/admin data simply by editing the
 * :locationId segment of the URL, since nothing else in the request path checks it.
 */
import { prisma } from '../db/prisma.js';
import { NotFoundError, AuthorizationError } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const known = new Map(); // id -> expires
const TTL = 5 * 60_000;

export const locationScope = asyncHandler(async (req, _res, next) => {
  const { locationId } = req.params;
  if (!locationId) throw new NotFoundError('Location not specified');
  if (req.user?.locationId && req.user.locationId !== locationId) {
    throw new AuthorizationError('Not authorized for this location');
  }

  const hit = known.get(locationId);
  if (!hit || hit < Date.now()) {
    const data = await prisma.locations.findUnique({ where: { id: locationId }, select: { id: true } });
    if (!data) throw new NotFoundError('Location not found');
    known.set(locationId, Date.now() + TTL);
  }
  req.locationId = locationId;
  next();
});
