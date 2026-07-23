-- Parking spot removal: chargers are fixed, tracking a per-session/user parking spot has no
-- functional value. Run against the live DB after deploying the app code that stops writing it.
ALTER TABLE users DROP COLUMN IF EXISTS parking_spot;
ALTER TABLE sessions DROP COLUMN IF EXISTS parking_spot;
