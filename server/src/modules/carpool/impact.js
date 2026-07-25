/**
 * Carpool impact + credits math and persistence. Called when a trip completes.
 * Writes trip logs + credit ledger rows and denormalizes the balance onto users.carpool_credits.
 *
 * No coordinates are captured for carpool locations, so mileage is either a driver-entered
 * override or a configurable location-wide average (carpool_default_trip_miles):
 *   oneWayMiles = milesOverride ?? carpool_default_trip_miles
 * CO2 is counted per RIDER displaced (the driver would have driven anyway):
 *   co2_grams_saved(per rider) = oneWayMiles * carpool_co2_grams_per_mile
 * Credits:
 *   driver: carpool_credit_per_trip + carpool_credit_per_rider * riders
 *   rider:  carpool_credit_per_trip
 */
import { prisma } from '../../db/prisma.js';
import { emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { configService } from '../../services/config.service.js';
import { CREDIT_KIND, CARPOOL_ROLE, RIDE_STATUS, SETTING_KEYS } from '../../../../shared/constants.js';
import { now } from '../../utils/timeUtils.js';

/**
 * Award credits to a user: append to ledger + bump denormalized balance. Returns new balance.
 * Accepts an optional Prisma transaction client `tx` (defaults to the global prisma) so it can run
 * inside completeRideImpact's $transaction and roll back with it. The CARPOOL_CREDITS_AWARDED event
 * is intentionally NOT emitted here — the caller emits after the enclosing transaction commits, so
 * we never fire an event for a payout that later rolls back. (When called standalone with the
 * default client each call is its own implicit transaction; the caller still owns the emit.)
 */
export async function awardCredits(locationId, userId, amount, reason, rideId = null, tx = prisma) {
  const user = await tx.users.findUnique({ where: { id: userId }, select: { carpool_credits: true } });
  const current = user?.carpool_credits ?? 0;
  const balanceAfter = current + amount;

  await tx.carpool_credits_ledger.create({
    data: {
      location_id: locationId,
      user_id: userId,
      kind: amount >= 0 ? CREDIT_KIND.EARN : CREDIT_KIND.SPEND,
      amount,
      reason,
      balance_after: balanceAfter,
      ride_id: rideId,
    },
  });
  await tx.users.update({ where: { id: userId }, data: { carpool_credits: balanceAfter } });
  return balanceAfter;
}

/**
 * Complete a ride: compute miles/CO2, write trip logs for driver + confirmed riders,
 * award credits, flip ride → completed. Idempotent-ish: guarded by ride.status upstream.
 * @returns {{miles, co2Grams, riders, driverCredits}}
 */
export async function completeRideImpact(ride, milesOverride = null) {
  const locationId = ride.location_id;

  // Config reads happen outside the transaction (they may hit cache/DB and don't need to be in the
  // write set); they don't mutate anything, so a later rollback leaves nothing to undo here.
  const co2PerMile = await configService.getNumber(SETTING_KEYS.CARPOOL_CO2_GRAMS_PER_MILE, locationId);
  const creditPerTrip = await configService.getNumber(SETTING_KEYS.CARPOOL_CREDIT_PER_TRIP, locationId);
  const creditPerRider = await configService.getNumber(SETTING_KEYS.CARPOOL_CREDIT_PER_RIDER, locationId);
  const defaultTripMiles = await configService.getNumber(SETTING_KEYS.CARPOOL_DEFAULT_TRIP_MILES, locationId);

  const oneWayMiles = milesOverride != null ? milesOverride : defaultTripMiles;
  const miles = Number.isFinite(oneWayMiles) ? Math.round(oneWayMiles * 10) / 10 : 0;
  const co2PerRider = miles * co2PerMile; // grams a single displaced car would emit

  // The whole completion is ONE transaction: the atomic status claim, both parties' trip logs +
  // credit ledger writes, booking updates, and the impact backfill either all commit or all roll
  // back. Previously the claim flipped the ride → completed up front but the payout ran outside any
  // transaction, so a mid-payout throw left the ride permanently COMPLETED with missing/partial
  // credits and CO2 — and every retry short-circuited on alreadyCompleted, so the driver/riders
  // silently lost credits with no recovery path. Events are collected and emitted AFTER commit, so
  // no listener ever fires for a payout that rolled back.
  const outcome = await prisma.$transaction(async (tx) => {
    // Atomically claim the ride for completion BEFORE any payout. The callers (carpoolComplete cron
    // + completeRide) each do a non-atomic status read-then-check, so a driver double-tap or a cron
    // run racing a manual complete can both pass their guard and both reach here. This guarded
    // updateMany transitions only from a still-open status, so exactly one caller wins (count === 1)
    // and the loser bails with zero impact — the conditional-write pattern forceEnd()/advance() use.
    const claim = await tx.carpool_rides.updateMany({
      where: { id: ride.id, status: { in: [RIDE_STATUS.OPEN, RIDE_STATUS.FULL, RIDE_STATUS.IN_PROGRESS] } },
      data: { status: RIDE_STATUS.COMPLETED, completed_at: now() },
    });
    if (claim.count === 0) return { alreadyCompleted: true };

    const riders = await tx.carpool_bookings.findMany({ where: { ride_id: ride.id, status: 'confirmed' } });
    const riderCount = riders.reduce((n, b) => n + (b.seats || 1), 0);
    const totalCo2 = co2PerRider * riderCount;

    // Collect the credit-award events to emit after commit (awardCredits no longer emits itself).
    const creditEvents = [];

    // Trip log + credits: driver.
    const driverCredits = creditPerTrip + creditPerRider * riderCount;
    await tx.carpool_trip_logs.create({
      data: {
        location_id: locationId,
        ride_id: ride.id,
        user_id: ride.driver_id,
        role: CARPOOL_ROLE.DRIVER,
        miles,
        co2_grams_saved: totalCo2,
        credits_awarded: driverCredits,
      },
    });
    const driverReason = `Drove carpool (${riderCount} rider${riderCount === 1 ? '' : 's'})`;
    const driverBalance = await awardCredits(locationId, ride.driver_id, driverCredits, driverReason, ride.id, tx);
    creditEvents.push({ locationId, userId: ride.driver_id, amount: driverCredits, reason: driverReason, balanceAfter: driverBalance });

    // Trip log + credits: each rider.
    for (const b of riders) {
      await tx.carpool_trip_logs.create({
        data: {
          location_id: locationId,
          ride_id: ride.id,
          user_id: b.rider_id,
          role: CARPOOL_ROLE.RIDER,
          miles,
          co2_grams_saved: co2PerRider * (b.seats || 1),
          credits_awarded: creditPerTrip,
        },
      });
      const riderBalance = await awardCredits(locationId, b.rider_id, creditPerTrip, 'Rode in a carpool', ride.id, tx);
      creditEvents.push({ locationId, userId: b.rider_id, amount: creditPerTrip, reason: 'Rode in a carpool', balanceAfter: riderBalance });
      await tx.carpool_bookings.update({ where: { id: b.id }, data: { status: 'completed' } });
    }

    // Backfill the computed impact numbers onto the row we already claimed above.
    await tx.carpool_rides.update({
      where: { id: ride.id },
      data: { miles, co2_grams_saved: totalCo2 },
    });

    return { alreadyCompleted: false, riderCount, totalCo2, driverCredits, creditEvents };
  });

  if (outcome.alreadyCompleted) {
    return { miles: 0, co2Grams: 0, riders: 0, driverCredits: 0, alreadyCompleted: true };
  }

  // Post-commit: fire the events now that every write is durable. Ordering matches the old code
  // (credit-awarded per participant, then trip-completed); the achievement listener's assumption
  // that trip logs exist when CARPOOL_CREDITS_AWARDED fires still holds — they committed together.
  for (const ev of outcome.creditEvents) {
    await emit(EVENTS.CARPOOL_CREDITS_AWARDED, ev);
  }
  await emit(EVENTS.CARPOOL_TRIP_COMPLETED, {
    locationId,
    rideId: ride.id,
    driverId: ride.driver_id,
    riderCount: outcome.riderCount,
    miles,
    co2Grams: outcome.totalCo2,
  });

  return { miles, co2Grams: outcome.totalCo2, riders: outcome.riderCount, driverCredits: outcome.driverCredits };
}
