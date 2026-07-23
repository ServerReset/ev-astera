# CARPOOL module

Carpooling is a first-class feature module. It reuses the same seams as everything else (routes → service → events → listeners → jobs, config-driven rules, Realtime tables) and adds domain-specific pieces: a **matcher** and an **impact** calculator.

## Data model (see schema.sql for full DDL)

- `carpool_rides` — a driver's offered trip. `direction` (`to_site` | `from_site`), `origin_label`, `origin_lat/lng`, `depart_at`, `seats_total`, `seats_available`, `status` (`open|full|in_progress|completed|cancelled`), optional `schedule_id`, optional `linked_session_id` (the driver's charging session that day).
- `carpool_bookings` — a rider's seat on a ride. `status` (`requested|confirmed|declined|cancelled|completed`), `pickup_label`, `pickup_lat/lng`, `seats` (default 1).
- `carpool_requests` — a rider's open "I need a ride" ask, used by the matcher when no direct booking exists. `direction`, `origin_lat/lng`, `window_start/end`, `status` (`open|matched|expired|cancelled`).
- `carpool_schedules` — recurring intent. `days_of_week` (int[] 0–6), `depart_time` (local), `direction`, `role` (`driver|rider`), `seats`, `active`. The `carpoolMaterialize` job turns these into concrete rides/requests for the next N days.
- `carpool_groups` / `carpool_group_members` — named standing groups (e.g. "North Bay commute"); members see each other's rides first and share a group leaderboard.
- `carpool_trip_logs` — one row per completed trip participant: `miles`, `co2_grams_saved`, `credits_awarded`. Source of truth for impact.
- `carpool_credits_ledger` — append-only credit movements (`earn|spend|adjust`) with `reason` and running `balance` denormalized onto `users.carpool_credits`.

All carry `location_id`.

## Feature 1 — Ride matching

**Post a ride** (driver): `POST /carpool/rides` with direction, origin, departure window, seats, optional link to today's charging session. Emits `CARPOOL_RIDE_POSTED`.

**Find rides** (rider): `GET /carpool/rides?direction=&around=` returns open rides ranked by the matcher for the requesting user. Rider requests a seat: `POST /carpool/rides/:id/book` → booking `requested` → `CARPOOL_BOOKING_REQUESTED` → driver notified. Driver confirms/declines: `POST /carpool/bookings/:id/confirm|decline`.

**The matcher** (`modules/carpool/matcher.js`) scores each candidate ride for a rider on 0–100:

```
score =
    45 * routeOverlap      // 1 - normalized(detour distance driver takes for this pickup)
  + 30 * timeFit           // how well depart_at sits inside the rider's window (1 at center → 0 at edges)
  + 15 * reliability       // driver's completed-trip ratio (completed / (completed+cancelled)), smoothed
  + 10 * groupAffinity     // 1 if same carpool group, else 0
```

Distances use the haversine helper in `utils/timeUtils.js`'s sibling `geo.js`. `routeOverlap` approximates detour as `d(driverOrigin, pickup) + d(pickup, site) - d(driverOrigin, site)`, normalized by a config cap (`carpool_max_detour_miles`). Ties broken by earliest `depart_at`. Matches above `carpool_min_match_score` (config, default 55) can be auto-suggested; the `carpoolMatch` job pairs open `carpool_requests` with open rides and emits `CARPOOL_MATCH_FOUND` (notifies both sides).

## Feature 2 — Recurring commutes

`carpool_schedules` capture standing intent. The **`carpoolMaterialize` cron** (`0 5 * * *`, daily 05:00 local) looks ahead `carpool_materialize_days` (config, default 2) and, for each active schedule whose `days_of_week` includes a target day and which has no concrete ride/request yet, creates one (driver → a `carpool_rides` row; rider → a `carpool_requests` row). Groups let colleagues form a standing pool; group members are matched first (groupAffinity above).

The **`carpoolReminder` cron** (`*/5 * * * *`) finds rides departing within `carpool_reminder_lead_minutes` (config, default 30) and notifies driver + confirmed riders; and finds `requested` bookings still unanswered near departure and nudges the driver.

## Feature 3 — EV-charging tie-in

The whole point of putting carpool in the charger app: **coordinate charging with carpooling.**

- When a driver posts a ride and links today's charging session (`linked_session_id`), the dashboard shows a "🚗 Carpooling today" chip on that charger card, and the ride shows the driver's charging window so riders plan around it.
- **Queue priority:** if `carpool_priority_enabled` is true, a driver who has ≥1 **confirmed** carpool booking for today is granted a priority flag when they join a charger queue. `queue_entries.priority` (int, higher = sooner) is set from `carpool_priority_weight` (config). The carpool listener reacts to `CARPOOL_BOOKING_CONFIRMED` and, if the driver is currently queued, bumps their `priority` and emits `CARPOOL_PRIORITY_GRANTED`. Queue ordering is `ORDER BY priority DESC, joined_at ASC`.
- On `SESSION_ENDED`, the carpool listener clears any priority hold tied to that session.

This is fully opt-in and admin-configurable — set `carpool_priority_enabled=false` to decouple the systems entirely.

## Feature 4 — Incentives & impact

On `CARPOOL_TRIP_COMPLETED` (driver taps "Trip done", or the `carpoolComplete` cron auto-completes rides whose `depart_at` passed and had confirmed riders):

- `miles` = haversine(origin, site) (one-way) — or driver-entered override.
- `co2_grams_saved` = `miles * riders * carpool_co2_grams_per_mile` (config, default 400 g/mi ≈ avg US gas car) minus the driver's own trip (the driver would have driven anyway), i.e. counted per **rider** displaced.
- credits: driver earns `carpool_credit_per_trip + carpool_credit_per_rider * riders`; each rider earns `carpool_credit_per_trip`. Written to `carpool_credits_ledger`, balance denormalized to `users.carpool_credits`.
- `carpool_trip_logs` rows written for driver + each rider.

**Leaderboard**: `GET /carpool/leaderboard?window=week|month|all` aggregates `carpool_trip_logs` by user (and by group) — CO₂ saved, trips, credits. **Impact page** shows the user's personal totals with a progress ring and comparisons ("= 3 trees/month").

## API surface (mounted at `/api/locations/:lid/carpool`)

| Method | Route | Description |
|---|---|---|
| GET | `/rides` | List/search open rides (matcher-ranked for caller) |
| POST | `/rides` | Post a ride (driver) |
| GET | `/rides/mine` | Rides I drive or ride in (upcoming + past) |
| GET | `/rides/:id` | Ride detail with bookings |
| PATCH | `/rides/:id` | Update ride (seats/time) |
| DELETE | `/rides/:id` | Cancel ride |
| POST | `/rides/:id/book` | Request a seat |
| POST | `/rides/:id/complete` | Mark trip completed (driver) |
| POST | `/bookings/:id/confirm` | Driver confirms rider |
| POST | `/bookings/:id/decline` | Driver declines rider |
| POST | `/bookings/:id/cancel` | Rider/driver cancels booking |
| GET | `/requests` | Open ride requests (for drivers to fill) |
| POST | `/requests` | Post "I need a ride" |
| DELETE | `/requests/:id` | Cancel request |
| GET | `/schedules` | My recurring schedules |
| POST | `/schedules` | Create recurring schedule |
| PATCH | `/schedules/:id` | Update/toggle schedule |
| DELETE | `/schedules/:id` | Delete schedule |
| GET | `/groups` | Groups I can see / am in |
| POST | `/groups` | Create a group |
| POST | `/groups/:id/join` | Join a group |
| POST | `/groups/:id/leave` | Leave a group |
| GET | `/leaderboard` | Impact leaderboard (window param) |
| GET | `/impact/me` | My personal impact + credits |
| GET | `/matches` | Suggested matches for me |

## Cron jobs contributed by the module

| Schedule | Job | Does |
|---|---|---|
| `0 5 * * *` | carpoolMaterialize | Turn recurring schedules into concrete rides/requests for the look-ahead window |
| `*/5 * * * *` | carpoolReminder | Remind drivers/riders of imminent departures; nudge unanswered booking requests |
| `*/10 * * * *` | carpoolMatch | Pair open requests with open rides above threshold; emit matches |
| `*/15 * * * *` | carpoolComplete | Auto-complete rides whose departure passed with confirmed riders; award impact/credits |

## Realtime

Enable Supabase Realtime on `carpool_rides` and `carpool_bookings`. The client subscribes to reflect seat changes and booking status live.

## Config keys (added to settings, admin-editable)

| Key | Default | Meaning |
|---|---|---|
| `carpool_enabled` | `true` | Master switch for the module UI |
| `carpool_min_lead_minutes` | `30` | Min lead time to post/book a ride |
| `carpool_max_detour_miles` | `8` | Detour cap used to normalize route overlap |
| `carpool_min_match_score` | `55` | Threshold for auto-suggested matches |
| `carpool_materialize_days` | `2` | Look-ahead days for recurring schedules |
| `carpool_reminder_lead_minutes` | `30` | When to remind about a departure |
| `carpool_priority_enabled` | `true` | Grant charger-queue priority to carpool drivers |
| `carpool_priority_weight` | `100` | Priority value applied to the queue entry |
| `carpool_co2_grams_per_mile` | `400` | Emission factor for impact math |
| `carpool_credit_per_trip` | `10` | Base credits per completed trip |
| `carpool_credit_per_rider` | `5` | Extra driver credits per rider carried |
