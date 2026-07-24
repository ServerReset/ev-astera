-- Reliability scoring system: rewards fast unplugging + carpool driving, penalizes chronic
-- overtime, with a hard lockout tier for repeat offenders. Also adds queue priority-delta
-- columns so carpool and reliability boosts can coexist without one clobbering the other on
-- release, a queue auto-requeue counter, and a notification<->message link for nudge reactions.
-- Run against an already-provisioned database, after deploying the app code that uses these.

ALTER TABLE users ADD COLUMN IF NOT EXISTS reliability_score DOUBLE PRECISION NOT NULL DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reliability_locked_until TIMESTAMP(3);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_reliability_event_at TIMESTAMP(3);

ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS carpool_priority_delta INTEGER NOT NULL DEFAULT 0;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS reliability_priority_delta INTEGER NOT NULL DEFAULT 0;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS requeue_count INTEGER NOT NULL DEFAULT 0;
-- The user's original join()-time preference (a specific charger, or NULL for "any"), kept
-- separate from charger_id (which gets overwritten to a concrete charger once notified) so a
-- missed-claim auto-requeue can restore the real preference instead of pinning them forever
-- to whichever one charger they happened to be notified for.
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS preferred_charger_id TEXT;
UPDATE queue_entries SET preferred_charger_id = charger_id WHERE preferred_charger_id IS NULL;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message_id TEXT;
CREATE INDEX IF NOT EXISTS idx_notifications_message_id ON notifications (message_id);

-- id/user_id/session_id are TEXT, not UUID, to match users.id/sessions.id everywhere else in
-- this database (manual_init.sql: "id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text") — a
-- native uuid column cannot FK against a text column, so UUID here would fail at CREATE TABLE.
CREATE TABLE IF NOT EXISTS reliability_events (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  delta       DOUBLE PRECISION NOT NULL,
  score_after DOUBLE PRECISION NOT NULL,
  session_id  TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reliability_events_user_id_created_at ON reliability_events (user_id, created_at DESC);
