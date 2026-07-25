/**
 * Field definitions for the admin Settings editor, grouped into sections. Each field references a
 * SETTING_KEYS key; numeric fields pull min/max hints from SETTING_BOUNDS. This is presentation
 * metadata only — the server (config.service.assertWithinBounds) is the real floor.
 */
import { SETTING_KEYS } from '@shared/constants.js';

// field kinds: 'number' | 'bool' | 'text' | 'list'
export const SETTINGS_SECTIONS = [
  {
    key: 'chargers',
    title: 'Chargers & Queue',
    description: 'Session limits, the queue grace/claim windows, and overtime escalation.',
    fields: [
      { key: SETTING_KEYS.MAX_SESSION_HOURS, label: 'Max session length', kind: 'number', unit: 'hours', step: 0.5 },
      { key: SETTING_KEYS.MAX_WEEKLY_SESSIONS, label: 'Max sessions per week', kind: 'number' },
      { key: SETTING_KEYS.GRACE_PERIOD_MINUTES, label: 'Queue grace period', kind: 'number', unit: 'min' },
      { key: SETTING_KEYS.CLAIM_WINDOW_MINUTES, label: 'Claim window', kind: 'number', unit: 'min' },
      { key: SETTING_KEYS.QUEUE_MAX_AUTO_REQUEUES, label: 'Max auto re-queues', kind: 'number' },
      { key: SETTING_KEYS.OVERTIME_FIRST_NUDGE_MINUTES, label: 'First overtime nudge after', kind: 'number', unit: 'min' },
      { key: SETTING_KEYS.OVERTIME_USER_NUDGE_UNLOCK_MINUTES, label: 'Members can nudge after', kind: 'number', unit: 'min' },
      { key: SETTING_KEYS.OVERTIME_CUSTOM_MESSAGE_UNLOCK_MINUTES, label: 'Custom nudge message after', kind: 'number', unit: 'min' },
      { key: SETTING_KEYS.OVERTIME_ADMIN_ALERT_MINUTES, label: 'Alert admins after', kind: 'number', unit: 'min' },
      { key: SETTING_KEYS.NUDGE_RATE_LIMIT_MINUTES, label: 'Min minutes between nudges', kind: 'number', unit: 'min' },
      { key: SETTING_KEYS.MAX_NUDGES_PER_SESSION, label: 'Max nudges per session', kind: 'number' },
      { key: SETTING_KEYS.EMERGENCY_COOLDOWN_HOURS, label: 'Emergency request cooldown', kind: 'number', unit: 'hours' },
      { key: SETTING_KEYS.EMERGENCY_RESPONSE_WINDOW_MINUTES, label: 'Emergency response window', kind: 'number', unit: 'min' },
      { key: SETTING_KEYS.DAILY_RESET_HOUR, label: 'Daily reset hour (0–23)', kind: 'number' },
      { key: SETTING_KEYS.WEEKLY_RESET_DAY, label: 'Weekly reset day (0=Sun)', kind: 'number' },
      { key: SETTING_KEYS.NUDGE_PRESETS, label: 'Nudge preset messages', kind: 'list', hint: 'Quick-tap messages members can send when nudging.' },
      { key: SETTING_KEYS.EMERGENCY_REASONS, label: 'Emergency reasons', kind: 'list', hint: 'Selectable reasons on the emergency request form.' },
    ],
  },
  {
    key: 'carpool',
    title: 'Carpool',
    description: 'Matching, credits, CO₂ accounting, and scheduling lead times.',
    fields: [
      { key: SETTING_KEYS.CARPOOL_ENABLED, label: 'Carpool enabled', kind: 'bool' },
      { key: SETTING_KEYS.CARPOOL_MIN_LEAD_MINUTES, label: 'Minimum posting lead time', kind: 'number', unit: 'min' },
      { key: SETTING_KEYS.CARPOOL_DEFAULT_TRIP_MILES, label: 'Default trip distance', kind: 'number', unit: 'miles' },
      { key: SETTING_KEYS.CARPOOL_MIN_MATCH_SCORE, label: 'Minimum match score', kind: 'number' },
      { key: SETTING_KEYS.CARPOOL_MATERIALIZE_DAYS, label: 'Materialize schedules ahead', kind: 'number', unit: 'days' },
      { key: SETTING_KEYS.CARPOOL_REMINDER_LEAD_MINUTES, label: 'Ride reminder lead time', kind: 'number', unit: 'min' },
      { key: SETTING_KEYS.CARPOOL_PRIORITY_ENABLED, label: 'Charger priority for carpoolers', kind: 'bool' },
      { key: SETTING_KEYS.CARPOOL_PRIORITY_WEIGHT, label: 'Priority weight', kind: 'number' },
      { key: SETTING_KEYS.CARPOOL_CO2_GRAMS_PER_MILE, label: 'CO₂ per mile', kind: 'number', unit: 'g' },
      { key: SETTING_KEYS.CARPOOL_CREDIT_PER_TRIP, label: 'Credits per trip', kind: 'number' },
      { key: SETTING_KEYS.CARPOOL_CREDIT_PER_RIDER, label: 'Credits per rider', kind: 'number' },
      { key: SETTING_KEYS.CARPOOL_HQ_ADDRESS, label: 'HQ / site address', kind: 'text', hint: 'Used as the shared destination for matching.' },
    ],
  },
  {
    key: 'reliability',
    title: 'Reliability',
    description: 'The reliability score model: penalties, bonuses, decay, and lockout.',
    fields: [
      { key: SETTING_KEYS.RELIABILITY_ENABLED, label: 'Reliability scoring enabled', kind: 'bool' },
      { key: SETTING_KEYS.RELIABILITY_BASELINE, label: 'Baseline score', kind: 'number' },
      { key: SETTING_KEYS.RELIABILITY_OVERTIME_GRACE_MINUTES, label: 'Overtime grace before penalty', kind: 'number', unit: 'min' },
      { key: SETTING_KEYS.RELIABILITY_OVERTIME_PENALTY_PER_MINUTE, label: 'Penalty per overtime minute', kind: 'number', step: 0.1 },
      { key: SETTING_KEYS.RELIABILITY_OVERTIME_ESCALATION_FACTOR, label: 'Overtime escalation factor', kind: 'number', step: 0.01 },
      { key: SETTING_KEYS.RELIABILITY_FAST_UNPLUG_BONUS, label: 'Fast-unplug bonus', kind: 'number' },
      { key: SETTING_KEYS.RELIABILITY_CARPOOL_DRIVER_BONUS, label: 'Carpool driver bonus', kind: 'number' },
      { key: SETTING_KEYS.RELIABILITY_DECAY_PER_DAY, label: 'Score recovery per day', kind: 'number' },
      { key: SETTING_KEYS.RELIABILITY_LOCKOUT_THRESHOLD, label: 'Lockout threshold', kind: 'number' },
      { key: SETTING_KEYS.RELIABILITY_LOCKOUT_DURATION_HOURS, label: 'Lockout duration', kind: 'number', unit: 'hours' },
      { key: SETTING_KEYS.RELIABILITY_QUEUE_WEIGHT, label: 'Queue priority weight', kind: 'number', step: 0.1 },
    ],
  },
  {
    key: 'signup',
    title: 'Signup',
    description: 'Registration gating: release time and the on-site geofence.',
    fields: [
      { key: SETTING_KEYS.SIGNUP_RELEASE_AT, label: 'Signup release time (ISO, blank = open)', kind: 'text', hint: 'Leave empty to allow signups immediately.' },
      { key: SETTING_KEYS.SIGNUP_GEOFENCE_ENABLED, label: 'Require on-site to sign up', kind: 'bool' },
      { key: SETTING_KEYS.SIGNUP_GEOFENCE_RADIUS_METERS, label: 'Geofence radius', kind: 'number', unit: 'm' },
    ],
  },
];
