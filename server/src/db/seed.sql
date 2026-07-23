-- ============================================================================
--  Seed data. Run AFTER schema.sql.
--  Creates: 1 location, 1 admin user, 3 chargers, all settings (incl. carpool),
--           and a demo carpool group.
--
--  Admin login: admin@asteralabs.com — password_hash starts NULL below because a real
--  bcrypt hash can't be baked into a static SQL file (it's salted per-run). You MUST run,
--  from server/, right after this seed:
--      npm run seed:admin                # sets the password to ChangeMe123!
--      npm run seed:admin "MyPassword1!"  # or a custom password
--  Until that script runs, this account has no usable password and login will 401.
-- ============================================================================

-- Fixed UUIDs so the .env DEFAULT_LOCATION_ID is stable across environments.
-- Location: 11111111-1111-1111-1111-111111111111
insert into locations (id, name, timezone, address, site_lat, site_lng)
values (
  '11111111-1111-1111-1111-111111111111',
  'Astera Labs — Santa Clara',
  'America/Los_Angeles',
  '2901 Tasman Dr, Santa Clara, CA',
  37.3947, -121.9700
)
on conflict (id) do nothing;

-- Admin user. password_hash is intentionally NULL — see the note above; run
-- `npm run seed:admin` to set a real bcrypt hash before you can log in.
insert into users (id, location_id, email, password_hash, display_name, role, vehicle_description, active)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'admin@asteralabs.com',
  null,
  'Site Admin',
  'admin',
  'Fleet vehicle',
  true
)
on conflict (email) do nothing;

-- Chargers
insert into chargers (id, location_id, name, position, status) values
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111111', 'Charger 1', 1, 'available'),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111111', 'Charger 2', 2, 'available'),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111111', 'Charger 3', 3, 'available')
on conflict (id) do nothing;

-- Settings (jsonb values). All admin-editable at runtime.
insert into settings (location_id, key, value) values
  ('11111111-1111-1111-1111-111111111111', 'max_session_hours', '4'),
  ('11111111-1111-1111-1111-111111111111', 'max_weekly_sessions', '2'),
  ('11111111-1111-1111-1111-111111111111', 'grace_period_minutes', '15'),
  ('11111111-1111-1111-1111-111111111111', 'claim_window_minutes', '10'),
  ('11111111-1111-1111-1111-111111111111', 'overtime_first_nudge_minutes', '5'),
  ('11111111-1111-1111-1111-111111111111', 'overtime_user_nudge_unlock_minutes', '10'),
  ('11111111-1111-1111-1111-111111111111', 'overtime_custom_message_unlock_minutes', '15'),
  ('11111111-1111-1111-1111-111111111111', 'overtime_admin_alert_minutes', '30'),
  ('11111111-1111-1111-1111-111111111111', 'nudge_rate_limit_minutes', '5'),
  ('11111111-1111-1111-1111-111111111111', 'max_nudges_per_session', '5'),
  ('11111111-1111-1111-1111-111111111111', 'emergency_cooldown_hours', '24'),
  ('11111111-1111-1111-1111-111111111111', 'emergency_response_window_minutes', '10'),
  ('11111111-1111-1111-1111-111111111111', 'daily_reset_hour', '0'),
  ('11111111-1111-1111-1111-111111111111', 'weekly_reset_day', '1'),
  -- carpool
  ('11111111-1111-1111-1111-111111111111', 'carpool_enabled', 'true'),
  ('11111111-1111-1111-1111-111111111111', 'carpool_min_lead_minutes', '30'),
  ('11111111-1111-1111-1111-111111111111', 'carpool_max_detour_miles', '8'),
  ('11111111-1111-1111-1111-111111111111', 'carpool_min_match_score', '55'),
  ('11111111-1111-1111-1111-111111111111', 'carpool_materialize_days', '2'),
  ('11111111-1111-1111-1111-111111111111', 'carpool_reminder_lead_minutes', '30'),
  ('11111111-1111-1111-1111-111111111111', 'carpool_priority_enabled', 'true'),
  ('11111111-1111-1111-1111-111111111111', 'carpool_priority_weight', '100'),
  ('11111111-1111-1111-1111-111111111111', 'carpool_co2_grams_per_mile', '400'),
  ('11111111-1111-1111-1111-111111111111', 'carpool_credit_per_trip', '10'),
  ('11111111-1111-1111-1111-111111111111', 'carpool_credit_per_rider', '5')
on conflict (location_id, key) do nothing;

-- A demo carpool group
insert into carpool_groups (id, location_id, name, description, created_by)
values (
  '44444444-4444-4444-4444-444444444401',
  '11111111-1111-1111-1111-111111111111',
  'North Bay Commute',
  'Colleagues coming in from the North Bay / 101 corridor',
  '22222222-2222-2222-2222-222222222222'
)
on conflict (id) do nothing;

insert into carpool_group_members (group_id, user_id)
values ('44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222222')
on conflict do nothing;
