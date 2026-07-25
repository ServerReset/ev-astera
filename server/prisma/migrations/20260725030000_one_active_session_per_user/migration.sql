-- Race-condition guard: at most one active/overtime session per USER (partial unique index).
-- Prisma's schema DSL can't express a partial index, so it lives here as a raw-SQL migration
-- (same pattern as uniq_active_session_per_charger). Backs the application-level
-- assertNoActiveSession() check in session.service.start(), which alone is a TOCTOU race: two
-- concurrent starts on DIFFERENT chargers both pass the SELECT and both INSERT. This index makes
-- the second INSERT fail with P2002, which start() now catches.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_session_per_user
  ON sessions(user_id) WHERE status IN ('active','overtime');
