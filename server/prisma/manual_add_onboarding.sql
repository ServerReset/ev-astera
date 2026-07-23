-- First-time onboarding flow. Run against any already-provisioned database.
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
