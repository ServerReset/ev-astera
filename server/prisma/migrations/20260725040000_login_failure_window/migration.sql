-- (Reverted) The login rolling-window fix that needed a `last_failed_at` column was rolled back:
-- adding a new required column read on the hot auth path created a deploy-ordering hazard (Prisma
-- expands full-model reads to an explicit column list, so login/refresh/change-password would 500
-- with P2022 in the window between the client being regenerated and this migration being applied)
-- that far outweighed the LOW-severity bug it fixed. This migration is intentionally a no-op so the
-- migration history stays linear; the lockout counter reverted to its original per-attempt behavior.
SELECT 1;
