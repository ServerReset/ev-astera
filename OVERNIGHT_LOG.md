# Overnight Rebuild Log — `client/`

**Started:** 2026-07-22 (overnight, autonomous)
**Scope:** Full redesign/rebuild of `client/` in ev-charger-hub. `server/` is OFF LIMITS (API contract fixed).
**Design system:** Material 3 (primary spec) + Liquid Glass (elevated surfaces only) + frontend-design (polish).

## Operating constraints (this environment)
- **No shell.** PowerShell/bash blocked by enterprise policy. `node_modules` not installed. No dev server, no build, no lint, no live preview.
- **Verification is read-only.** I trace imports, call sites, and JSX/logic by eye, and cross-check every server-hitting call against the actual `server/` route handler. I never claim "builds" / "passes lint" / "verified" — status is logged as **"traced — looks correct"** or **"unverified"**.
- **Hard boundaries (never):** `git push`, force-push, hard reset, delete any file or branch. → Consequence: files that are confirmed dead (e.g. `client/src/config/supabase.js`) are **left in place** and flagged here for the user to delete, not removed by me.
- **Judgment calls:** made autonomously; the user is asleep and asked for zero questions.

## Rebuild strategy (why surgical, not blank-slate)
The foundation (M3 token layer in `index.css` + `tailwind.config.js`, theme store, axios envelope/refresh, module registry, Zod-shared validation, formatting utils) was already built to M3 spec in prior sessions and **works against the live server**. With no build to catch regressions, deleting it wholesale would risk silent breakage against the "must actually deploy" mandate. So:
- **Preserve exactly:** the fixed server API contract (`services/endpoints.js`, `services/api.js`), the module manifest/registry system, Zod schemas, data-fetching flow.
- **Rebuild freely (rewrite file contents, never delete files):** layout/nav architecture, page composition, component styling, responsiveness, motion.
- Every rebuilt screen keeps its data calls byte-identical; only presentation/structure changes.

## Design decisions (global)
- **Adaptive nav — the biggest gap.** Today: 2 modes only (`Sidebar` ≥768, `BottomNav` <768). Target: **3 breakpoints** —
  - **Compact** (<600 phone / practical `<md` 768): bottom navigation bar.
  - **Medium** (tablet, ~768–1023): **navigation rail** (icon + short label, vertical).
  - **Expanded** (laptop, ≥1024): permanent **navigation drawer** (icon + full label + brand header + footer).
  - Content uses list-detail / multi-pane on medium+ where the screen supports it.
- **Liquid glass** stays scoped to floating/elevated surfaces (header menu, modals, bottom nav, toasts) — never the base `.card`.
- **Motion:** M3 easing/duration tokens already in Tailwind (`emphasized`, `standard`, durations). Add hover/press/enter-exit deliberately, respect `prefers-reduced-motion` (already handled globally in `index.css`).
- **Color/type/shape/elevation:** M3 token layer already complete for light+dark with AA-tuned light values. Reuse; extend only where a screen needs a role not yet present.

---

## Progress

### Phase 0 — Exploration & mapping ✅ (traced — looks correct)
Read the full foundation: `App.jsx`, `index.css`, `tailwind.config.js`, `services/{endpoints,api}.js`, `modules/registry.js` + all 6 module manifests, `components/layout/{AppLayout,Sidebar,BottomNav,Header,PageHeader}.jsx`, all 4 stores, all 7 hooks, all 4 utils, `main.jsx`, `index.html`, `Icon.jsx`, `States.jsx`, `Button.jsx`, `SettingsPage.jsx`, `DashboardPage.jsx`.

Notes captured:
- `config/supabase.js` — **DEAD** (self-documents "Delete this file"; realtime is now polling via `useRealtime.js`). Flagged for user deletion; left in place per hard boundary.
- `useRealtime` is a 20s poller; `channelName`/`tables`/`filter` args are vestigial (ignored). Call sites still pass them — harmless.
- Theme flash-guard in `index.html` mirrors `themeStore` resolution — correct.

### Phase 1 — Adaptive navigation (flagship) ✅ (traced — looks correct)
**Before:** 2 nav modes only — `Sidebar` (`hidden md:flex`, ≥768) and `BottomNav` (`md:hidden`, <768). No tablet-specific nav; the desktop sidebar simply appeared at 768. Not the 3-form-factor adaptive nav the spec requires.

**After:** 3 M3 window classes, each a distinct nav form factor, exactly one visible at any width:
- **Compact <600** → `BottomNav.jsx` (`medium:hidden`): bottom navigation bar, ≤5 destinations, icon-in-pill active indicator + label beneath, press-scale motion, **liquid glass** (floating surface, <800px safe). Frosted fallback on Safari/FF.
- **Medium 600–839** → `NavRail.jsx` (NEW; `hidden medium:flex expanded:hidden`): 80px vertical rail, brand mark on top, icon-over-label, pill active indicator, hover/press motion.
- **Expanded ≥840** → `Sidebar.jsx` rewritten as permanent **navigation drawer** (`hidden expanded:flex`, 72×w): brand header, full labels beside icons, pill active indicator, footer note.

**Supporting changes:**
- `tailwind.config.js`: added M3 window-class screens `medium: 600px`, `expanded: 840px` (additive — `sm/md/lg` untouched). Added `transitionDuration` tokens `short/medium/long` → the `duration-*` utilities the nav (and later screens) use; without this they'd silently no-op since only `transitionTimingFunction` was previously extended.
- `AppLayout.jsx`: renders all three (`<Sidebar/><NavRail/>` as fl*siblings*, `<BottomNav/>` fixed); main region `max-w-6xl` + `animate-fade-in`; bottom padding clears the bar only on compact via `medium:pb-8`.
- `Header.jsx`: mobile brand + padding switched `md:`→`medium:` so the brand shows only on compact (rail/drawer carry their own brand).

**Breakpoint behaviors implemented:** nav form factor changes across all 3 classes; touch density adapts (bottom bar tall tap targets, rail compact, drawer roomy); active-indicator pill is the shared M3 motif; motion via `duration-medium ease-emphasized`.

**Verification (traced, no build):** `navForRole` contract unchanged (returns `{to,label,icon,end,...}`); all imports resolve (`NavRail` newly created + imported in `AppLayout`); NavLink render-prop + className-fn dual usage is valid in react-router v6; `duration-*`/`ease-*` utilities now backed by config; `.lg-panel` + `useLiquidGlass` usage matches Header's proven pattern. Not build-verified (no toolchain).

### Phase 2 — Dashboard page ✅ (traced — looks correct)
**Before:** Single `max-w-5xl` column. Header → EmergencyBanner → NudgeInboxWidget → (ActiveSessionCard) → charger grid (`sm:grid-cols-2 lg:grid-cols-3`) → QueuePanel stacked at the very bottom. Plain spinner while loading. No multi-pane; queue buried below a long charger grid on wide screens.

**After (structure + design):**
- **List-detail multi-pane** at `xl` (1280px+): chargers = primary pane; a **sticky secondary rail** (`xl:sticky xl:top-20`, 20rem) holds NudgeInboxWidget + QueuePanel so the queue is always in view on laptops instead of scrolled past. Below xl it stacks beneath the chargers.
- **Why xl, not expanded(840):** the 288px permanent drawer already consumes width at 840; a side rail there would crush chargers to ~160px. Gated the split at xl where 1280 − drawer − padding ≈ 940px leaves a ~600px 2-col charger pane. Logged inline in the file.
- **Loading:** replaced bare spinner with a 4-tile **skeleton grid** matching the real card footprint (`h-40 rounded-2xl`) — no layout shift on load.
- **Motion:** charger tiles **stagger in** (`animate-slide-up` + `animationDelay` capped at 6×40ms) with `[animation-fill-mode:backwards]` so delayed tiles stay hidden pre-animation (without backwards fill they'd flash visible→hidden→in). ActiveSessionCard slides up.
- **Header description** now live: "N of M available right now."; Emergency button label collapses to icon-only under `sm`.

**Breakpoint behaviors:** compact/medium/expanded = single column (chargers `sm:grid-cols-2`); xl = two-pane list-detail with sticky rail.

**Confirmed fixes made while rebuilding (traced):**
- `availableCount` was written as `c.status === 'available'` (raw string). Switched to `CHARGER_STATUS.AVAILABLE` constant — a raw-string enum compare silently reads 0 if the enum value ever differs from the literal. Failure scenario: enum = `'AVAILABLE'` (uppercase) → header always shows "0 of M available". Now imports + uses the constant.

**Preserved exactly:** all four `useApi` calls (`chargerApi.list`, `sessionApi.active`, `queueApi.list`, `queueApi.mine`), `normalizeActive`, `refreshAll`, `useRealtime`, every modal prop, `canStart`/`canJoinQueue` logic. Child components (ChargerCard, ActiveSessionCard, QueuePanel, NudgeInboxWidget, EmergencyBanner, all modals) untouched — only the page composition changed.

**Verification (traced, no build):** all imports resolve; `CHARGER_STATUS` is exported via `constants.js` → `@shared/constants.js` (re-export confirmed); grid template `[minmax(0,1fr)_20rem]` is valid arbitrary Tailwind; `xl:` is a default Tailwind screen (unaffected by my `medium/expanded` additions). Not build-verified.

### Bug sweep — untouched utils/hooks/stores/services/PWA ✅ (adversarial, 2 fixes applied + 1 flagged server-side)
Ran a fan-out sweep (9 agents: find across utils/hooks/stores/services+registry/PWA, then skeptical adversarial verifiers). 4 candidates surfaced, 3 confirmed after refutation, 1 refuted. Every confirmed finding was re-checked by me against the actual source (client + server) before touching anything.

**Fix 1 — `hooks/useApi.js` (race condition, APPLIED, traced).**
- *Failure scenario:* `board = useApi(() => carpoolApi.leaderboard({ window }), [window])` on CarpoolImpactPage (and identically AdminPage UsersTab `useApi(..., [query])`). Selecting **Month** then quickly **All** fires `refetch` twice via the deps effect. `refetch` had only a `mounted` guard, which stops writes after unmount but NOT out-of-order resolution. If the Month request resolves *after* the All request, `setData(month)` runs last → UI shows "All time" selected but renders the Month leaderboard, and stays wrong until the next refetch.
- *Fix:* added a monotonic `callId` ref; each `refetch` captures `id = ++callId.current` and gates all three state writes (`setData`/`setError`/`setLoading`) behind `mounted.current && id === callId.current`. Stale earlier responses are discarded. Return value still resolves/rejects for direct `await refetch()` callers (manual refresh handlers) regardless of currency — verified against all call sites.
- *Verification (traced):* walked all four orderings (late-resolves-first, early-resolves-first, error-on-latest, single-call). No behavior change for the common single-call path. Not build-verified.

**Fix 2 — `sw.js` push deep-link (api-shape mismatch, APPLIED, traced against server).**
- *Root cause confirmed by reading the server:* `server/src/providers/notifications/push.channel.js:19-26` builds the wire body as `{ title, body, icon, badge, tag, data: { url: payload.actionUrl || '/', ...payload.metadata } }` and JSON-stringifies it (`utils/pushUtils.js:29`). The deep-link lives at **`data.data.url`**. The SW was reading top-level `data.actionUrl` (always undefined) → every push click resolved to `'/'`, landing on the dashboard instead of `/carpool`, `/admin`, etc. (senders: `carpool/listeners.js`, `notification.listeners.js`).
- *Why this is in scope (server untouched):* the directive is "every client API call must match server exactly as it exists today." The server shape is fixed and correct; the CLIENT was out of sync. Fixed the client to read the shape the server actually sends. Server not modified.
- *Note vs task #10:* task #10 fixed the in-app REST `actionUrl` path (notification row → navigate). This is the **separate** Web Push SW path, still broken until now.
- *Fix:* `data: { actionUrl: data.data?.url || data.actionUrl || '/', ...(data.data || data.metadata || {}) }` — reads the nested `url` first, keeps top-level `actionUrl`/`metadata` as fallback so any hand-crafted/legacy payload still works. Updated the stale header comment (lines 6-7) that documented the wrong shape. `notificationclick` reads back `event.notification.data.actionUrl` — unchanged, now populated correctly.
- *Verification (traced):* cross-checked client SW ↔ server push.channel ↔ pushUtils by reading all three. Optional-chaining `data.data?.url` is safe when `data.data` is absent. Not build-verified.

**Flagged, NOT fixed — `sw.js` urgent-priority branch (dead-code, root cause is server-side = OFF LIMITS).**
- *Finding:* `vibrate`/`requireInteraction` gate on `data.priority === 'urgent'`, but the server push body (`push.channel.js:19-26`) never includes `priority`, so the branch is always false. URGENT pushes (e.g. QUEUE_ADVANCED "It's your turn!") show silently instead of vibrating + persisting.
- *Why not fixed:* the SW branch is already **correct in intent**; the only correct fix adds `priority: payload.priority,` to the server wire body, which changes the server response contract — explicitly OFF LIMITS this session. Fabricating a client-side workaround would be speculative. **→ USER ACTION:** add one line to `server/src/providers/notifications/push.channel.js` `send()` body object: `priority: payload.priority,` (sendBulk shares `send()`, so it's covered). No client change needed once that lands.

**Refuted (correctly not fixed) — `stores/notificationStore.js:32` markRead over-decrement.** Verifier refuted: both call sites (`NotificationsPage.jsx:40`, `NudgeInboxWidget.jsx:34`) gate with `if (!n.readAt) markRead(n.id)`, so already-read items never reach the decrement; React 18 flushes the discrete-click state update before a second click, closing the double-click window. No fix — would have been speculative defensive code.

### Phase 3 — Notifications ("Alerts") page ✅ (traced — looks correct)
**Before:** `max-w-2xl` single column. PageHeader → push-toggle `<Card>` → then a spinner / error / empty / list switch. Feed rows were `card`-styled buttons with an unread `ring-1 ring-brand/30` and a trailing dot. No way to filter; bare `<Spinner/>` on load; type/`.system` referenced as raw strings.

**After (structure + design):**
- **Layout rationale (why single-column, not multi-pane):** a notification feed has no detail view in this app — a row either deep-links away (`navigate(actionUrl)`) or just marks read. There's no master-detail content, so MD3's list-detail doesn't apply; MD3 instead says *constrain feeds to a readable width on large screens*. Kept `max-w-2xl` centered — correct at every breakpoint, roomy but not stretched on expanded/xl.
- **Filter chips (All / Unread):** real M3 filter-chip row (`role="tablist"`, `aria-selected`), pill active state reusing the app's brand-tonal active motif, live counts. Only rendered when there's something loaded to filter. "Unread" filters the loaded page (the API paginates; documented inline that this means "unread among what's loaded").
- **Unread affordance → M3 tonal, not a ring:** unread rows now use a `bg-surface-2` tonal container + `font-semibold text-content` title + leading brand dot; read rows are flat `bg-surface` with `border-border` + muted title. This is the MD3 "emphasis via tonal surface" cue rather than an outline ring.
- **Loading:** 5-row **skeleton** (`h-[68px]`, matches real row height) replaces the bare spinner — no layout jump.
- **Second empty state:** when the Unread filter yields nothing but items exist → a distinct "You're all caught up" state (CheckCheck icon) instead of the generic empty.
- **Motion:** rows **stagger in** (`animate-slide-up` + capped `animationDelay`, `[animation-fill-mode:backwards]`); push-toggle icon + chips animate color on `duration-medium ease-standard`.
- **Mark-all label** collapses to icon-only under `sm` (matches Dashboard's emergency-button pattern).

**Breakpoint behaviors:** single centered column at all widths (correct for a feed); touch targets ≥44px on the rows and chips; header action label hides under sm.

**Confirmed cleanups made while rebuilding (traced):**
- Replaced magic strings with constants: `NOTIFICATION_META.system` → `NOTIFICATION_META[NOTIFICATION_TYPES.SYSTEM]`, and `n.type === 'nudge'` → `n.type === NOTIFICATION_TYPES.NUDGE`. Verified `constants.js` re-exports `NOTIFICATION_TYPES` via `export * from '@shared/constants.js'` (line 5), so the import resolves (not undefined). Same class of latent silent-mismatch bug as the Dashboard `CHARGER_STATUS` fix.

**Preserved exactly:** store contract (`items/unread/loading/error/refresh/markRead/markAllRead`), the `if (!n.readAt) markRead(n.id)` guard (the one the bug-sweep verifier relied on — untouched), `usePushNotifications` usage, `useRealtime('notifications', ['notifications'], refresh)`, `NudgeReactionButtons` props (`messageId`, `initialReaction` from `n.metadata`). Swapped the `<Card>` import for the equivalent `card p-4` utility (confirmed identical: `Card` renders `cn('card p-4', className)`), dropping the now-unused `Card`/`Spinner` imports.

**Verification (traced, no build):** all imports resolve; `Icon` resolves lucide names with a `HelpCircle` fallback (safe for any unknown `meta.icon`); `relativeTime` exists in `time.js`; disabled logic (`!clickable && !isUnread`) means only already-read non-linking rows are inert — correct. Not build-verified.

### Phase 4 — Carpool pages (CarpoolPage + CarpoolImpactPage) ✅ (traced — looks correct)
**Scope decision (why light-touch, not full rewrite):** the carpool components were already built to M3 — `Tabs` is a proper segmented control (tonal `surface-2` track, `surface` active pill, `role=tablist`/`aria-selected`), and `RideCard`/`Leaderboard`/`ImpactStats` use only semantic tokens, correct shape scale, tonal icon chips, and `tabular-nums` on figures. Per the surgical strategy, rewriting them would be pure regression risk with no design gain (same call as the shared primitives). The genuine, *consistent* gaps vs. the bar set on Dashboard/Notifications were exactly two — **bare `<Spinner>` on load** and **no list entry-motion** — so I applied those at the page level and left the components alone.

**CarpoolPage (5 tabs: Find / My rides / Requests / Recurring / Groups):**
- **Skeletons replace spinners:** added `RideGridSkeleton` (card-sized `h-56` tiles in the same `sm:grid-cols-2 lg:grid-cols-3` grid) for the ride lists and `ListSkeleton` (`h-24` stack) for the request/schedule lists. The "My rides" loading branch now also keeps the "Offer a ride" action visible during load (was a bare full-view spinner that hid the whole tab).
- **Entry motion:** shared `ENTER` (`animate-slide-up` + `backwards` fill) + `stagger(i)` helpers; ride tiles, request cards, and schedule rows stagger in (delay capped at 8×40ms). Matches Dashboard/Notifications exactly.
- **Tab-switch transition:** the tab panel is wrapped in `<div key={tab} className="animate-fade-in" role="tabpanel">` — re-keying replays the fade on every switch and gives AT a fresh tabpanel region.
- Dropped the now-unused `Spinner` import.

**CarpoolImpactPage (personal stats + site leaderboard):**
- `StatsSkeleton` (6-tile grid matching `ImpactStats`) + an `h-80` leaderboard skeleton replace two bare spinners; results fade in.
- Loading guards tightened to `loading && !data` so a window refetch keeps the current board visible until the new one lands (no flash to spinner on every window switch).
- Dropped the unused `Spinner` import.

**Breakpoint behaviors:** ride grids `sm:grid-cols-2 lg:grid-cols-3`; page bodies `max-w-4xl` centered (constrained on expanded/xl per MD3 readable-width); `Tabs` horizontally scrolls on compact so the 5 tabs never wrap; stat grid `grid-cols-2 sm:grid-cols-3`.

**Preserved exactly (byte-identical):** every `useApi` call and its deps, all `useRealtime` subscriptions + `filter`, all `carpoolApi` calls (`listGroups/listRides/myRides/getRide/cancelBooking/completeRide/cancelRide/listRequests/matches/cancelRequest/listSchedules/updateSchedule/deleteSchedule/myImpact/leaderboard`), `useConfirm` flows, all modal props (`RideFormModal/BookRideModal/RideBookingsModal/RequestFormModal/ScheduleFormModal`), the `matchesByReq` map, the `window` leaderboard state. No API shapes touched.

**Interaction with the bug-sweep fix:** the leaderboard `window`-swap race (bug-sweep Fix 1) is resolved at the `useApi` layer, so CarpoolImpactPage benefits without any page-level change; noted the guarantee in the file's header comment.

**Verification (traced, no build):** `Card` spreads `...props` so `style`/`className` pass to the element (confirmed against Card source); no leftover `Spinner` references (grep clean); `ENTER`/`stagger` applied uniformly at 8 call sites; `cn(...)` composition on the schedule row preserves the original flex layout. Not build-verified.

### Phase 5 — Settings page (`SettingsPage`) + Profile stub ✅ (traced — looks correct)
**Before:** `max-w-2xl` single column with a 2-tab `Tabs` ("Profile" / "App settings"). Profile tab stacked StatsCard → ProfileCard → PrefsCard → PasswordCard → Sign out; App-settings tab held the theme toggle (3 border-boxed buttons, no preview) + onboarding replay. `ProfilePage.jsx` was already a dead stub returning `null`.

**After (structure + design) — reframed as an MD3 list-detail settings screen:**
- **Nav changes by breakpoint (the spec's core ask):** the two crowded tabs are split into **five focused sections** — Profile, Notifications, Appearance, Security, About & help. On **compact/medium** they're a horizontally-scrollable segmented `Tabs` bar (unchanged component); at **xl (1280px+)** that collapses into a **persistent left section rail** (`xl:grid xl:grid-cols-[248px_1fr]`), a sticky MD3 secondary-navigation list with the same pill active motif (`bg-brand/15 text-brand-strong`) used by the app's own drawer. So the settings nav literally changes form factor with window size, mirroring the global nav.
- **Why xl, not expanded(840):** identical math to Dashboard — the 288px permanent drawer already eats width at 840; a 248px section rail there would crush the detail pane. Gated at xl where ~940px of content splits cleanly into rail + panel. Logged inline.
- **Elevated theme toggle (the "real working light/dark" requirement):** each of Device/Light/Dark is now a **radio card with a miniature app-window preview** — a `ThemePreview` swatch painting that theme's actual bg/surface/brand/line as **fixed hex** (mirrors index.css light/dark palettes; deliberately NOT the live `--c-*` tokens, since a swatch must depict its own theme regardless of the active one). "Device" renders a diagonal light/dark split with a second mini-window. Active card gets a brand border + tonal fill + a check badge. `role="radiogroup"`/`role="radio"`/`aria-checked` for AT. The working `themeStore` logic (localStorage persist + live OS-follow) is untouched — only its UI was elevated.
- **Content constrained** to `max-w-5xl` (was 2xl) to give the two-pane layout room while still bounded on large screens per MD3 readable-width.
- **Section panel** is re-keyed (`key={section}`) so it `animate-fade-in`s on every switch; each `CardHeader` gained an icon + subtitle for hierarchy. StatsCard gained a **4-tile skeleton** (`loading && !data`) replacing its bare `<Spinner/>`.
- **New "About & help" section** surfaces the app identity + the "Charging guidelines by Taylor Frostholm" note that previously only lived in the desktop drawer footer (so it's reachable on mobile too), alongside the onboarding replay.
- Notification switches gained `duration-medium ease-standard`/`ease-emphasized` transitions + per-switch `aria-label`.

**Breakpoint behaviors:** compact/medium = segmented tabs above a single detail column; xl = sticky 248px section rail + detail pane; theme cards `grid-cols-3` at all widths; stat grid `grid-cols-2 sm:grid-cols-4`; page `max-w-5xl` centered.

**Preserved exactly (contracts unchanged):** every API call — `userApi.stats/updateMe/changePassword/resetOnboarding/completeOnboarding` — and both Zod schemas (`updateProfileSchema`, `changePasswordSchema`) validated against `shared/validation.js` and the server `user.service.js` (`updateProfile` accepts `displayName`/`vehicleDescription`/`notificationPrefs`; `getStats` returns `{weeklySessionsUsed,weeklySessionsMax,totalSessions,carpool:{trips,miles,co2Kg}}` — both match the JSX). `useApi` return shape (`data/loading/error/refetch`) — used `stats.refetch` (correct; the hook exposes `refetch`, not `refresh`). `useThemeStore` `pref`/`setPref`, `useAuthStore` `patchUser`/`logout`, `OnboardingFlow onFinish`, all five `NOTIFICATION_TYPES` pref keys (confirmed present in `shared/constants.js`). The five error-mapping/save handlers are logic-identical to the originals, just relocated into per-section components.

**ProfilePage.jsx:** confirmed still a dead stub (`export default … return null`) and **not imported or routed anywhere** — only `SettingsPage` is registered (`modules/profile/index.js` → `/settings`). Left in place per the hard boundary (no file deletion); flagged for user deletion.

**Verification (traced, no build):** default export preserved so the lazy import in `modules/profile/index.js` still resolves; all 17 lucide icons imported are used; no dangling imports (`Tabs` still used for the compact switcher; `Spinner`/`ErrorState`/`Card`/`CardHeader`/`Input`/`Button` all used); `PALETTE` inline styles are static strings (no token dependency, safe for both themes); Tailwind JIT sees only literal classes (dynamic bits are inline `style`, not class interpolation). Not build-verified.

### Phase 6 — Auth pages (Login / Register / Forgot / Reset via shared `AuthShell`) ✅ (traced — looks correct)
**Scope decision (why rebuild the shell, not each page):** all four auth pages are thin — each just supplies `{title, subtitle, children, footer}` to the shared `AuthShell` and owns its form via `useZodForm` + `authStore`/`authApi`. The form markup was already clean (token-based `Input`/`Button`, `.link`, `.field-error`, `noValidate`, proper `autoComplete`). The one real gap vs. the MD3 adaptive-layout mandate was the shell itself: a single centered `max-w-sm` card at *every* width, wasting the whole screen on desktop with no structural change. So I rewrote **`AuthShell` only** — all four pages inherit the new adaptive layout with **zero logic change**, exactly the surgical pattern used for carpool.

**Before:** `AuthShell` = `grid min-h-screen place-items-center` → a single `max-w-sm` column (brand mark, title/subtitle, `.card` form, footer). Identical at all breakpoints.

**After — adaptive two-pane that changes structure by breakpoint:**
- **Compact/medium (<lg 1024):** unchanged single centered column — brand mark above the form card. Correct and familiar on phones/tablets.
- **lg+ (≥1024):** **two-pane split** (`lg:grid lg:grid-cols-2`). Left = a **branded hero pane** (`bg-bg-elevated`) stating what the app does; right = the form pane, vertically centered. Auth routes render **outside `AppLayout`** (confirmed in `App.jsx:29-33` — they're standalone `<Route>`s, no nav chrome), so using full window width is safe and collision-free.
- **Hero content is grounded in the real product** (frontend-design: don't fill with generic copy): the three actual pillars — *Fair charging queue* (Zap), *Carpool matching* (Car), *Track your impact* (Leaf) — each a tonal icon chip + one-line description, staggered in. Plus the brand lockup top-left and the "Charging guidelines by Taylor Frostholm" credit bottom-left (same note the desktop drawer carries).
- **Signature / one aesthetic risk (kept disciplined):** an ambient brand "aurora" — two soft tokenized radial glows (`rgb(var(--c-brand)/.22)` + `brand-strong/.16`) — behind the hero, plus a restrained vertical "charge bars" motif (six brand ticks of increasing width, staggered) shown only at `xl`. Everything else stays quiet; the form pane is deliberately plain.
- **Motion:** form pane `animate-fade-in`; hero pillars + charge-bars `animate-slide-up` with capped stagger + `[animation-fill-mode:backwards]`.

**Liquid-glass decision (explicit, per skill):** glass is **NOT** applied to the form card or the hero. Refraction belongs at a bounded surface's rim and would smear input text; the skill scopes glass to floating app chrome (nav/modals/toasts), not full-height content panes (also the hero exceeds the ~800px/side GPU guidance). The ambient wash is plain gradients/tokens with **no `backdrop-filter`** cost. Form stays a solid `.card` for maximum legibility.

**Breakpoint behaviors:** <lg single centered `max-w-sm` column (brand mark visible via `lg:hidden`); ≥lg two equal panes, hero `hidden lg:flex`, form centered in its half; charge-bars motif `hidden xl:flex`. Title top-margin adapts (`mt-4 lg:mt-0`) since the mark is hidden at lg+.

**Preserved exactly (every page, byte-identical logic):**
- **LoginPage:** `useZodForm(loginSchema, …)`, `authStore.login` → `res.ok` redirect to `location.state.from`, `rememberMe` checkbox, `RedirectIfAuthed` wrapper, forgot-password link.
- **RegisterPage:** `useZodForm(registerSchema, …)` with all 5 fields (displayName/email/password/confirmPassword/vehicleDescription), `authStore.register` → redirect `/`, `RedirectIfAuthed`.
- **ForgotPasswordPage:** `authApi.forgotPassword(email).catch(()=>{})` (no-enumeration mirror) + `sent` success state with `CheckCircle2`.
- **ResetPasswordPage:** `useSearchParams` token, missing-token branch, `authApi.resetPassword(token,password)` → toast + `/login`, `resetPasswordSchema`.
- The AuthShell API (`{title, subtitle, children, footer}`) is **unchanged**, so none of the four call sites needed edits — verified each still compiles against the same prop names.

**Verification (traced, no build):** `AuthShell` named export preserved (all four `import { AuthShell }` resolve); auth routes confirmed outside `AppLayout` so full-width layout can't clash with nav; every utility used exists — `shadow-elevation-1`/`shadow-glow` (config `boxShadow`), `text-headline-md`/`text-label-sm` (config `fontSize`), `bg-bg-elevated`/`bg-brand/15`/`text-brand-strong` (token colors), `animate-slide-up`/`animate-fade-in` (config `animation`); `Zap`/`Car`/`Leaf`/`CheckCircle2` are valid lucide-react icons; radial-gradient inline `style` is static (no token-interpolation-in-class issue, Tailwind JIT unaffected). `AsteraMark` follows theme via `--c-mark-*`. Not build-verified.

### Phase 7 — Admin console (`AdminPage`) ✅ (traced — looks correct)
**Contract re-verification first (per "read the server handler, don't guess"):** read `server/src/modules/admin/admin.service.js` end-to-end and cross-checked every call the page makes against `client/src/services/endpoints.js` and the service:
- `adminApi.overview()` → `{ activeSessions, queueWaiting, activeUsers, sessionsLast24h, carpoolOpenRides, carpoolCo2KgThisWeek }` — all six tiles read exactly these keys.
- `adminApi.listUsers(1, query)` → `{ items: [{id, email, displayName, role, active, carpoolCredits, createdAt}], total, page }` — camelCase, incl. `createdAt` (now surfaced in the table's "Joined" column; previously unused by the client).
- `adminApi.audit(1)` → `{ items: [{id, action, details, user_id, created_at}], total, page }` — **snake_case** rows (raw `audit_log`), so `a.created_at` / `a.details` / `a.action` are correct as written.
- `adminApi.getSettings()`/`updateSettings(patch)`, `listAnnouncements()` (raw records → `a.created_at`, `a.active`), `createAnnouncement`, `deleteAnnouncement`, `updateUser`, `createUser`, plus `chargerApi.list()` and `adminApi.{setChargerOnline,setChargerOffline,forceEndSession}` — all unchanged, all matched.

**Before:** `max-w-4xl` single column. Six-tab `Tabs` bar at every width. `OverviewTab` = flat 2/3-col tiles (bare icon + number). Every loading state a raw `<Spinner/>`. Users & Activity rendered as stacked cards / a `bg-bg-elevated` list at all widths — no dense tabular layout even on wide screens. No entry motion anywhere. Settings save was a plain right-aligned button.

**After — adaptive console that changes nav form factor by breakpoint (mirrors Settings/Dashboard):**
- **Nav:** segmented `Tabs` on compact/medium (`xl:hidden`) collapses to a **persistent section rail** at `xl` (`xl:grid xl:grid-cols-[248px_1fr]`, sticky, pill active `bg-brand/15 text-brand-strong`, `duration-medium ease-emphasized`). Gated at `xl` (not `expanded`) for the same 288px-drawer math used elsewhere. Detail panel re-keyed `key={section}` → `animate-fade-in` on switch. Container widened `max-w-4xl` → `max-w-6xl` to give the rail + tables room.
- **Overview:** tiles gain tonal icon chips (`bg-{brand,info,success,warning}/15` — token-only), larger `text-3xl` numerals, and per-tile `animate-slide-up` stagger. 6-tile skeleton replaces the spinner. Added `Car`/`Leaf` icons so carpool tiles read distinctly.
- **Dense data tables on `expanded` (the spec's explicit ask):** **Users** and **Activity** now render stacked cards on compact/medium (`expanded:hidden`) AND a real `<table>` on `expanded` (`hidden expanded:block`) — Users: User/Email/Credits(right, tabular-nums)/Joined/Actions; Activity: Action/Details(truncate)/When(right). Shared `TH`/`TD` cell classes, `bg-surface-2` header, `divide-y divide-border`, `hover:bg-surface-2` row affordance. Rows fade-in (no `<tr>` translateY — inconsistent cross-engine).
- **Chargers & Announcements:** deliberately **kept as card grids** — chargers carry live status badges + context actions, announcements carry long-form prose bodies; both read worse as dense rows. Chargers now use a `expanded:grid-cols-2` responsive grid + stagger. Every loading state is now a footprint-matched skeleton (overview 6×, chargers 4×, settings grouped, announcements 3×, users 4×, audit 6×).
- **Settings:** grouped cards stagger in; save moved into a **sticky bottom action bar** (`sticky bottom-0`, `bg-surface/85 backdrop-blur-sm`) with a live "unsaved changes / all changes saved" status. The toggle switch gained motion tokens + an `aria-label`. Save coercion logic byte-identical.

**Liquid-glass decision (explicit):** not applied to any base card/table. The one translucent surface is the Settings sticky action bar — floating chrome pinned to the viewport, which the skill sanctions; it uses a plain `backdrop-blur-sm` (no refraction map — it spans full content width, >800px, so refraction is correctly avoided).

**Accessibility:** section rail buttons carry `aria-current`; each dense table is a real semantic `<table>`/`<thead>`/`<tbody>`; the settings toggles are `role="switch"` + `aria-checked` + `aria-label`; the users search and every icon-only button (`Search`, `Trash2`) have `aria-label`s. Tonal chips + badges keep AA contrast (token pairs unchanged).

**Preserved exactly (byte-identical):** all `adminApi`/`chargerApi` calls; both `useRealtime` subscriptions (`admin-overview`, `admin-chargers`) with the same tables + `location_id` filter; `useConfirm` flows for force-end / offline / delete-announcement; `SETTING_GROUPS` + the save patch builder; `announcementSchema`/`adminCreateUserSchema` validation; all four modals (`OfflineModal`, `AnnouncementModal`, `CreateUserModal`) unchanged internally; `useApi(..., [query])` for user search (benefits from the completed race-guard fix). The `<RequireAdmin>` route guard + module manifest are untouched.

**Verification (traced, no build):** single route (`modules/admin/index.js` lazy-loads only this file; no admin sub-routes); `Card` spreads `...props` so `style`/`as="li"` pass through (confirmed in `Card.jsx`); `expanded:` variant backed by `tailwind.config.js` `screens.expanded=840px`; every utility exists (`bg-surface-2`, `divide-border`, `tabular-nums`, `duration-medium`, `ease-emphasized`, `animate-slide-up`/`fade-in`); all lucide icons imported (`Car`/`Leaf` added). `max-w-0 truncate` on the details cell is the standard flexless-truncation idiom for table cells. Not build-verified (no toolchain).

### Phase 8 — Feature-component verification sweep + build-integrity check ✅ (traced — looks correct)
**Goal:** with every *page* rebuilt (Phases 1–7), close the stopping condition's second half — confirm the feature components those pages compose are themselves at the rebuild bar and free of *confirmed* bugs, then verify the app still assembles cleanly (no dangling imports that would break a Vite build). No speculative changes — read-first, fix only what traces to a concrete defect.

**Components read and assessed at the bar (token colors only, correct MD3 shape/tonal roles, proper empty/loading/error states, `animate-slide-up`/`fade-in` motion, AA-safe pairings, lucide-only icons):**
- **Session:** `ChargerCard`, `ActiveSessionCard` (top accent bar, `useCountdown`, overtime emphasis, `animate-pulse-ring`), `StartSessionModal` (DurationSlider + schema-gated "connected" checkbox), `EndSessionModal` (four-step tonal-success checklist, `disabled` until all checked), `EtaModal`, `NudgeModal` (preset chips + 100-char custom), `EmergencyModal` (danger-toned warning surface + reason select), `EmergencyBanner` (danger card, piggybacks the notification stream to refetch — no extra timer).
- **Queue:** `QueuePanel` (ordered list, own-entry `ring-brand/40` highlight, `MyTurnBanner` countdown with status-tinted borders + claim/leave).
- **Dashboard/notifications:** `NudgeInboxWidget` (reads polled store, compacts to 1 row when push is subscribed), `NudgeReactionButtons` (optimistic thumbs, reverts on error, `stopPropagation` so it works inside the clickable notification row), `NotificationsPage` (already Phase-verified — filter chips, push-toggle card, skeletons, staggered rows).
- **Onboarding:** `OnboardingGate` (driven purely by `user.onboardedAt`, optimistic finish fallback), `OnboardingFlow` (portal full-screen walkthrough, five real-product steps, progress dots).

**One confirmed spec gap fixed (`OnboardingFlow.jsx`):**
- **Failure scenario:** the icon/title/body block carries `animate-slide-up` but had **stable element identity across steps** (no `key`). React reuses the same DOM nodes on Next/Back, so the CSS entrance animation fires **once on mount only** — every subsequent step silently swapped text with zero motion, contradicting the rebuild's expressive-motion mandate that the classes already declare an intent for.
- **Fix (minimal, traceable):** wrapped the content block with `key={step}` so React remounts it per step, replaying the animation on every advance; added `[animation-fill-mode:backwards]` + a light icon→title→body stagger (0/60/120ms) to match the app's established ENTER rhythm. No logic, copy, or navigation change. Traced: `step` state already drives the render; re-keying a presentational subtree is side-effect-free.

**Build-integrity check (deployability mandate):**
- `grep` across `client/src` for `ProfilePage` / `supabase` / `config/supabase`: `ProfilePage.jsx` matches **only its own `export`** — no live import anywhere; `supabase` appears in **zero** source files. Both previously-flagged dead files (`pages/ProfilePage.jsx`, `config/supabase.js`) are inert: Vite tree-shakes unreferenced modules, so neither is bundled and neither can break the build. (They remain on disk — deletion is barred by the hard boundary; flagged for the user to remove.)
- `App.jsx` routing re-read: public auth routes + registry-driven authenticated shell (`allRoutes` from `modules/registry.js`) + `/404` + catch-all redirect. Admin routes wrapped in `<RequireAdmin>` via the `roles` manifest field. Clean, no orphaned route targets.

**Verification (traced, no build/toolchain this environment):** every component's imports resolve to files confirmed to exist this session; the single edit uses only existing utilities (`animate-slide-up`, `[animation-fill-mode:backwards]`, inline `animationDelay` style — no Tailwind-JIT class interpolation). Not build-verified.

---

## Overnight run — summary
Every application page is rebuilt to MD3 spec with adaptive layouts whose **nav form factor changes by breakpoint** (bottom nav → rail → drawer; segmented tabs → section rail on Settings/Admin), real light/dark theming via `data-theme` tokens (zero hardcoded colors, zero `dark:` variants), expressive motion, footprint-matched skeletons, and full empty/error states. Liquid-glass is scoped to floating chrome only (nav, modals, toasts, the one sticky settings bar), never to content panes or >800px surfaces. Every feature component has been read and confirmed at the bar. The fixed server API contract was never touched — every client call was cross-checked against the actual `server/` handlers. Confirmed bugs fixed with traced failure scenarios; no speculative defensive code added. **Status: traced — looks correct throughout; NOT build-verified** (no shell/toolchain in this environment — the user must run `npm install && npm run build` / `lint` to confirm).

**Flagged for the user (outside my hard boundary — I did not perform these):**
- Server one-liner still pending: add `priority: payload.priority,` to the `send()` body in `server/src/providers/notifications/push.channel.js` (server/ is off-limits to me).
- Run `manual_drop_parking_spot.sql` against Prisma Postgres.
- Delete dead files `client/src/config/supabase.js` and `client/src/pages/ProfilePage.jsx` (deletion barred for me; confirmed unreferenced so safe to remove).
- `git add/commit/push` and investigate why Vercel didn't auto-deploy.

<!-- Appended continuously below as each phase/page/fix lands. -->
