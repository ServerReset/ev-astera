-- Race-condition guard: at most one active/overtime session per USER (partial unique index).
-- Prisma's schema DSL can't express a partial index, so it lives here as a raw-SQL migration
-- (same pattern as uniq_active_session_per_charger). Backs the application-level
-- assertNoActiveSession() check in session.service.start(), which alone is a TOCTOU race: two
-- concurrent starts on DIFFERENT chargers both pass the SELECT and both INSERT. This index makes
-- the second INSERT fail with P2002, which start() now catches.

-- First, clean up any pre-existing violations so the unique index can actually be created — if
-- production already has a user holding two active/overtime sessions (from the very race this
-- index prevents), a bare CREATE UNIQUE INDEX would fail and abort the whole `migrate deploy`,
-- leaving the DB half-migrated. Keep each user's most recent active session; force-end the rest.
UPDATE sessions s
SET status = 'force_ended',
    ended_at = COALESCE(s.ended_at, NOW())
WHERE s.status IN ('active', 'overtime')
  AND s.id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM sessions
    WHERE status IN ('active', 'overtime')
    ORDER BY user_id, started_at DESC
  );

-- Free any charger left marked in_use/overtime by a session we just force-ended above, unless an
-- admin had it offline. (A charger with a surviving active session is handled by its own session.)
UPDATE chargers c
SET status = 'available'
WHERE c.status IN ('in_use', 'overtime')
  AND NOT EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.charger_id = c.id AND s.status IN ('active', 'overtime')
  );

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_session_per_user
  ON sessions(user_id) WHERE status IN ('active','overtime');
