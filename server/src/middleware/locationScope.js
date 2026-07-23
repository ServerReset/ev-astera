/**
 * Validates :locationId in the route and attaches req.locationId.
 * Caches known-good location ids briefly to avoid a DB hit per request.
 */
import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const known = new Map(); // id -> expires
const TTL = 5 * 60_000;

export const locationScope = asyncHandler(async (req, _res, next) => {
  const { locationId } = req.params;
  if (!locationId) throw new NotFoundError('Location not specified');

  const hit = known.get(locationId);
  if (!hit || hit < Date.now()) {
    const data = await prisma.locations.findUnique({ where: { id: locationId }, select: { id: true } });
    if (!data) throw new NotFoundError('Location not found');
    known.set(locationId, Date.now() + TTL);
  }
  req.locationId = locationId;
  next();
});
