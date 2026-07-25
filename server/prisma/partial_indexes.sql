-- Prisma's schema DSL can't express partial/conditional indexes. Paste this into the
-- generated migration.sql from `npx prisma migrate dev --name partial_indexes --create-only`
-- (see README's Database setup section for the exact step-by-step).

-- Race-condition guard: at most one active/overtime session per charger.
CREATE UNIQUE INDEX uniq_active_session_per_charger
  ON sessions(charger_id) WHERE status IN ('active','overtime');

-- Race-condition guard: at most one active/overtime session per USER (see migration
-- 20260725030000_one_active_session_per_user). Backs assertNoActiveSession() so two concurrent
-- starts on different chargers can't both create a session for the same user.
CREATE UNIQUE INDEX uniq_active_session_per_user
  ON sessions(user_id) WHERE status IN ('active','overtime');

-- Queue advancement ordering: priority desc, joined_at asc, waiting entries only.
CREATE INDEX idx_queue_order
  ON queue_entries(charger_id, priority DESC, joined_at ASC) WHERE status = 'waiting';
