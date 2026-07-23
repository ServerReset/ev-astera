/**
 * Shared Zod schemas — the SAME validation runs on client (pre-submit) and server (authoritative).
 * Import individual schemas; they are grouped by domain.
 */
import { z } from 'zod';
import { CARPOOL_DIRECTION, CARPOOL_ROLE, EMERGENCY_REASONS } from './constants.js';

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
    vehicleDescription: optionalShortText,
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(10), password: passwordSchema });
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
  displayName: z.string().trim().min(2).max(60).optional(),
  vehicleDescription: optionalShortText,
  notificationPrefs: z.record(z.string(), z.boolean()).optional(),
});

// ── Sessions ─────────────────────────────────────────────────────────────────
const durationMinutesSchema = z
  .number()
  .int()
  .min(30, 'Minimum 30 minutes')
  .max(4 * 60, 'Maximum 4 hours');

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
  message: z.string().trim().min(1).max(100),
});
export const nudgeReactSchema = z.object({
  messageId: uuidSchema,
  reaction: z.enum(['up', 'down']),
});
export const emergencyRequestSchema = z.object({
  reason: z.enum(EMERGENCY_REASONS),
  explanation: z.string().trim().max(200).optional(),
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
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  expiresAt: z.string().datetime().nullable().optional(),
  active: z.boolean().optional().default(true),
});
export const updateSettingsSchema = z.record(z.string(), z.union([z.number(), z.boolean(), z.string()]));
export const setOfflineSchema = z.object({ reason: z.string().trim().max(200).optional() });
export const chargerNameSchema = z.object({ name: z.string().trim().min(1).max(80) });
export const adminUpdateUserSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  active: z.boolean().optional(),
  resetWeek: z.boolean().optional(),
});
export const adminCreateUserSchema = z.object({
  email: asteraEmailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(80),
  role: z.enum(['user', 'admin']),
});

// ── Carpool ──────────────────────────────────────────────────────────────────
const directionEnum = z.enum([CARPOOL_DIRECTION.TO_SITE, CARPOOL_DIRECTION.FROM_SITE]);
const geoPointSchema = z.object({
  label: z.string().trim().min(2).max(160),
});

export const postRideSchema = z.object({
  direction: directionEnum,
  origin: geoPointSchema,
  departAt: z.string().datetime(),
  seatsTotal: z.number().int().min(1).max(7),
  notes: z.string().trim().max(200).optional(),
  linkedSessionId: uuidSchema.nullable().optional(),
  groupId: uuidSchema.nullable().optional(),
});

export const updateRideSchema = z.object({
  departAt: z.string().datetime().optional(),
  seatsTotal: z.number().int().min(1).max(7).optional(),
  notes: z.string().trim().max(200).optional(),
});

export const bookRideSchema = z.object({
  pickup: geoPointSchema,
  seats: z.number().int().min(1).max(6).optional().default(1),
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
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  departTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM'),
  origin: geoPointSchema,
  seats: z.number().int().min(1).max(7).optional().default(1),
  groupId: uuidSchema.nullable().optional(),
  active: z.boolean().optional().default(true),
});
export const updateScheduleSchema = createScheduleSchema.partial();

export const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional(),
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
