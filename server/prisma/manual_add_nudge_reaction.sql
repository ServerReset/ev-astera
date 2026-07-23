-- Adds thumbs up/down reactions to nudges on an already-provisioned database.
-- Paste this into your Postgres provider's SQL console (see manual_init.sql for context).

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction TEXT;
