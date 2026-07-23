-- ============================================================================
--  Astera Labs EV Charger Hub + Carpool — PostgreSQL schema (Supabase / PG 15)
--  Run this first in the Supabase SQL editor, then run seed.sql.
--  Everything is scoped by location_id for future multi-region.
-- ============================================================================

create extension if not exists "pgcrypto";        -- gen_random_uuid()

-- ── Locations ────────────────────────────────────────────────────────────────
create table if not exists locations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  timezone      text not null default 'America/Los_Angeles',
  address       text,
  site_lat      double precision,             -- used by the carpool matcher (the "site")
  site_lng      double precision,
  created_at    timestamptz not null default now()
);

-- ── Users ────────────────────────────────────────────────────────────────────
create table if not exists users (
  id                  uuid primary key default gen_random_uuid(),
  location_id         uuid not null references locations(id) on delete cascade,
  email               text not null unique,
  password_hash       text,                    -- null when using an external auth provider
  display_name        text not null,
  role                text not null default 'user' check (role in ('user','admin')),
  vehicle_description text,
  parking_spot        text,
  notification_prefs  jsonb not null default '{}'::jsonb,
  carpool_credits     integer not null default 0,
  active              boolean not null default true,
  failed_attempts     integer not null default 0,
  locked_until        timestamptz,
  last_active_at      timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists idx_users_location on users(location_id);
create index if not exists idx_users_email on users(email);

-- ── Refresh tokens (rotating; supports logout / revocation) ────────────────────
create table if not exists refresh_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  token_hash    text not null,
  expires_at    timestamptz not null,
  revoked       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_refresh_user on refresh_tokens(user_id);
create index if not exists idx_refresh_hash on refresh_tokens(token_hash);

-- ── Chargers ──────────────────────────────────────────────────────────────────
create table if not exists chargers (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id) on delete cascade,
  name          text not null,
  position      integer not null default 0,           -- display order
  status        text not null default 'available'
                  check (status in ('available','in_use','overtime','offline')),
  offline_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_chargers_location on chargers(location_id);

-- ── Sessions ──────────────────────────────────────────────────────────────────
create table if not exists sessions (
  id                  uuid primary key default gen_random_uuid(),
  location_id         uuid not null references locations(id) on delete cascade,
  charger_id          uuid not null references chargers(id) on delete cascade,
  user_id             uuid not null references users(id) on delete cascade,
  status              text not null default 'active'
                        check (status in ('active','overtime','completed','force_ended')),
  vehicle_description text,
  parking_spot        text,
  started_at          timestamptz not null default now(),
  eta_at              timestamptz not null,
  ended_at            timestamptz,
  overtime_notified_at timestamptz,             -- last graduated overtime notification
  created_at          timestamptz not null default now()
);
create index if not exists idx_sessions_charger on sessions(charger_id);
create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_sessions_status on sessions(status);
create index if not exists idx_sessions_started on sessions(started_at);
-- At most one active/overtime session per charger (race-condition guard).
create unique index if not exists uniq_active_session_per_charger
  on sessions(charger_id) where status in ('active','overtime');

-- ── Queue entries ─────────────────────────────────────────────────────────────
create table if not exists queue_entries (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id) on delete cascade,
  charger_id    uuid references chargers(id) on delete cascade,   -- null => "any available"
  user_id       uuid not null references users(id) on delete cascade,
  status        text not null default 'waiting'
                  check (status in ('waiting','notified','claimed','fulfilled','skipped','cancelled')),
  priority      integer not null default 0,        -- carpool tie-in: higher = sooner
  priority_source text,                             -- e.g. 'carpool' for auditing
  notified_at   timestamptz,
  claimed_at    timestamptz,
  expires_at    timestamptz,                        -- grace / claim deadline
  joined_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists idx_queue_charger on queue_entries(charger_id);
create index if not exists idx_queue_user on queue_entries(user_id);
create index if not exists idx_queue_status on queue_entries(status);
-- Ordering key for advancement: priority desc, joined_at asc.
create index if not exists idx_queue_order on queue_entries(charger_id, priority desc, joined_at asc)
  where status = 'waiting';

-- ── Reservations ──────────────────────────────────────────────────────────────
create table if not exists reservations (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id) on delete cascade,
  charger_id    uuid not null references chargers(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  status        text not null default 'upcoming'
                  check (status in ('upcoming','active','completed','cancelled')),
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  warned_at     timestamptz,                        -- buffer warning sent
  created_at    timestamptz not null default now()
);
create index if not exists idx_res_charger on reservations(charger_id);
create index if not exists idx_res_user on reservations(user_id);
create index if not exists idx_res_window on reservations(start_at, end_at);

-- ── Notifications ─────────────────────────────────────────────────────────────
create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  type          text not null,
  priority      text not null default 'normal',
  title         text not null,
  body          text not null,
  action_url    text,
  metadata      jsonb not null default '{}'::jsonb,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_notif_user on notifications(user_id, created_at desc);
create index if not exists idx_notif_unread on notifications(user_id) where read_at is null;

-- ── Push subscriptions ──────────────────────────────────────────────────────────
create table if not exists push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_push_user on push_subscriptions(user_id);

-- ── Messages (nudges + emergency) ───────────────────────────────────────────────
create table if not exists messages (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id) on delete cascade,
  kind          text not null check (kind in ('nudge','emergency_request','emergency_response')),
  sender_id     uuid not null references users(id) on delete cascade,
  recipient_id  uuid references users(id) on delete cascade,
  charger_id    uuid references chargers(id) on delete set null,
  session_id    uuid references sessions(id) on delete set null,
  body          text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_msg_recipient on messages(recipient_id, created_at desc);
create index if not exists idx_msg_sender on messages(sender_id, created_at desc);

-- ── Emergency requests ──────────────────────────────────────────────────────────
create table if not exists emergency_requests (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  reason        text not null,
  explanation   text,
  status        text not null default 'open' check (status in ('open','resolved','expired')),
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_emergency_user on emergency_requests(user_id, created_at desc);

-- ── Announcements ────────────────────────────────────────────────────────────────
create table if not exists announcements (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id) on delete cascade,
  title         text not null,
  body          text not null,
  active        boolean not null default true,
  expires_at    timestamptz,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_ann_active on announcements(location_id, active);

-- ── Settings (business rules — admin editable) ──────────────────────────────────
create table if not exists settings (
  location_id   uuid not null references locations(id) on delete cascade,
  key           text not null,
  value         jsonb not null,
  updated_at    timestamptz not null default now(),
  primary key (location_id, key)
);

-- ── Audit log (fed by the audit event listener) ────────────────────────────────
create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid references locations(id) on delete cascade,
  user_id       uuid references users(id) on delete set null,
  action        text not null,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_audit_location on audit_log(location_id, created_at desc);
create index if not exists idx_audit_action on audit_log(action);

-- ============================================================================
--  CARPOOL
-- ============================================================================

-- ── Carpool groups ──────────────────────────────────────────────────────────────
create table if not exists carpool_groups (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id) on delete cascade,
  name          text not null,
  description   text,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_cpgroup_location on carpool_groups(location_id);

create table if not exists carpool_group_members (
  group_id      uuid not null references carpool_groups(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  joined_at     timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ── Recurring schedules ─────────────────────────────────────────────────────────
create table if not exists carpool_schedules (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  role          text not null check (role in ('driver','rider')),
  direction     text not null check (direction in ('to_site','from_site')),
  days_of_week  integer[] not null,           -- 0=Sun .. 6=Sat
  depart_time   text not null,                -- 'HH:MM' local
  origin_label  text not null,
  origin_lat    double precision not null,
  origin_lng    double precision not null,
  seats         integer not null default 1,
  group_id      uuid references carpool_groups(id) on delete set null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists idx_cpsched_user on carpool_schedules(user_id);
create index if not exists idx_cpsched_active on carpool_schedules(location_id, active);

-- ── Rides (driver-offered trips) ────────────────────────────────────────────────
create table if not exists carpool_rides (
  id                uuid primary key default gen_random_uuid(),
  location_id       uuid not null references locations(id) on delete cascade,
  driver_id         uuid not null references users(id) on delete cascade,
  direction         text not null check (direction in ('to_site','from_site')),
  origin_label      text not null,
  origin_lat        double precision not null,
  origin_lng        double precision not null,
  depart_at         timestamptz not null,
  seats_total       integer not null,
  seats_available   integer not null,
  status            text not null default 'open'
                      check (status in ('open','full','in_progress','completed','cancelled')),
  notes             text,
  schedule_id       uuid references carpool_schedules(id) on delete set null,
  linked_session_id uuid references sessions(id) on delete set null,   -- EV tie-in
  group_id          uuid references carpool_groups(id) on delete set null,
  miles             double precision,          -- computed on completion
  co2_grams_saved   double precision,
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_cpride_location on carpool_rides(location_id);
create index if not exists idx_cpride_driver on carpool_rides(driver_id);
create index if not exists idx_cpride_status on carpool_rides(status);
create index if not exists idx_cpride_depart on carpool_rides(depart_at);

-- ── Bookings (rider seats on a ride) ─────────────────────────────────────────────
create table if not exists carpool_bookings (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id) on delete cascade,
  ride_id       uuid not null references carpool_rides(id) on delete cascade,
  rider_id      uuid not null references users(id) on delete cascade,
  status        text not null default 'requested'
                  check (status in ('requested','confirmed','declined','cancelled','completed')),
  seats         integer not null default 1,
  pickup_label  text,
  pickup_lat    double precision,
  pickup_lng    double precision,
  created_at    timestamptz not null default now(),
  unique (ride_id, rider_id)
);
create index if not exists idx_cpbook_ride on carpool_bookings(ride_id);
create index if not exists idx_cpbook_rider on carpool_bookings(rider_id);
create index if not exists idx_cpbook_status on carpool_bookings(status);

-- ── Ride requests (rider "I need a ride") ────────────────────────────────────────
create table if not exists carpool_requests (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id) on delete cascade,
  rider_id      uuid not null references users(id) on delete cascade,
  direction     text not null check (direction in ('to_site','from_site')),
  origin_label  text not null,
  origin_lat    double precision not null,
  origin_lng    double precision not null,
  window_start  timestamptz not null,
  window_end    timestamptz not null,
  status        text not null default 'open' check (status in ('open','matched','expired','cancelled')),
  matched_ride_id uuid references carpool_rides(id) on delete set null,
  schedule_id   uuid references carpool_schedules(id) on delete set null,
  group_id      uuid references carpool_groups(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_cpreq_rider on carpool_requests(rider_id);
create index if not exists idx_cpreq_status on carpool_requests(location_id, status);

-- ── Trip logs (impact — one row per participant per completed trip) ───────────────
create table if not exists carpool_trip_logs (
  id              uuid primary key default gen_random_uuid(),
  location_id     uuid not null references locations(id) on delete cascade,
  ride_id         uuid not null references carpool_rides(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  role            text not null check (role in ('driver','rider')),
  miles           double precision not null default 0,
  co2_grams_saved double precision not null default 0,
  credits_awarded integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_cptrip_user on carpool_trip_logs(user_id, created_at desc);
create index if not exists idx_cptrip_location on carpool_trip_logs(location_id, created_at desc);
create index if not exists idx_cptrip_ride on carpool_trip_logs(ride_id);

-- ── Credits ledger (append-only) ─────────────────────────────────────────────────
create table if not exists carpool_credits_ledger (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references locations(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  kind          text not null check (kind in ('earn','spend','adjust')),
  amount        integer not null,
  reason        text not null,
  balance_after integer not null,
  ride_id       uuid references carpool_rides(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_cpcred_user on carpool_credits_ledger(user_id, created_at desc);

-- ============================================================================
--  updated_at trigger for chargers
-- ============================================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_chargers_updated on chargers;
create trigger trg_chargers_updated before update on chargers
  for each row execute function set_updated_at();

-- ============================================================================
--  Row-Level Security
--
--  The server (server/src/db/supabase.js) connects with the SERVICE ROLE key, which
--  bypasses RLS entirely — none of this changes any Express API behavior.
--
--  The ANON key (client/src/config/supabase.js) is shipped inside the browser bundle and
--  used ONLY for Supabase Realtime subscriptions (client/src/hooks/useRealtime.js calls
--  `supabase.channel(...).on('postgres_changes', ...)`). Two things make that key dangerous
--  without RLS: (1) Supabase's PostgREST layer grants the `anon` role default read/write
--  access to any table lacking RLS, so the same client object could call
--  `supabase.from('users').select('*')` directly from devtools, bypassing auth entirely; and
--  (2) Realtime's own `postgres_changes` authorization checks SELECT via RLS as the
--  connecting role, so a table needs an explicit anon SELECT policy to broadcast changes at
--  all once RLS is on.
--
--  Model: enable RLS on every table (default-deny), then open a narrow, SELECT-only
--  allowlist for anon on exactly the tables the client subscribes to via Realtime. `sessions`
--  and `reservations` are both included for the same reason: each is a record of who is
--  using (or has booked) a shared charger, not personal content — the dashboard/reservations
--  UI already shows this to every logged-in employee, so it's the same category as
--  `chargers`/`queue_entries`, not the same category as `notifications` below. Every other
--  table — including `users` (password_hash), `refresh_tokens` (token_hash), `settings`,
--  `audit_log`, `messages`, `emergency_requests`, and the full carpool scheduling/credits
--  tables — gets RLS with NO policy at all, so anon can neither read nor write a single row;
--  all access to those goes exclusively through the authenticated Express API.
--
--  `notifications` is deliberately EXCLUDED from the anon allowlist even though the client
--  subscribes to it (useNotificationSync.js, NotificationsPage.jsx) — that table holds
--  per-user content (queue-turn alerts, emergency messages) and the anon realtime connection
--  carries no verified user identity to scope rows by (it doesn't authenticate as the app's
--  user — see supabase.js: `persistSession: false`). The client-side `filter:
--  user_id=eq.<id>` on that subscription is NOT a security boundary — it's just a
--  convenience narrowing that anyone could remove by calling the Realtime API directly — so
--  any policy permissive enough for that subscription to work would let every browser read
--  every user's notifications. Denying it means that one Realtime channel silently receives
--  nothing, which the code already tolerates gracefully (see useRealtime.js's header comment
--  on graceful no-op when Supabase isn't configured); the notification bell still works via
--  the authenticated REST fetch in notificationStore.refresh(), just without a live push.
--
--  Residual tradeoff, accepted and documented rather than silently shipped: the seven allowed
--  tables (chargers, sessions, queue_entries, reservations, announcements, carpool_rides,
--  carpool_bookings) are readable by ANYONE holding the anon key — including logged-out
--  visitors — not just authenticated employees, since the anon connection has no user
--  session to gate on. The data in them (charger/session/queue status, ride pickup
--  labels/coordinates, vehicle description, parking spot) is the same workplace-shared data
--  any logged-in employee already sees on the dashboard, not secrets like credentials or
--  tokens, so this is a deliberate, bounded exposure rather than an oversight. If this app
--  ever serves multiple untrusted tenants on one Supabase project, or the data in these
--  tables needs to stop being visible to unauthenticated users, the real fix is to mint a
--  Supabase-compatible JWT server-side at login (signed with the Supabase project's JWT
--  secret, carrying the user's id/location_id as claims) and call
--  `supabase.realtime.setAuth(token)` on the client so RLS policies can scope rows with
--  `auth.jwt() ->> 'location_id'` instead of `using (true)`.
-- ============================================================================

alter table locations enable row level security;
alter table users enable row level security;
alter table refresh_tokens enable row level security;
alter table chargers enable row level security;
alter table sessions enable row level security;
alter table queue_entries enable row level security;
alter table reservations enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;
alter table messages enable row level security;
alter table emergency_requests enable row level security;
alter table announcements enable row level security;
alter table settings enable row level security;
alter table audit_log enable row level security;
alter table carpool_groups enable row level security;
alter table carpool_group_members enable row level security;
alter table carpool_schedules enable row level security;
alter table carpool_rides enable row level security;
alter table carpool_bookings enable row level security;
alter table carpool_requests enable row level security;
alter table carpool_trip_logs enable row level security;
alter table carpool_credits_ledger enable row level security;

-- Belt-and-suspenders: Supabase grants `anon`/`authenticated` broad default privileges on
-- tables created in `public` (independent of RLS). Revoke that blanket grant so RLS is the
-- only thing deciding access, then grant back exactly what's allowed below. This app never
-- uses Supabase's own Auth, so the `authenticated` role is not used anywhere.
revoke all on all tables in schema public from anon, authenticated;

drop policy if exists anon_read_chargers on chargers;
create policy anon_read_chargers on chargers for select to anon using (true);
grant select on chargers to anon;

drop policy if exists anon_read_sessions on sessions;
create policy anon_read_sessions on sessions for select to anon using (true);
grant select on sessions to anon;

drop policy if exists anon_read_queue_entries on queue_entries;
create policy anon_read_queue_entries on queue_entries for select to anon using (true);
grant select on queue_entries to anon;

drop policy if exists anon_read_reservations on reservations;
create policy anon_read_reservations on reservations for select to anon using (true);
grant select on reservations to anon;

drop policy if exists anon_read_announcements on announcements;
create policy anon_read_announcements on announcements for select to anon using (true);
grant select on announcements to anon;

drop policy if exists anon_read_carpool_rides on carpool_rides;
create policy anon_read_carpool_rides on carpool_rides for select to anon using (true);
grant select on carpool_rides to anon;

drop policy if exists anon_read_carpool_bookings on carpool_bookings;
create policy anon_read_carpool_bookings on carpool_bookings for select to anon using (true);
grant select on carpool_bookings to anon;

-- ============================================================================
--  Realtime: after running this, enable Realtime in the Supabase dashboard for:
--    chargers, sessions, queue_entries, reservations, notifications, announcements,
--    carpool_rides, carpool_bookings
--  (notifications is enabled here for completeness/future use, but per the RLS policy
--  above the anon key will not actually receive broadcasts for it — see comment.)
-- ============================================================================
