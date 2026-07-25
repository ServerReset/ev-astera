/**
 * Shared constants used by BOTH the server and the client.
 * Keep this framework-free (no imports) so it can be consumed from Node and Vite alike.
 */

// ── Roles ────────────────────────────────────────────────────────────────────
// SITE_ADMIN manages exactly their own office (chargers/carpool/settings/users/announcements —
// everything the old single ADMIN role did). SUPER_ADMIN additionally manages the office list
// itself and can view/act on any office (see server/src/middleware/locationScope.js's bypass).
export const ROLES = Object.freeze({ USER: 'user', SITE_ADMIN: 'site_admin', SUPER_ADMIN: 'super_admin' });
export const ADMIN_ROLES = Object.freeze([ROLES.SITE_ADMIN, ROLES.SUPER_ADMIN]);

// ── Charger / session status ──────────────────────────────────────────────────
export const CHARGER_STATUS = Object.freeze({
  AVAILABLE: 'available',
  IN_USE: 'in_use',
  OVERTIME: 'overtime',
  OFFLINE: 'offline',
});

export const SESSION_STATUS = Object.freeze({
  ACTIVE: 'active',
  OVERTIME: 'overtime',
  COMPLETED: 'completed',
  FORCE_ENDED: 'force_ended',
});

// ── Queue ──────────────────────────────────────────────────────────────────────
export const QUEUE_STATUS = Object.freeze({
  WAITING: 'waiting',
  NOTIFIED: 'notified',   // it's their turn, grace period running
  CLAIMED: 'claimed',     // claimed, claim window running to actually start
  FULFILLED: 'fulfilled',
  SKIPPED: 'skipped',
  CANCELLED: 'cancelled',
});

export const QUEUE_TARGET_ANY = 'any';

// ── Notifications ────────────────────────────────────────────────────────────
export const NOTIFICATION_TYPES = Object.freeze({
  QUEUE_TURN: 'queue_turn',
  QUEUE_SKIPPED: 'queue_skipped',
  SESSION_OVERTIME: 'session_overtime',
  SESSION_ENDING: 'session_ending',
  NUDGE: 'nudge',
  NUDGE_REACTION: 'nudge_reaction',
  EMERGENCY: 'emergency',
  ANNOUNCEMENT: 'announcement',
  ADMIN_ALERT: 'admin_alert',
  CARPOOL_BOOKING: 'carpool_booking',
  CARPOOL_MATCH: 'carpool_match',
  CARPOOL_REMINDER: 'carpool_reminder',
  CARPOOL_CREDITS: 'carpool_credits',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  SYSTEM: 'system',
});

export const NOTIFICATION_PRIORITY = Object.freeze({
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
});

// ── Carpool ──────────────────────────────────────────────────────────────────
export const CARPOOL_DIRECTION = Object.freeze({
  TO_SITE: 'to_site',
  FROM_SITE: 'from_site',
});

export const RIDE_STATUS = Object.freeze({
  OPEN: 'open',
  FULL: 'full',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const BOOKING_STATUS = Object.freeze({
  REQUESTED: 'requested',
  CONFIRMED: 'confirmed',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
});

export const RIDE_REQUEST_STATUS = Object.freeze({
  OPEN: 'open',
  MATCHED: 'matched',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
});

export const CARPOOL_ROLE = Object.freeze({ DRIVER: 'driver', RIDER: 'rider' });

export const CREDIT_KIND = Object.freeze({ EARN: 'earn', SPEND: 'spend', ADJUST: 'adjust' });

// ── Business-rule setting keys (defaults live in the DB settings table) ────────
export const SETTING_KEYS = Object.freeze({
  MAX_SESSION_HOURS: 'max_session_hours',
  MAX_WEEKLY_SESSIONS: 'max_weekly_sessions',
  GRACE_PERIOD_MINUTES: 'grace_period_minutes',
  CLAIM_WINDOW_MINUTES: 'claim_window_minutes',
  OVERTIME_FIRST_NUDGE_MINUTES: 'overtime_first_nudge_minutes',
  OVERTIME_USER_NUDGE_UNLOCK_MINUTES: 'overtime_user_nudge_unlock_minutes',
  OVERTIME_CUSTOM_MESSAGE_UNLOCK_MINUTES: 'overtime_custom_message_unlock_minutes',
  OVERTIME_ADMIN_ALERT_MINUTES: 'overtime_admin_alert_minutes',
  NUDGE_RATE_LIMIT_MINUTES: 'nudge_rate_limit_minutes',
  MAX_NUDGES_PER_SESSION: 'max_nudges_per_session',
  EMERGENCY_COOLDOWN_HOURS: 'emergency_cooldown_hours',
  EMERGENCY_RESPONSE_WINDOW_MINUTES: 'emergency_response_window_minutes',
  DAILY_RESET_HOUR: 'daily_reset_hour',
  WEEKLY_RESET_DAY: 'weekly_reset_day',
  // carpool
  CARPOOL_ENABLED: 'carpool_enabled',
  CARPOOL_MIN_LEAD_MINUTES: 'carpool_min_lead_minutes',
  CARPOOL_DEFAULT_TRIP_MILES: 'carpool_default_trip_miles',
  CARPOOL_MIN_MATCH_SCORE: 'carpool_min_match_score',
  CARPOOL_MATERIALIZE_DAYS: 'carpool_materialize_days',
  CARPOOL_REMINDER_LEAD_MINUTES: 'carpool_reminder_lead_minutes',
  CARPOOL_PRIORITY_ENABLED: 'carpool_priority_enabled',
  CARPOOL_PRIORITY_WEIGHT: 'carpool_priority_weight',
  CARPOOL_CO2_GRAMS_PER_MILE: 'carpool_co2_grams_per_mile',
  CARPOOL_CREDIT_PER_TRIP: 'carpool_credit_per_trip',
  CARPOOL_CREDIT_PER_RIDER: 'carpool_credit_per_rider',
  CARPOOL_HQ_ADDRESS: 'carpool_hq_address',
  // registration gating
  SIGNUP_RELEASE_AT: 'signup_release_at',
  SIGNUP_GEOFENCE_ENABLED: 'signup_geofence_enabled',
  SIGNUP_GEOFENCE_RADIUS_METERS: 'signup_geofence_radius_meters',
  // queue
  QUEUE_MAX_AUTO_REQUEUES: 'queue_max_auto_requeues',
  // reliability score
  RELIABILITY_ENABLED: 'reliability_enabled',
  RELIABILITY_BASELINE: 'reliability_baseline',
  RELIABILITY_OVERTIME_GRACE_MINUTES: 'reliability_overtime_grace_minutes',
  RELIABILITY_OVERTIME_PENALTY_PER_MINUTE: 'reliability_overtime_penalty_per_minute',
  RELIABILITY_OVERTIME_ESCALATION_FACTOR: 'reliability_overtime_escalation_factor',
  RELIABILITY_FAST_UNPLUG_BONUS: 'reliability_fast_unplug_bonus',
  RELIABILITY_CARPOOL_DRIVER_BONUS: 'reliability_carpool_driver_bonus',
  RELIABILITY_DECAY_PER_DAY: 'reliability_decay_per_day',
  RELIABILITY_LOCKOUT_THRESHOLD: 'reliability_lockout_threshold',
  RELIABILITY_LOCKOUT_DURATION_HOURS: 'reliability_lockout_duration_hours',
  RELIABILITY_QUEUE_WEIGHT: 'reliability_queue_weight',
  // content lists (admin-editable, jsonb array-of-strings)
  NUDGE_PRESETS: 'nudge_presets',
  EMERGENCY_REASONS: 'emergency_reasons',
});

// ── Notification templates (admin-editable per office) ──────────────────────────
// Single source of truth for every user-facing notification's default copy and which runtime
// {{placeholder}} variables it supports. Adding a new admin-editable notification means adding
// one entry HERE — nothing else needs to change: notifTplSettingKey() derives its settings-table
// keys, SETTING_DEFAULTS below picks up its defaults automatically, and the admin UI
// (AdminPage.jsx's NOTIFICATION_TEMPLATES.filter(...)) picks it up by `group`. Every listener
// renders through server/src/utils/notifTemplates.js's getNotificationCopy() instead of a
// hardcoded literal. Announcement notifications are excluded — their title/body ARE the admin's
// own per-announcement content already, not app-level copy.
export const NOTIFICATION_TEMPLATES = Object.freeze([
  { key: 'queue_turn', group: 'chargers', label: "It's your turn (queue)", vars: ['chargerName'], defaultTitle: "⚡ It's your turn!", defaultBody: '{{chargerName}} is free. Claim your spot before it expires.' },
  { key: 'queue_skipped', group: 'chargers', label: 'Missed your queue turn', vars: [], defaultTitle: 'You missed your spot', defaultBody: "You didn't claim in time and were moved to the back of the queue." },
  { key: 'session_overtime', group: 'chargers', label: 'Your session is overtime', vars: ['chargerName'], defaultTitle: '⚠️ Charging session overtime', defaultBody: 'Your session on {{chargerName}} has passed its ETA. Please wrap up when you can.' },
  { key: 'overtime_admin_alert', group: 'chargers', label: 'Overtime admin alert', vars: ['chargerName', 'minutesOver'], defaultTitle: 'Overtime needs attention', defaultBody: '{{chargerName}} is {{minutesOver}} min past ETA.' },
  { key: 'nudge_received', group: 'chargers', label: 'Nudge received', vars: ['message'], defaultTitle: '👋 You got a nudge!', defaultBody: '{{message}}' },
  { key: 'nudge_reaction_up', group: 'chargers', label: 'Nudge reaction: thumbs up', vars: [], defaultTitle: '👍 Your nudge got a thumbs up', defaultBody: 'They acknowledged your nudge.' },
  { key: 'nudge_reaction_down', group: 'chargers', label: 'Nudge reaction: thumbs down', vars: [], defaultTitle: '👎 Your nudge got a thumbs down', defaultBody: "They didn't want to move yet." },
  { key: 'nudge_reaction_pray', group: 'chargers', label: 'Nudge reaction: almost done', vars: [], defaultTitle: '🙏 Almost done charging', defaultBody: "They're wrapping up — hang tight." },
  { key: 'nudge_reaction_run', group: 'chargers', label: 'Nudge reaction: on my way', vars: [], defaultTitle: '🏃 On the way', defaultBody: "They're heading to move their car now." },
  { key: 'nudge_reaction_eyes', group: 'chargers', label: 'Nudge reaction: seen it', vars: [], defaultTitle: '👀 Nudge seen', defaultBody: 'They saw your nudge — give them a moment.' },
  { key: 'emergency_requested', group: 'chargers', label: 'Emergency request (to chargers in use)', vars: ['from', 'reason'], defaultTitle: '🚨 Emergency charge request', defaultBody: '{{from}}: {{reason}}. Can you wrap up your session?' },
  { key: 'emergency_responded_accept', group: 'chargers', label: 'Emergency response: accepted', vars: ['from'], defaultTitle: '✅ Someone is freeing a charger', defaultBody: '{{from}} is wrapping up for you.' },
  { key: 'emergency_responded_decline', group: 'chargers', label: 'Emergency response: declined', vars: ['from'], defaultTitle: 'Emergency update', defaultBody: "{{from}} can't help right now." },
  { key: 'carpool_booking_requested', group: 'carpool', label: 'New seat request', vars: ['rider'], defaultTitle: '🚗 New seat request', defaultBody: '{{rider}} requested a seat on your ride.' },
  { key: 'carpool_booking_confirmed', group: 'carpool', label: 'Ride confirmed', vars: [], defaultTitle: '✅ Ride confirmed', defaultBody: 'Your carpool seat is confirmed. See you there!' },
  { key: 'carpool_booking_declined', group: 'carpool', label: 'Ride request declined', vars: [], defaultTitle: 'Ride request declined', defaultBody: 'The driver could not take you this time. Try another ride.' },
  { key: 'carpool_ride_cancelled', group: 'carpool', label: 'Ride cancelled', vars: [], defaultTitle: '⚠️ Carpool cancelled', defaultBody: 'A ride you booked was cancelled by the driver.' },
  { key: 'carpool_match_found_rider', group: 'carpool', label: 'Match found (to rider)', vars: ['departTime'], defaultTitle: '🔎 Carpool match found', defaultBody: 'A ride departing {{departTime}} matches your request.' },
  { key: 'carpool_match_found_driver', group: 'carpool', label: 'Match found (to driver)', vars: [], defaultTitle: '🔎 A rider matches your ride', defaultBody: 'Someone nearby is looking for a ride like yours.' },
  { key: 'carpool_credits_awarded', group: 'carpool', label: 'Credits awarded', vars: ['amount', 'reason', 'balanceAfter'], defaultTitle: '🌱 +{{amount}} carpool credits', defaultBody: '{{reason}}. Balance: {{balanceAfter}}.' },
]);

/** Settings-table key for one template's title or body — the ONLY place this naming scheme is
 * defined, so it can't drift between the listener that reads it and the admin UI that writes it. */
export function notifTplSettingKey(templateKey, field) {
  return `notif_tpl_${templateKey}_${field}`;
}

// Server-authoritative numeric bounds for settings. Enforced in config.service.update() so an
// admin can't persist a value that bricks a core flow (e.g. max_session_hours=0 makes every start
// impossible; max_weekly_sessions=0 treats everyone as over-cap). The client SettingsEditor also
// carries `min` hints for UX, but those are bypassable via the API — this map is the real floor.
// { min?, max? } per key; keys absent here are unbounded (booleans, strings, arrays, free counts).
export const SETTING_BOUNDS = Object.freeze({
  [SETTING_KEYS.MAX_SESSION_HOURS]: { min: 0.5, max: 24 },
  [SETTING_KEYS.MAX_WEEKLY_SESSIONS]: { min: 1, max: 100 },
  [SETTING_KEYS.GRACE_PERIOD_MINUTES]: { min: 1, max: 120 },
  [SETTING_KEYS.CLAIM_WINDOW_MINUTES]: { min: 1, max: 120 },
  [SETTING_KEYS.NUDGE_RATE_LIMIT_MINUTES]: { min: 0, max: 120 },
  [SETTING_KEYS.MAX_NUDGES_PER_SESSION]: { min: 1, max: 50 },
  [SETTING_KEYS.EMERGENCY_COOLDOWN_HOURS]: { min: 0, max: 168 },
  [SETTING_KEYS.EMERGENCY_RESPONSE_WINDOW_MINUTES]: { min: 1, max: 240 },
  [SETTING_KEYS.OVERTIME_FIRST_NUDGE_MINUTES]: { min: 0, max: 240 },
  [SETTING_KEYS.OVERTIME_ADMIN_ALERT_MINUTES]: { min: 1, max: 600 },
  [SETTING_KEYS.DAILY_RESET_HOUR]: { min: 0, max: 23 },
  [SETTING_KEYS.WEEKLY_RESET_DAY]: { min: 0, max: 6 },
  [SETTING_KEYS.QUEUE_MAX_AUTO_REQUEUES]: { min: 0, max: 10 },
  [SETTING_KEYS.CARPOOL_MIN_LEAD_MINUTES]: { min: 0, max: 1440 },
  [SETTING_KEYS.CARPOOL_DEFAULT_TRIP_MILES]: { min: 0, max: 500 },
  [SETTING_KEYS.CARPOOL_MIN_MATCH_SCORE]: { min: 0, max: 100 },
  [SETTING_KEYS.CARPOOL_MATERIALIZE_DAYS]: { min: 1, max: 30 },
  [SETTING_KEYS.CARPOOL_REMINDER_LEAD_MINUTES]: { min: 0, max: 1440 },
  [SETTING_KEYS.CARPOOL_PRIORITY_WEIGHT]: { min: 0, max: 1000 },
  [SETTING_KEYS.CARPOOL_CO2_GRAMS_PER_MILE]: { min: 0, max: 2000 },
  [SETTING_KEYS.CARPOOL_CREDIT_PER_TRIP]: { min: 0, max: 1000 },
  [SETTING_KEYS.CARPOOL_CREDIT_PER_RIDER]: { min: 0, max: 1000 },
  [SETTING_KEYS.SIGNUP_GEOFENCE_RADIUS_METERS]: { min: 10, max: 100000 },
  [SETTING_KEYS.RELIABILITY_BASELINE]: { min: 0, max: 200 },
  [SETTING_KEYS.RELIABILITY_LOCKOUT_THRESHOLD]: { min: 0, max: 200 },
  [SETTING_KEYS.RELIABILITY_LOCKOUT_DURATION_HOURS]: { min: 0, max: 720 },
  [SETTING_KEYS.RELIABILITY_DECAY_PER_DAY]: { min: 0, max: 100 },
  [SETTING_KEYS.RELIABILITY_QUEUE_WEIGHT]: { min: 0, max: 10 },
});

// Fallback defaults used if a setting row is somehow missing. The DB seed is authoritative.
export const SETTING_DEFAULTS = Object.freeze({
  [SETTING_KEYS.MAX_SESSION_HOURS]: 4,
  [SETTING_KEYS.MAX_WEEKLY_SESSIONS]: 2,
  [SETTING_KEYS.GRACE_PERIOD_MINUTES]: 15,
  [SETTING_KEYS.CLAIM_WINDOW_MINUTES]: 10,
  [SETTING_KEYS.OVERTIME_FIRST_NUDGE_MINUTES]: 5,
  [SETTING_KEYS.OVERTIME_USER_NUDGE_UNLOCK_MINUTES]: 10,
  [SETTING_KEYS.OVERTIME_CUSTOM_MESSAGE_UNLOCK_MINUTES]: 15,
  [SETTING_KEYS.OVERTIME_ADMIN_ALERT_MINUTES]: 30,
  [SETTING_KEYS.NUDGE_RATE_LIMIT_MINUTES]: 5,
  [SETTING_KEYS.MAX_NUDGES_PER_SESSION]: 5,
  [SETTING_KEYS.EMERGENCY_COOLDOWN_HOURS]: 24,
  [SETTING_KEYS.EMERGENCY_RESPONSE_WINDOW_MINUTES]: 10,
  [SETTING_KEYS.DAILY_RESET_HOUR]: 0,
  [SETTING_KEYS.WEEKLY_RESET_DAY]: 1,
  [SETTING_KEYS.CARPOOL_ENABLED]: true,
  [SETTING_KEYS.CARPOOL_MIN_LEAD_MINUTES]: 30,
  [SETTING_KEYS.CARPOOL_DEFAULT_TRIP_MILES]: 12,
  [SETTING_KEYS.CARPOOL_MIN_MATCH_SCORE]: 55,
  [SETTING_KEYS.CARPOOL_MATERIALIZE_DAYS]: 2,
  [SETTING_KEYS.CARPOOL_REMINDER_LEAD_MINUTES]: 30,
  [SETTING_KEYS.CARPOOL_PRIORITY_ENABLED]: true,
  [SETTING_KEYS.CARPOOL_PRIORITY_WEIGHT]: 100,
  [SETTING_KEYS.CARPOOL_CO2_GRAMS_PER_MILE]: 400,
  [SETTING_KEYS.CARPOOL_CREDIT_PER_TRIP]: 10,
  [SETTING_KEYS.CARPOOL_CREDIT_PER_RIDER]: 5,
  [SETTING_KEYS.CARPOOL_HQ_ADDRESS]: '',
  [SETTING_KEYS.SIGNUP_RELEASE_AT]: '',
  // Off by default: anyone with an @asteralabs.com email can register from anywhere (home,
  // remote, a desktop that can't do geolocation). An admin can turn the on-site geofence back ON
  // per office in settings if they want to require physical presence to sign up.
  [SETTING_KEYS.SIGNUP_GEOFENCE_ENABLED]: false,
  [SETTING_KEYS.SIGNUP_GEOFENCE_RADIUS_METERS]: 500,
  [SETTING_KEYS.QUEUE_MAX_AUTO_REQUEUES]: 2,
  [SETTING_KEYS.RELIABILITY_ENABLED]: true,
  [SETTING_KEYS.RELIABILITY_BASELINE]: 100,
  [SETTING_KEYS.RELIABILITY_OVERTIME_GRACE_MINUTES]: 5,
  [SETTING_KEYS.RELIABILITY_OVERTIME_PENALTY_PER_MINUTE]: 1.5,
  [SETTING_KEYS.RELIABILITY_OVERTIME_ESCALATION_FACTOR]: 1.08,
  [SETTING_KEYS.RELIABILITY_FAST_UNPLUG_BONUS]: 3,
  [SETTING_KEYS.RELIABILITY_CARPOOL_DRIVER_BONUS]: 2,
  [SETTING_KEYS.RELIABILITY_DECAY_PER_DAY]: 1,
  [SETTING_KEYS.RELIABILITY_LOCKOUT_THRESHOLD]: 40,
  [SETTING_KEYS.RELIABILITY_LOCKOUT_DURATION_HOURS]: 48,
  [SETTING_KEYS.RELIABILITY_QUEUE_WEIGHT]: 0.3,
  // Admin-editable content lists — fall back to these defaults when no settings row exists
  // (same "empty settings table == defaults" behavior as every other setting). Fetched at
  // runtime via message.service.js's getConfig(), not imported directly by client components —
  // see NudgeModal.jsx/EmergencyModal.jsx, which no longer import a static array.
  [SETTING_KEYS.NUDGE_PRESETS]: [
    'Hey! Are you almost done charging? 🙏',
    "I'm next in queue — just checking in!",
    "No rush, just confirming you're still there.",
    'I need to charge before I leave today.',
  ],
  [SETTING_KEYS.EMERGENCY_REASONS]: ['Very low battery', 'Need vehicle for emergency', 'Other'],
  // Every notification template's title/body default, derived from NOTIFICATION_TEMPLATES so
  // there's exactly one place that lists each template's copy — adding a template above makes
  // its defaults show up here automatically, no second edit needed.
  ...NOTIFICATION_TEMPLATES.reduce((acc, t) => {
    acc[notifTplSettingKey(t.key, 'title')] = t.defaultTitle;
    acc[notifTplSettingKey(t.key, 'body')] = t.defaultBody;
    return acc;
  }, {}),
});

// ── Misc ───────────────────────────────────────────────────────────────────────
export const TIMEZONE = 'America/Los_Angeles';
export const WORK_HOURS = Object.freeze({ START: 8, END: 18 }); // 8 AM – 6 PM
export const PAGE_SIZE = 20;
