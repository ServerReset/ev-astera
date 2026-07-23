/**
 * Shared constants used by BOTH the server and the client.
 * Keep this framework-free (no imports) so it can be consumed from Node and Vite alike.
 */

// ── Roles ────────────────────────────────────────────────────────────────────
export const ROLES = Object.freeze({ USER: 'user', ADMIN: 'admin' });

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

// ── Reservations ─────────────────────────────────────────────────────────────
export const RESERVATION_STATUS = Object.freeze({
  UPCOMING: 'upcoming',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

// ── Notifications ────────────────────────────────────────────────────────────
export const NOTIFICATION_TYPES = Object.freeze({
  QUEUE_TURN: 'queue_turn',
  QUEUE_SKIPPED: 'queue_skipped',
  SESSION_OVERTIME: 'session_overtime',
  SESSION_ENDING: 'session_ending',
  RESERVATION_STARTING: 'reservation_starting',
  RESERVATION_WARNING: 'reservation_warning',
  NUDGE: 'nudge',
  EMERGENCY: 'emergency',
  ANNOUNCEMENT: 'announcement',
  ADMIN_ALERT: 'admin_alert',
  CARPOOL_BOOKING: 'carpool_booking',
  CARPOOL_MATCH: 'carpool_match',
  CARPOOL_REMINDER: 'carpool_reminder',
  CARPOOL_CREDITS: 'carpool_credits',
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
  RESERVATION_BUFFER_MINUTES: 'reservation_buffer_minutes',
  RESERVATION_MIN_ADVANCE_MINUTES: 'reservation_min_advance_minutes',
  DAILY_RESET_HOUR: 'daily_reset_hour',
  WEEKLY_RESET_DAY: 'weekly_reset_day',
  // carpool
  CARPOOL_ENABLED: 'carpool_enabled',
  CARPOOL_MIN_LEAD_MINUTES: 'carpool_min_lead_minutes',
  CARPOOL_MAX_DETOUR_MILES: 'carpool_max_detour_miles',
  CARPOOL_MIN_MATCH_SCORE: 'carpool_min_match_score',
  CARPOOL_MATERIALIZE_DAYS: 'carpool_materialize_days',
  CARPOOL_REMINDER_LEAD_MINUTES: 'carpool_reminder_lead_minutes',
  CARPOOL_PRIORITY_ENABLED: 'carpool_priority_enabled',
  CARPOOL_PRIORITY_WEIGHT: 'carpool_priority_weight',
  CARPOOL_CO2_GRAMS_PER_MILE: 'carpool_co2_grams_per_mile',
  CARPOOL_CREDIT_PER_TRIP: 'carpool_credit_per_trip',
  CARPOOL_CREDIT_PER_RIDER: 'carpool_credit_per_rider',
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
  [SETTING_KEYS.RESERVATION_BUFFER_MINUTES]: 15,
  [SETTING_KEYS.RESERVATION_MIN_ADVANCE_MINUTES]: 30,
  [SETTING_KEYS.DAILY_RESET_HOUR]: 0,
  [SETTING_KEYS.WEEKLY_RESET_DAY]: 1,
  [SETTING_KEYS.CARPOOL_ENABLED]: true,
  [SETTING_KEYS.CARPOOL_MIN_LEAD_MINUTES]: 30,
  [SETTING_KEYS.CARPOOL_MAX_DETOUR_MILES]: 8,
  [SETTING_KEYS.CARPOOL_MIN_MATCH_SCORE]: 55,
  [SETTING_KEYS.CARPOOL_MATERIALIZE_DAYS]: 2,
  [SETTING_KEYS.CARPOOL_REMINDER_LEAD_MINUTES]: 30,
  [SETTING_KEYS.CARPOOL_PRIORITY_ENABLED]: true,
  [SETTING_KEYS.CARPOOL_PRIORITY_WEIGHT]: 100,
  [SETTING_KEYS.CARPOOL_CO2_GRAMS_PER_MILE]: 400,
  [SETTING_KEYS.CARPOOL_CREDIT_PER_TRIP]: 10,
  [SETTING_KEYS.CARPOOL_CREDIT_PER_RIDER]: 5,
});

// ── Misc ───────────────────────────────────────────────────────────────────────
export const TIMEZONE = 'America/Los_Angeles';
export const WORK_HOURS = Object.freeze({ START: 8, END: 18 }); // 8 AM – 6 PM
export const PAGE_SIZE = 20;
export const DURATION_PRESETS_HOURS = [1, 2, 3, 4];
export const NUDGE_PRESETS = Object.freeze([
  'Hey! Are you almost done charging? 🙏',
  "I'm next in queue — just checking in!",
  "No rush, just confirming you're still there.",
  'I need to charge before I leave today.',
]);
export const EMERGENCY_REASONS = Object.freeze(['Very low battery', 'Need vehicle for emergency', 'Other']);
