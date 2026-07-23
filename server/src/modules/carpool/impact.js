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
import { CREDIT_KIND, CARPOOL_ROLE, SETTING_KEYS } from '../../../../shared/constants.js';
import { now } from '../../utils/timeUtils.js';

/** Award credits to a user: append to ledger + bump denormalized balance. Returns new balance. */
export async function awardCredits(locationId, userId, amount, reason, rideId = null) {
  const user = await prisma.users.findUnique({ where: { id: userId }, select: { carpool_credits: true } });
  const current = user?.carpool_credits ?? 0;
  const balanceAfter = current + amount;

  await prisma.carpool_credits_ledger.create({
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
  await prisma.users.update({ where: { id: userId }, data: { carpool_credits: balanceAfter } });
  await emit(EVENTS.CARPOOL_CREDITS_AWARDED, { locationId, userId, amount, reason, balanceAfter });
  return balanceAfter;
}

/**
 * Complete a ride: compute miles/CO2, write trip logs for driver + confirmed riders,
 * award credits, flip ride → completed. Idempotent-ish: guarded by ride.status upstream.
 * @returns {{miles, co2Grams, riders, driverCredits}}
 */
export async function completeRideImpact(ride, milesOverride = null) {
  const locationId = ride.location_id;
  const co2PerMile = await configService.getNumber(SETTING_KEYS.CARPOOL_CO2_GRAMS_PER_MILE, locationId);
  const creditPerTrip = await configService.getNumber(SETTING_KEYS.CARPOOL_CREDIT_PER_TRIP, locationId);
  const creditPerRider = await configService.getNumber(SETTING_KEYS.CARPOOL_CREDIT_PER_RIDER, locationId);
  const defaultTripMiles = await configService.getNumber(SETTING_KEYS.CARPOOL_DEFAULT_TRIP_MILES, locationId);

  // Confirmed riders on this ride.
  const riders = await prisma.carpool_bookings.findMany({ where: { ride_id: ride.id, status: 'confirmed' } });
  const riderCount = riders.reduce((n, b) => n + (b.seats || 1), 0);

  const oneWayMiles = milesOverride != null ? milesOverride : defaultTripMiles;
  const miles = Number.isFinite(oneWayMiles) ? Math.round(oneWayMiles * 10) / 10 : 0;
  const co2PerRider = miles * co2PerMile; // grams a single displaced car would emit
  const totalCo2 = co2PerRider * riderCount;

  // Trip log + credits: driver.
  const driverCredits = creditPerTrip + creditPerRider * riderCount;
  await prisma.carpool_trip_logs.create({
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
  await awardCredits(locationId, ride.driver_id, driverCredits, `Drove carpool (${riderCount} rider${riderCount === 1 ? '' : 's'})`, ride.id);

  // Trip log + credits: each rider.
  for (const b of riders) {
    await prisma.carpool_trip_logs.create({
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
    await awardCredits(locationId, b.rider_id, creditPerTrip, 'Rode in a carpool', ride.id);
    await prisma.carpool_bookings.update({ where: { id: b.id }, data: { status: 'completed' } });
  }

  await prisma.carpool_rides.update({
    where: { id: ride.id },
    data: {
      status: 'completed',
      miles,
      co2_grams_saved: totalCo2,
      completed_at: now(),
    },
  });

  await emit(EVENTS.CARPOOL_TRIP_COMPLETED, {
    locationId,
    rideId: ride.id,
    driverId: ride.driver_id,
    riderCount,
    miles,
    co2Grams: totalCo2,
  });

  return { miles, co2Grams: totalCo2, riders: riderCount, driverCredits };
}
