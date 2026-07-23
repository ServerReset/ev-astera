# ARCHITECTURE

## Why modules

The original spec was a monolith of features glued into shared `routes/`, `services/`, `jobs/` folders. That works for 10 features and rots at 30. This build reorganizes the server around **feature modules**: a vertical slice per domain that owns everything it needs and declares it through one manifest. The core knows nothing about carpooling or chargers — it only knows how to mount modules.

```
server/src/
├── index.js            # local-dev only: create app, register modules, listen
├── app.js              # express app: security mw, mounts module routes via registry
├── modules/
│   ├── _kit/
│   │   ├── defineModule.js     # manifest validator/helper
│   │   └── moduleRouter.js     # builds a scoped express.Router per module
│   ├── registry.js             # the ONE list of active modules
│   ├── auth/            index.js routes service validators
│   ├── user/
│   ├── charger/
│   ├── session/
│   ├── queue/
│   ├── notification/
│   ├── message/
│   ├── admin/
│   └── carpool/        index.js routes service validators listeners matcher impact
├── services/           # cross-module singletons: config.service, services registry
├── providers/          # auth/*, notifications/*  (swappable behind interfaces)
├── events/             # eventBus, events, listeners/*
├── middleware/
├── utils/
├── db/                 # prisma.js (PrismaClient singleton)
└── config/

prisma/                 # schema.prisma, migrations/, seed.js  (server/prisma/)
api/                    # Vercel entrypoints (repo root): [[...path]].js wraps the Express
                        #   app as one serverless function; cron/daily.js is the Vercel
                        #   Cron target for dailyReset/weeklyReset/cleanup/carpool jobs
```

### Boot sequence

In production (`api/[[...path]].js`), module-top-level code runs once per cold start: `assertConfig()`, `registerAllServices()`, `registerListeners()`, `initWebPush()`, `createApp()` — then every request just calls the resulting Express app as a plain request handler. No `listen()`, no persistent process.

`server/src/index.js` mirrors the same sequence plus `app.listen(PORT)`, for local development only.

1. Load env.
2. Build the express app (`app.js`) — this reads `modules/registry.js` and mounts every module's routes under the right scope.
3. Register event listeners: core listeners (`events/listeners/index.js`) + each module's `listeners[]`.
4. Start web-push (VAPID) and the config-service cache warmer.
5. (local dev only) `listen(PORT)`.

There is no cron scheduler process. The handful of genuinely time-based jobs (`dailyReset`, `weeklyReset`, `cleanup`, carpool materialize/match/complete) are plain functions invoked in sequence by `api/cron/daily.js` when Vercel's daily Cron trigger hits it (`Authorization: Bearer $CRON_SECRET`, verified before running anything). Everything that used to be a frequent polling sweep — session overtime, expired queue entries, carpool reminders — is now computed lazily inside the relevant read path instead (`transitionOvertimeSessions`, `transitionExpiredQueueEntries`), emitting the same events the old cron jobs did so downstream listeners (notifications, audit log) are unaffected. Carpool reminders (previously a 5-minute sweep) have no daily-cron equivalent and are dropped.

### Request lifecycle

`helmet → cors → cookie-parser → json → rateLimiter(global) → router`
Location-scoped routes additionally pass `authenticate → locationScope`. Admin routes add `authorize('admin')`. Per-route: `validate(schema)` then the handler (wrapped by `asyncHandler`). Errors bubble to `errorHandler` (last mw) which formats the envelope.

## Event flow (example: session ends and queue advances)

```
POST /sessions/:id/end
  → session.service.end() updates DB, emits SESSION_ENDED
      ├─ queue.listeners: on SESSION_ENDED → queue.service.advance() → emits QUEUE_ADVANCED
      │     └─ notification.listeners: on QUEUE_ADVANCED → dispatchNotification(nextUser, "It's your turn")
      ├─ carpool.listeners: on SESSION_ENDED → if driver had priority hold, release it
      └─ audit.listeners: on SESSION_ENDED → insert audit_log row
```

No service calls another service's side effects directly. This is what keeps modules independent and testable, and it's why adding carpool required **zero edits** to session/queue code — carpool just subscribes to the events it cares about.

`eventBus.emit()` runs listeners synchronously (`await`ed inline), not deferred — required on serverless, where the function can freeze immediately after the response is sent and a `setImmediate`-deferred listener would never run.

## Provider seams

- **Auth** (`providers/auth`): `local.provider.js` (built) and `entra.provider.js` (stub). Selected by `AUTH_PROVIDER`.
- **Notifications** (`providers/notifications`): `inApp` + `push` built; `email` + `teams` stubs. Dispatcher fans out to enabled channels.

## Config service

`configService.get(key, locationId)` reads the `settings` table, caches per `(location,key)` for 60s. Admin PATCH invalidates the cache. All business rules — including carpool ones (`carpool_min_lead_minutes`, `carpool_priority_enabled`, `carpool_credit_per_trip`, `carpool_co2_grams_per_mile`, …) — flow through here.

## Location scoping

Every table carries `location_id`; every scoped route is `/api/locations/:locationId/...`. `locationScope` validates the id exists and attaches `req.locationId`. Multi-site later = insert rows + expose the client `LocationContext` selector. No architectural change.

## Event payloads (reference)

| Event | Payload |
|---|---|
| `SESSION_STARTED` | `{ locationId, sessionId, chargerId, userId, etaAt }` |
| `SESSION_ENDED` | `{ locationId, sessionId, chargerId, userId }` |
| `SESSION_OVERTIME` | `{ locationId, sessionId, chargerId, userId, minutesOver }` |
| `QUEUE_ADVANCED` | `{ locationId, chargerId, queueEntryId, userId, expiresAt }` |
| `QUEUE_SKIPPED` | `{ locationId, chargerId, queueEntryId, userId }` |
| `CARPOOL_RIDE_POSTED` | `{ locationId, rideId, driverId, direction, departAt, seatsTotal }` |
| `CARPOOL_BOOKING_REQUESTED` | `{ locationId, rideId, bookingId, riderId, driverId }` |
| `CARPOOL_BOOKING_CONFIRMED` | `{ locationId, rideId, bookingId, riderId, driverId, seatsRemaining }` |
| `CARPOOL_TRIP_COMPLETED` | `{ locationId, rideId, driverId, riderIds, miles, co2Grams, creditsAwarded }` |
| `CARPOOL_PRIORITY_GRANTED` | `{ locationId, userId, chargerId?, rideId }` |
| `CARPOOL_MATCH_FOUND` | `{ locationId, requestId, riderId, rideId, score }` |

See `docs/CARPOOL.md` for the matcher and impact math.

## Security model

The Express API is the only authoritative surface. It connects to Postgres via Prisma with
full server-side credentials (`server/src/db/prisma.js`) and is the only thing that ever
touches the database — every read and write, for every table, goes through it (auth,
ownership checks, Zod validation, rate limiting).

There is no separate client-side database credential and no Row-Level Security to reason
about: the browser only ever talks to `/api/...` over REST, authenticated the normal way
(JWT + refresh cookie). The previous Supabase-era model relied on the client holding a public
**anon** key to open Realtime subscriptions directly against Postgres, which meant a chunk of
tables needed RLS policies just to make that safe. That entire surface is gone — the client's
"live" updates (`client/src/hooks/useRealtime.js`) are now short-interval polling (~20s)
against the same authenticated REST endpoints everything else uses, so there's nothing for a
visitor to reach that the API wouldn't already gate.
