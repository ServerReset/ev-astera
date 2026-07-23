/**
 * Carpool matcher. Scores a candidate ride for a rider on 0–100:
 *
 *   score = 45*routeOverlap + 30*timeFit + 15*reliability + 10*groupAffinity
 *
 * See docs/CARPOOL.md §"The matcher". Pure functions — no I/O — so they're trivially testable.
 */
import { haversineMiles, detourMiles } from '../../utils/geo.js';

const WEIGHTS = Object.freeze({ routeOverlap: 45, timeFit: 30, reliability: 15, groupAffinity: 10 });

/** 1 when the detour is ~0, decaying to 0 at the configured cap. */
export function routeOverlapScore(driverOrigin, pickup, site, maxDetourMiles) {
  const detour = detourMiles(driverOrigin, pickup, site);
  if (!Number.isFinite(detour)) return 0;
  return Math.max(0, 1 - detour / Math.max(0.1, maxDetourMiles));
}

/** 1 when depart_at is at the center of [windowStart, windowEnd], 0 at/outside the edges. */
export function timeFitScore(departAt, windowStart, windowEnd) {
  const t = new Date(departAt).getTime();
  const a = new Date(windowStart).getTime();
  const b = new Date(windowEnd).getTime();
  if (t < a || t > b || b <= a) return t === a && a === b ? 1 : 0;
  const center = (a + b) / 2;
  const half = (b - a) / 2;
  return Math.max(0, 1 - Math.abs(t - center) / half);
}

/** Smoothed completion ratio: (completed + 1) / (completed + cancelled + 2). */
export function reliabilityScore(completed = 0, cancelled = 0) {
  return (completed + 1) / (completed + cancelled + 2);
}

export function groupAffinityScore(riderGroupIds = [], rideGroupId = null) {
  if (!rideGroupId) return 0;
  return riderGroupIds.includes(rideGroupId) ? 1 : 0;
}

/**
 * Score one ride for one rider.
 * @param {object} ride       { origin:{lat,lng}, depart_at, group_id, driverStats:{completed,cancelled} }
 * @param {object} rider      { pickup:{lat,lng}, windowStart, windowEnd, groupIds:[] }
 * @param {object} site       { lat, lng }
 * @param {object} cfg        { maxDetourMiles }
 * @returns {{score:number, parts:object}}
 */
export function scoreRide(ride, rider, site, cfg) {
  const parts = {
    routeOverlap: routeOverlapScore(ride.origin, rider.pickup, site, cfg.maxDetourMiles),
    timeFit: timeFitScore(ride.depart_at, rider.windowStart, rider.windowEnd),
    reliability: reliabilityScore(ride.driverStats?.completed, ride.driverStats?.cancelled),
    groupAffinity: groupAffinityScore(rider.groupIds, ride.group_id),
  };
  const score =
    WEIGHTS.routeOverlap * parts.routeOverlap +
    WEIGHTS.timeFit * parts.timeFit +
    WEIGHTS.reliability * parts.reliability +
    WEIGHTS.groupAffinity * parts.groupAffinity;
  return { score: Math.round(score), parts };
}

/**
 * Rank rides for a rider, best first. Ties broken by earliest depart_at.
 * Returns [{ ride, score, parts }].
 */
export function rankRides(rides, rider, site, cfg) {
  return rides
    .map((ride) => ({ ride, ...scoreRide(ride, rider, site, cfg) }))
    .sort((a, b) => b.score - a.score || new Date(a.ride.depart_at) - new Date(b.ride.depart_at));
}
