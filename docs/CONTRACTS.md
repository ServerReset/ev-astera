# CONTRACTS — the exact seams every module must honor

This document is the single source of truth for how the pieces fit. If code and this doc disagree, this doc wins. It exists so that many files can be written independently and still compose.

---

## 1. Server module manifest

Every feature lives in `server/src/modules/<name>/` and its `index.js` default-exports the result of `defineModule`:

```js
// server/src/modules/_kit/defineModule.js
export function defineModule(manifest) {
  // Validates shape and returns it. Fields:
  // {
  //   name: string,                         // unique, kebab/lower
  //   basePath?: string,                    // default: `/${name}` under the location scope
  //   scope?: 'location' | 'root',          // 'location' => mounted under /api/locations/:locationId
  //   routes?: (router, ctx) => void,       // attach express handlers to the provided Router
  //   listeners?: Array<{ event, handler }>,// registered on the shared event bus
  //   jobs?: Array<{ name, schedule, handler, runOnBoot? }>, // node-cron jobs
  //   realtimeTables?: string[],            // documented tables this module expects Realtime on
  // }
  return manifest;
}
```

- `scope: 'location'` (default) → routes mount at `/api/locations/:locationId<basePath>`; the `locationScope` middleware has already validated `req.locationId`.
- `scope: 'root'` → routes mount at `/api<basePath>` (used by auth, users, notifications, messages, admin).
- `ctx` passed to `routes` contains `{ services, config, bus, dispatchNotification }` (the shared singletons) so a module never deep-imports another module's internals — it goes through `ctx.services`.

### Handler contract

Route handlers are `async (req, res, next)`. They **never** try/catch for control flow — they `throw` typed errors (see §4) and let the global error handler format the response. Success responses use the envelope in §3. Every handler that mutates state ends by emitting a domain event (§5) rather than calling notification/audit code inline.

### Service contract

Each module exposes a service object (`<name>.service.js`) with pure-ish async methods that take primitives/DTOs and return plain objects. Services:

- receive `locationId` as the first argument when location-scoped,
- read business rules through `configService.get(key, locationId)` — never hardcode,
- use the Supabase service-role client from `db/supabase.js`,
- emit events via the bus after a successful state change,
- throw typed errors on rule violations.

Services are registered in `server/src/services/index.js` as `services.<name>` so listeners/other modules can reach them via `ctx.services`.

---

## 2. Shared imports (paths are stable — generators rely on these)

Server:

| Import | Path | Exports |
|---|---|---|
| Supabase client | `../../db/supabase.js` | `supabase` (service role) |
| Errors | `../../utils/errors.js` | `AppError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError, BusinessRuleError, RateLimitError` |
| Logger | `../../utils/logger.js` | `logger` (winston) |
| Time | `../../utils/timeUtils.js` | `now, addMinutes, addHours, diffMinutes, startOfWeek, toZoned, formatTime` |
| Event bus | `../../events/eventBus.js` | `bus` (EventEmitter) |
| Event names | `../../events/events.js` | `EVENTS` (frozen map) |
| Config | `../../services/config.service.js` | `configService` |
| Services registry | `../../services/index.js` | `services` |
| Notifications | `../../providers/notifications/index.js` | `dispatchNotification, dispatchBulk` |
| Auth provider | `../../providers/auth/index.js` | `authProvider` |
| Validate mw | `../../middleware/validate.js` | `validate(schema, 'body'|'query'|'params')` |
| Authn mw | `../../middleware/authenticate.js` | `authenticate` |
| Authz mw | `../../middleware/authorize.js` | `authorize('admin')` |
| Async wrap | `../../utils/asyncHandler.js` | `asyncHandler(fn)` (so throws reach the error mw) |
| Response | `../../utils/respond.js` | `ok(res, data, status?)`, `paginated(res, items, page, total)` |

Client:

| Import | Path | Exports |
|---|---|---|
| API client | `../services/api.js` | `api` (axios instance w/ interceptors) |
| Supabase | `../config/supabase.js` | `supabase` (anon) |
| cn util | `../utils/cn.js` | `cn(...classes)` |
| constants | `../utils/constants.js` | re-exports from `shared/constants.js` + UI constants |
| stores | `../stores/*.js` | zustand hooks |

Shared:

| Import | Path |
|---|---|
| constants | `../../shared/constants.js` (server) / aliased `@shared/constants` (client via vite) |
| validation | `../../shared/validation.js` / `@shared/validation` |

---

## 3. Response envelope

Success:
```json
{ "data": <payload>, "meta": { "page": 1, "total": 42 } }   // meta optional
```
Error (from global handler):
```json
{ "error": { "code": "BUSINESS_RULE_VIOLATION", "message": "…", "details": { } } }
```
`ok(res, data)` → `{ data }`. `paginated(res, items, page, total)` → `{ data: items, meta: { page, total, pageSize } }`.

---

## 4. Error classes (utils/errors.js)

| Class | status | code |
|---|---|---|
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `AuthenticationError` | 401 | `AUTHENTICATION_ERROR` |
| `AuthorizationError` | 403 | `AUTHORIZATION_ERROR` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `BusinessRuleError` | 422 | `BUSINESS_RULE_VIOLATION` |
| `RateLimitError` | 429 | `RATE_LIMITED` |

Constructor: `new BusinessRuleError(message, details?)`. All extend `AppError(message, status, code, details)`.

---

## 5. Event names (events/events.js) — the vocabulary

Domain services emit these; listeners react. Frozen `EVENTS` object. Payloads are documented in ARCHITECTURE.md. Canonical set:

```
USER_REGISTERED, USER_UPDATED
SESSION_STARTED, SESSION_UPDATED, SESSION_ENDED, SESSION_FORCE_ENDED, SESSION_OVERTIME, SESSION_OVERTIME_ESCALATED
QUEUE_JOINED, QUEUE_LEFT, QUEUE_ADVANCED, QUEUE_CLAIMED, QUEUE_SKIPPED
CHARGER_ONLINE, CHARGER_OFFLINE
NUDGE_SENT, NUDGE_REACTED, EMERGENCY_REQUESTED, EMERGENCY_RESPONDED
ANNOUNCEMENT_CREATED
CARPOOL_RIDE_POSTED, CARPOOL_RIDE_UPDATED, CARPOOL_RIDE_CANCELLED
CARPOOL_BOOKING_REQUESTED, CARPOOL_BOOKING_CONFIRMED, CARPOOL_BOOKING_DECLINED, CARPOOL_BOOKING_CANCELLED
CARPOOL_TRIP_COMPLETED, CARPOOL_MATCH_FOUND
CARPOOL_SCHEDULE_CREATED, CARPOOL_SCHEDULE_CANCELLED
CARPOOL_CREDITS_AWARDED, CARPOOL_PRIORITY_GRANTED
```

Every event is also consumed by `audit.listeners.js`, which writes an `audit_log` row. So emitting an event *is* auditing it.

---

## 6. Notification dispatch contract

`dispatchNotification(userId, { title, body, type, priority?, actionUrl?, metadata? })` iterates enabled channels (inApp always, push if subscribed, email/teams stubs). `type` is one of `NOTIFICATION_TYPES` in `shared/constants.js` and controls the client icon/color. Listeners are the only callers in normal flow.

---

## 7. Client module manifest

`client/src/modules/<name>/index.js`:
```js
export default {
  name: 'carpool',
  nav: [{ to: '/carpool', label: 'Carpool', icon: 'Car', order: 25, roles: ['user'] }],
  routes: [{ path: '/carpool', element: <CarpoolPage/> }, ...],
  realtime: [{ table: 'carpool_rides', handler: 'onRideChange' }],
};
```
`client/src/modules/registry.js` aggregates nav (sorted by `order`) and routes. `Sidebar`/`BottomNav` render from the aggregated nav; `App.jsx` renders aggregated routes inside the app layout.

---

## 8. Naming & style rules for all generated files

- ES modules (`import`/`export`), `"type": "module"` in both package.json files.
- 2-space indent, single quotes, semicolons, trailing commas in multiline.
- React: function components, hooks, no class components except `ErrorBoundary`.
- Tailwind classes only (no inline styles) except dynamic values that must be computed.
- Every exported component/function has a one-line JSDoc `/** ... */` when its purpose isn't obvious from the name.
- No `TODO`, no `...` placeholders, no dead stubs **except** the explicitly-required provider/channel stubs (`entra.provider.js`, `email.channel.js`, `teams.channel.js`) which throw `NotImplementedError`.
