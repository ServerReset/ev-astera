# Astera Labs EV Charger Hub + Carpool

A production-ready Progressive Web App for managing workplace EV chargers **and** coordinating carpools. Built as a modular, feature-sliced monorepo designed to grow: every domain (chargers, sessions, queue, reservations, carpool, …) is a self-contained module that plugs into a registry with zero changes to the core.

> This repo is the full build of the original workplace EV-charging prompt, extended with a first-class **Carpooling** capability: ride matching, recurring commutes, an EV-charging tie-in (charger queue priority for carpool drivers), and an incentives/impact layer (CO₂ + miles saved, credits, leaderboard).

---

## Table of contents

- [Architecture at a glance](#architecture-at-a-glance)
- [Repository layout](#repository-layout)
- [The module system (how to add a feature)](#the-module-system-how-to-add-a-feature)
- [Carpooling](#carpooling)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Database setup (Prisma + Vercel Postgres)](#database-setup-prisma--vercel-postgres)
- [Deployment](#deployment)
- [Acceptance criteria](#acceptance-criteria)

---

## Architecture at a glance

```
[Browser / installed PWA]
     │
     ├── static assets ─────────► Vercel CDN (React SPA, same project)
     │
     ├── REST /api/... ─────────► Vercel serverless function (api/[[...path]].js, Express)
     │                               ├── module registry (chargers, sessions, queue,
     │                               │     reservations, carpool, messaging, …)
     │                               ├── event bus (side-effects decoupled from services,
     │                               │     awaited inline — safe on serverless)
     │                               ├── provider layer (auth: local|entra, notify: inApp|push|email|teams)
     │                               ├── compute-on-read status transitions (overtime, expired
     │                               │     queue entries, reservation start/end) — no polling cron
     │                               └── Prisma → Vercel Postgres
     │
     ├── daily Vercel Cron ─────► api/cron/daily.js (dailyReset, weeklyReset, cleanup,
     │                               carpool materialize/match/complete)
     │
     └── polling (~20s) ────────► same REST API (replaces Supabase Realtime)
```

One Vercel project holds the client build and the API function — deployed together from local files via the Vercel CLI, no GitHub integration required.

Two ideas make it scale:

1. **Feature modules (vertical slices).** A module owns its routes, service, validators, and event listeners, and declares them through one manifest. The server core discovers modules and mounts them — it never imports a domain directly. Delete a module's folder and remove one line, and it's gone. Add a folder and one line, and it's live.
2. **Provider + event-bus seams.** Auth and notifications are swappable providers behind an interface. Cross-cutting reactions (audit logging, notifications, queue advancement) are event listeners, not inline calls. New behavior = a new listener, not an edit to existing services.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/CONTRACTS.md`](docs/CONTRACTS.md) for the full contract.

## Repository layout

```
ev-charger-hub/
├── api/           Vercel serverless entrypoints ([[...path]].js wraps the Express app, cron/daily.js)
├── client/        React 18 + Vite + Tailwind PWA
├── server/        Express + Prisma, feature-module architecture
├── shared/        Constants + Zod schemas shared by both
├── docs/          Architecture, contracts, original build spec
├── vercel.json    One project: builds client/, serves api/ as functions, declares the daily cron
└── README.md
```

## The module system (how to add a feature)

A server module is a folder under `server/src/modules/<name>/` exporting a manifest from `index.js`:

```js
export default defineModule({
  name: 'carpool',
  // mounted under /api/locations/:locationId/carpool
  routes: (router) => { /* attach express routes */ },
  listeners: [ /* { event, handler } registered on the shared bus */ ],
});
```

`server/src/modules/registry.js` imports every module's manifest and the core (`app.js`, `events/listeners/index.js`) iterates the registry. To add a feature you (1) create the folder, (2) add one import line to `registry.js`. Nothing else in the core changes. The genuinely time-based jobs (daily/weekly resets, carpool materialize/match/complete) aren't module-declared — they're plain functions called in sequence from [`api/cron/daily.js`](api/cron/daily.js) on Vercel's daily cron trigger; everything else that used to be a frequent cron sweep (session overtime, expired queue entries, reservation start/end) is now computed lazily on read (see `transitionOvertimeSessions`/`transitionExpiredQueueEntries`/`transitionReservations` in the relevant `*.service.js` files).

On the client the same idea is mirrored in `client/src/modules/registry.js`: each feature contributes nav items, routes, and realtime subscriptions.

## Carpooling

The carpool module adds:

- **Ride matching** — drivers post trips (origin, destination = site, departure window, seats); riders search/request; a scoring matcher ranks candidates by route overlap, timing, and reliability.
- **Recurring commutes** — weekly standing schedules and named carpool groups; the cron layer materializes upcoming trips and sends reminders.
- **EV-charging tie-in** — a driver who is carpooling today can be granted **queue priority** on a charger (configurable), and the dashboard surfaces "charging + carpooling today" so riders can coordinate around the driver's charging window.
- **Incentives & impact** — every completed trip logs miles and computes CO₂ avoided vs. solo driving; users earn **credits**; a **leaderboard** ranks impact. All thresholds are admin-configurable.

Full detail: [`docs/CARPOOL.md`](docs/CARPOOL.md).

## Local development

Prerequisites: **Node 20 LTS**, npm 10+, a Vercel account with a Postgres database attached to this project (see below).

```bash
# 1. server
cd server
cp .env.example .env          # fill in POSTGRES_URL, JWT secret, VAPID keys
npm install                   # also runs `prisma generate` via postinstall
npm run gen:vapid             # prints VAPID keys to paste into .env (both sides)
npm run dev                   # http://localhost:3001

# 2. client (separate terminal)
cd client
cp .env.example .env          # fill in VITE_* values
npm install
npm run dev                   # http://localhost:5173
```

## Environment variables

See [`server/.env.example`](server/.env.example) and [`client/.env.example`](client/.env.example). Every variable is documented inline.

## Database setup (Prisma + Vercel Postgres)

1. In the Vercel dashboard, add a Postgres database to this project (Project → Storage). Vercel injects the connection strings as project env vars — pull them locally with `vercel env pull`.
2. `cd server && npx prisma migrate dev --name init` — creates every table from [`server/prisma/schema.prisma`](server/prisma/schema.prisma).
3. `npx prisma db seed` — runs [`server/prisma/seed.js`](server/prisma/seed.js): creates the default location (fixed id `11111111-1111-1111-1111-111111111111`), an admin user (`admin@asteralabs.com`, placeholder password), and 3 chargers. Settings aren't seeded — `configService` falls back to `shared/constants.js`'s `SETTING_DEFAULTS` when no row exists, so defaults apply automatically.
4. **Required:** from `server/`, run `npm run seed:admin` (defaults to password `ChangeMe123!`, or pass your own: `npm run seed:admin "MyPassword1!"`) to set a real bcrypt password hash — skipping it means the admin login 401s.
5. Both `VITE_DEFAULT_LOCATION_ID` (client) and `DEFAULT_LOCATION_ID` (server) must be set to `11111111-1111-1111-1111-111111111111` — they have to match the location the seed actually created, or every request 404s at the location-scope check.

No Row-Level Security or anon key is involved — Prisma always connects with full server-side credentials, and the client never talks to the database directly (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for what replaced the old Supabase Realtime/RLS model).

## Deployment

Everything — client build and API — deploys as **one Vercel project**, from your local machine via the Vercel CLI. No GitHub integration is used anywhere in this path.

1. `npm install -g vercel && vercel login`, then from the repo root `vercel link` (decline connecting a Git repo — this stays local-CLI-only).
2. Add a Postgres database to the project (Storage tab) if you haven't already, and set the remaining secrets in the dashboard: `JWT_SECRET`, `CRON_SECRET`, VAPID keys, `DEFAULT_LOCATION_ID`.
3. Run the Prisma migration + seed against production (`npx prisma migrate deploy`, `npx prisma db seed`, `npm run seed:admin`) once you're confident it works locally.
4. From the repo root: `vercel --prod` — the root [`vercel.json`](vercel.json) builds `client/` (`buildCommand`, `outputDirectory: client/dist`), serves [`api/[[...path]].js`](api/%5B%5B...path%5D%5D.js) as the API function for every `/api/*` request, and registers the daily cron declared in `vercel.json` against [`api/cron/daily.js`](api/cron/daily.js).
5. Check the Vercel dashboard's Cron Jobs tab to confirm `/api/cron/daily` is scheduled.

## Acceptance criteria

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/CONTRACTS.md`](docs/CONTRACTS.md) for the full system contract, and [`docs/CARPOOL.md`](docs/CARPOOL.md) for the carpool module's matching/impact rules — together these are the acceptance spec for chargers, sessions, queue, reservations, messaging, and carpooling.

---

Charging guidelines by Taylor Frostholm.
