/**
 * Carpool matcher. Scores a candidate ride for a rider on 0–100:
 *
 *   score = 55*timeFit + 27*reliability + 18*groupAffinity
 *
 * See docs/CARPOOL.md §"The matcher". Pure functions — no I/O — so they're trivially testable.
 */

const WEIGHTS = Object.freeze({ timeFit: 55, reliability: 27, groupAffinity: 18 });

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
 * @param {object} ride       { depart_at, group_id, driverStats:{completed,cancelled} }
 * @param {object} rider      { windowStart, windowEnd, groupIds:[] }
 * @returns {{score:number, parts:object}}
 */
export function scoreRide(ride, rider) {
  const parts = {
    timeFit: timeFitScore(ride.depart_at, rider.windowStart, rider.windowEnd),
    reliability: reliabilityScore(ride.driverStats?.completed, ride.driverStats?.cancelled),
    groupAffinity: groupAffinityScore(rider.groupIds, ride.group_id),
  };
  const score =
    WEIGHTS.timeFit * parts.timeFit +
    WEIGHTS.reliability * parts.reliability +
    WEIGHTS.groupAffinity * parts.groupAffinity;
  return { score: Math.round(score), parts };
}

/**
 * Rank rides for a rider, best first. Ties broken by earliest depart_at.
 * Returns [{ ride, score, parts }].
 */
export function rankRides(rides, rider) {
  return rides
    .map((ride) => ({ ride, ...scoreRide(ride, rider) }))
    .sort((a, b) => b.score - a.score || new Date(a.ride.depart_at) - new Date(b.ride.depart_at));
}
