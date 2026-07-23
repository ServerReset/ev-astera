-- Carpool origin fields switched from lat/lng points to a free-text address label
-- (Nominatim autocomplete replaces manual pin-dropping). Run against the live DB
-- AFTER deploying the app code that stops writing these columns.
ALTER TABLE carpool_bookings DROP COLUMN IF EXISTS pickup_lat;
ALTER TABLE carpool_bookings DROP COLUMN IF EXISTS pickup_lng;
ALTER TABLE carpool_requests DROP COLUMN IF EXISTS origin_lat;
ALTER TABLE carpool_requests DROP COLUMN IF EXISTS origin_lng;
ALTER TABLE carpool_rides DROP COLUMN IF EXISTS origin_lat;
ALTER TABLE carpool_rides DROP COLUMN IF EXISTS origin_lng;
ALTER TABLE carpool_schedules DROP COLUMN IF EXISTS origin_lat;
ALTER TABLE carpool_schedules DROP COLUMN IF EXISTS origin_lng;
