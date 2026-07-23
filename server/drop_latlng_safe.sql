ALTER TABLE "carpool_bookings" DROP COLUMN "pickup_lat", DROP COLUMN "pickup_lng";
ALTER TABLE "carpool_requests" DROP COLUMN "origin_lat", DROP COLUMN "origin_lng";
ALTER TABLE "carpool_rides" DROP COLUMN "origin_lat", DROP COLUMN "origin_lng";
ALTER TABLE "carpool_schedules" DROP COLUMN "origin_lat", DROP COLUMN "origin_lng";
