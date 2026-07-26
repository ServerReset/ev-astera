/**
 * Shared Zod schemas — the SAME validation runs on client (pre-submit) and server (authoritative).
 * Import individual schemas; they are grouped by domain.
 */
import { z } from 'zod';
import { CARPOOL_DIRECTION, CARPOOL_ROLE } from './constants.js';

// ── Primitives ─────────────────────────────────────────────────────────────────
export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email');

// Registration/account creation is restricted to Astera Labs staff. Existing accounts (e.g.
// legacy/seeded admins) can still log in via loginSchema, which does not carry this restriction.
const asteraEmailSchema = emailSchema.refine((v) => v.endsWith('@asteralabs.com'), {
  message: 'Use your @asteralabs.com email address',
});

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'One uppercase letter')
  .regex(/[a-z]/, 'One lowercase letter')
  .regex(/[0-9]/, 'One number')
  .regex(/[^A-Za-z0-9]/, 'One special character');

export const uuidSchema = z.string().uuid();
const optionalShortText = z.string().trim().max(120).optional().or(z.literal(''));

// ── Auth ─────────────────────────────────────────────────────────────────────
export const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, 'Name is too short').max(60),
    email: asteraEmailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    vehicleDescription: z.string().trim().min(1, 'Vehicle description is required').max(120),
    locationId: uuidSchema,
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const signupStatusQuerySchema = z.object({ locationId: uuidSchema });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ── User profile ───────────────────────────────────────────────────────────────
export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2, 'Your name needs at least 2 characters').max(60, 'Your name can be at most 60 characters').optional(),
  vehicleDescription: optionalShortText,
  notificationPrefs: z.record(z.string(), z.boolean()).optional(),
});

// ── Sessions ─────────────────────────────────────────────────────────────────
// This is a sanity ceiling only, NOT the real business-rule max — that's the admin-editable
// SETTING_KEYS.MAX_SESSION_HOURS, enforced server-side in session.service.js's start()/
// updateEta(). Keeping this generous (24h) means an admin raising or lowering the real setting
// can never silently desync from this client-side pre-check; the UI (DurationSlider via
// sessionApi.getConfig()) fetches and displays the REAL max, this schema just rejects garbage.
const durationMinutesSchema = z
  .number()
  .int()
  .min(30, 'Minimum 30 minutes')
  .max(24 * 60, 'Maximum 24 hours');

export const startSessionSchema = z.object({
  chargerId: uuidSchema,
  durationMinutes: durationMinutesSchema,
  vehicleDescription: optionalShortText,
  confirmedConnected: z.literal(true, { errorMap: () => ({ message: 'Please confirm the charger is connected' }) }),
});

export const updateEtaSchema = z.object({ durationMinutes: durationMinutesSchema });

export const endSessionSchema = z.object({
  unplugged: z.literal(true),
  capped: z.literal(true),
  cablesWrapped: z.literal(true),
  vehicleMoved: z.literal(true),
});

// ── Queue ──────────────────────────────────────────────────────────────────────
export const joinQueueSchema = z.object({
  // chargerId omitted / null => "any available" queue
  chargerId: uuidSchema.nullable().optional(),
});
export const leaveQueueSchema = z.object({ queueEntryId: uuidSchema });
export const claimQueueSchema = z.object({ queueEntryId: uuidSchema });

// ── Messaging ─────────────────────────────────────────────────────────────────
export const nudgeSchema = z.object({
  chargerId: uuidSchema,
  sessionId: uuidSchema,
  message: z.string().trim().min(1, 'Enter a short message to send').max(100, 'Keep your nudge to 100 characters or fewer'),
});
// `up`/`down` are kept for backward-compat with rows stored before the reaction pack landed;
// `pray`/`run`/`eyes` were added so a nudge reply can carry real context ("almost done" / "on my
// way" / "seen it") instead of a bare up/down. The DB column is a plain nullable string, so
// widening this enum needs no migration — see message/listeners.js's NUDGE_REACTION_TEMPLATE map.
export const nudgeReactSchema = z.object({
  messageId: uuidSchema,
  reaction: z.enum(['up', 'down', 'pray', 'run', 'eyes']),
});
// `reason` is validated as free text here (not a z.enum) because the real allowed list is
// admin-editable per office (SETTING_KEYS.EMERGENCY_REASONS) and can't be known at this
// module's load time — message.service.js's requestEmergency() checks the submitted reason
// against that location's actual configured list before accepting it.
export const emergencyRequestSchema = z.object({
  reason: z.string().trim().min(1, 'Choose a reason for the emergency request').max(80, 'Keep the reason under 80 characters'),
  explanation: z.string().trim().max(200, 'Keep the explanation under 200 characters').optional(),
});
export const emergencyRespondSchema = z.object({
  requestId: uuidSchema,
  accept: z.boolean(),
});

// ── Notifications ─────────────────────────────────────────────────────────────
export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

// ── Admin ─────────────────────────────────────────────────────────────────────
export const announcementSchema = z.object({
  title: z.string().trim().min(1, 'Give the announcement a title').max(120, 'Keep the title under 120 characters'),
  body: z.string().trim().min(1, 'Write the announcement body').max(2000, 'Keep the announcement under 2000 characters'),
  expiresAt: z.string().datetime().nullable().optional(),
  active: z.boolean().optional().default(true),
});
// Value union MUST include string arrays: NUDGE_PRESETS and EMERGENCY_REASONS are stored as
// jsonb string-arrays (shared/constants.js), and the admin Settings save() always sends the full
// field set for the mounted tab — so a bare number|boolean|string union rejected EVERY save on the
// Chargers tab (which carries those two list fields), not just edits to the lists themselves.
export const updateSettingsSchema = z.record(
  z.string(),
  z.union([z.number(), z.boolean(), z.string(), z.array(z.string())])
);
export const setOfflineSchema = z.object({ reason: z.string().trim().max(200, 'Keep the reason under 200 characters').optional() });
export const chargerNameSchema = z.object({ name: z.string().trim().min(1, 'Give the charger a name').max(80, 'Keep the charger name under 80 characters') });
export const adminUpdateUserSchema = z.object({
  role: z.enum(['user', 'site_admin', 'super_admin']).optional(),
  active: z.boolean().optional(),
  resetWeek: z.boolean().optional(),
});
export const adminCreateUserSchema = z.object({
  email: asteraEmailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, "Enter the member's name").max(80, 'Keep the name under 80 characters'),
  role: z.enum(['user', 'site_admin', 'super_admin']),
});

// ── Offices ──────────────────────────────────────────────────────────────────
// Intl.supportedValuesOf isn't in every browser/Node version this runs in — when absent, skip
// the allowlist check rather than rejecting every timezone string (the server DB doesn't
// validate the value further, and a typo'd zone just falls back to UTC display, not a crash).
const ianaZones = (() => {
  try {
    return new Set(Intl.supportedValuesOf('timeZone'));
  } catch {
    return null;
  }
})();
const timezoneSchema = z
  .string()
  .trim()
  .min(1, 'Timezone is required')
  .max(64)
  .refine((v) => !ianaZones || ianaZones.has(v), 'Not a recognized IANA timezone');

export const createOfficeSchema = z.object({
  name: z.string().trim().min(2, 'Office name needs at least 2 characters').max(120, 'Keep the office name under 120 characters'),
  address: z.string().trim().min(3, 'Enter a fuller address (at least 3 characters)').max(240, 'Keep the address under 240 characters').optional().or(z.literal('')),
  timezone: timezoneSchema,
});
export const updateOfficeSchema = createOfficeSchema.partial();

// ── Carpool ──────────────────────────────────────────────────────────────────
const directionEnum = z.enum([CARPOOL_DIRECTION.TO_SITE, CARPOOL_DIRECTION.FROM_SITE]);
const geoPointSchema = z.object({
  label: z.string().trim().min(2, 'Enter a pickup/location (at least 2 characters)').max(160, 'Keep the location under 160 characters'),
});

export const postRideSchema = z.object({
  direction: directionEnum,
  origin: geoPointSchema,
  departAt: z.string().datetime(),
  seatsTotal: z.number().int().min(1, 'Offer at least 1 seat').max(7, 'A ride can offer at most 7 seats'),
  notes: z.string().trim().max(200, 'Keep notes under 200 characters').optional(),
  linkedSessionId: uuidSchema.nullable().optional(),
  groupId: uuidSchema.nullable().optional(),
});

export const updateRideSchema = z.object({
  departAt: z.string().datetime().optional(),
  seatsTotal: z.number().int().min(1, 'Offer at least 1 seat').max(7, 'A ride can offer at most 7 seats').optional(),
  notes: z.string().trim().max(200, 'Keep notes under 200 characters').optional(),
});

export const bookRideSchema = z.object({
  pickup: geoPointSchema,
  seats: z.number().int().min(1, 'Book at least 1 seat').max(6, 'You can book at most 6 seats in one request').optional().default(1),
});

export const completeRideSchema = z.object({
  milesOverride: z.number().min(0).max(500).optional(),
});

export const postRequestSchema = z.object({
  direction: directionEnum,
  origin: geoPointSchema,
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  groupId: uuidSchema.nullable().optional(),
});

export const createScheduleSchema = z.object({
  role: z.enum([CARPOOL_ROLE.DRIVER, CARPOOL_ROLE.RIDER]),
  direction: directionEnum,
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, 'Pick at least one day of the week'),
  departTime: z.string().regex(/^\d{2}:\d{2}$/, 'Enter a time as HH:MM (e.g. 08:30)'),
  origin: geoPointSchema,
  seats: z.number().int().min(1, 'Offer at least 1 seat').max(7, 'A schedule can offer at most 7 seats').optional().default(1),
  groupId: uuidSchema.nullable().optional(),
  active: z.boolean().optional().default(true),
});
export const updateScheduleSchema = createScheduleSchema.partial();

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, 'Group name needs at least 2 characters').max(60, 'Keep the group name under 60 characters'),
  description: z.string().trim().max(200, 'Keep the description under 200 characters').optional(),
});

export const listRidesQuerySchema = z.object({
  direction: directionEnum.optional(),
  around: z.string().datetime().optional(),
});
export const leaderboardQuerySchema = z.object({
  window: z.enum(['week', 'month', 'all']).optional().default('week'),
  scope: z.enum(['location', 'group']).optional().default('location'),
  groupId: uuidSchema.optional(),
});
