/**
 * Local auth provider: email + password with bcrypt hashing and JWT access/refresh tokens.
 * Refresh tokens are stored hashed in `refresh_tokens` so they can be revoked (logout, rotation).
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/index.js';
import { configService } from '../../services/config.service.js';
import { haversineMiles } from '../../utils/geo.js';
import { SETTING_KEYS } from '../../../../shared/constants.js';
import {
  AppError,
  AuthenticationError,
  ConflictError,
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js';
import { addDays, addMinutes, now } from '../../utils/timeUtils.js';

const SALT_ROUNDS = 12;
const LOCK_THRESHOLD = 5;
// NOTE: there is intentionally no rolling failure WINDOW — the login-failure-window migration
// (20260725040000) that would have added last_failed_at was reverted (see its migration.sql), so
// the counter reverted to per-attempt. Reintroducing a window needs that column + migration first.
const LOCK_DURATION_MIN = 15;

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

const WITH_OFFICE = { locations: { select: { id: true, name: true, timezone: true, active: true } } };

function toPublicUser(row) {
  return {
    id: row.id,
    locationId: row.location_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    vehicleDescription: row.vehicle_description,
    notificationPrefs: row.notification_prefs || {},
    carpoolCredits: row.carpool_credits ?? 0,
    onboardedAt: row.onboarded_at,
    office: row.locations ? { id: row.locations.id, name: row.locations.name, timezone: row.locations.timezone } : null,
  };
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, locationId: user.location_id },
    env.jwtSecret,
    { algorithm: 'HS256', expiresIn: env.jwtExpiry }
  );
}

async function issueRefreshToken(userId, remember) {
  const raw = crypto.randomBytes(48).toString('hex');
  const days = remember ? parseInt(env.refreshExpiryRemember, 10) || 30 : parseInt(env.refreshExpiry, 10) || 7;
  const expiresAt = addDays(now(), days);
  try {
    await prisma.refresh_tokens.create({
      data: { user_id: userId, token_hash: hashToken(raw), expires_at: expiresAt },
    });
  } catch {
    throw new AppError('Could not complete sign-in. Please try again.', 500, 'REFRESH_TOKEN_FAILED');
  }
  return raw;
}

export const localProvider = {
  async register({ email, password, displayName, vehicleDescription, lat, lng, locationId }) {
    const loc = locationId;
    const office = await prisma.locations.findUnique({
      where: { id: loc },
      select: { active: true, site_lat: true, site_lng: true },
    });
    if (!office || !office.active) throw new ValidationError('Select a valid office to sign up at.');

    // Fails CLOSED, not open: a signup gate is a security/business control, so any
    // misconfiguration (unparseable date, missing office coordinates, non-numeric radius)
    // should block registration and surface a clear server-side error rather than silently
    // letting everyone through — the opposite of what an admin enabling these gates intends.
    const releaseAt = await configService.get(SETTING_KEYS.SIGNUP_RELEASE_AT, loc);
    if (releaseAt) {
      const releaseDate = new Date(releaseAt);
      if (Number.isNaN(releaseDate.getTime())) {
        throw new AppError(
          'Signups are misconfigured (invalid release date) — contact an admin.',
          500,
          'SIGNUP_RELEASE_AT_INVALID'
        );
      }
      if (new Date() < releaseDate) throw new BusinessRuleError('Signups are not open yet.');
    }

    const geoEnabled = await configService.getBool(SETTING_KEYS.SIGNUP_GEOFENCE_ENABLED, loc);
    // Geofence can only actually enforce anything when the office has coordinates. An office
    // created without a geocodable address has geofence enabled-by-default but null coords — that
    // combination can't verify anyone's location, so rather than 500-ing and permanently blocking
    // EVERY employee there (a silent, undiagnosable dead-end), we skip the check and let signup
    // proceed. This is the ONE place we intentionally fail open, and only for this specific admin
    // misconfiguration; a properly-configured office still enforces the radius below.
    const officeHasCoords = office.site_lat != null && office.site_lng != null;
    if (geoEnabled && officeHasCoords) {
      if (lat == null || lng == null) {
        throw new BusinessRuleError('Location is required to sign up — enable location access and try again.');
      }
      const radiusMeters = await configService.getNumber(SETTING_KEYS.SIGNUP_GEOFENCE_RADIUS_METERS, loc);
      if (Number.isNaN(radiusMeters)) {
        throw new AppError(
          'Signups are misconfigured (geofence radius) — contact an admin.',
          500,
          'SIGNUP_GEOFENCE_MISCONFIGURED'
        );
      }
      const distanceMeters = haversineMiles({ lat, lng }, { lat: office.site_lat, lng: office.site_lng }) * 1609.34;
      if (distanceMeters > radiusMeters) {
        throw new BusinessRuleError('You must be near the office to sign up.');
      }
    }

    const existing = await prisma.users.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictError('An account with this email already exists');

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    let data;
    try {
      data = await prisma.users.create({
        data: {
          location_id: loc,
          email,
          password_hash: passwordHash,
          display_name: displayName,
          vehicle_description: vehicleDescription || null,
        },
        include: WITH_OFFICE,
      });
    } catch (err) {
      if (err?.name?.startsWith('PrismaClient') && err?.code !== 'P2002') throw err; // real DB failure → 503
      // P2002 (or any leftover) here means the email was taken between the check above and insert.
      throw new ConflictError('An account with this email already exists. Try signing in instead, or use a different email.');
    }

    const user = toPublicUser(data);
    return {
      user,
      accessToken: signAccessToken(data),
      refreshToken: await issueRefreshToken(data.id, false),
    };
  },

  async login({ email, password, rememberMe }) {
    const row = await prisma.users.findUnique({ where: { email }, include: WITH_OFFICE });

    // Generic failure to prevent user enumeration.
    const invalid = () => new AuthenticationError('Invalid email or password');

    if (!row || !row.password_hash) {
      // Still run a hash compare to equalize timing.
      await bcrypt.compare(password, '$2a$12$0000000000000000000000000000000000000000000000000000');
      throw invalid();
    }
    if (!row.active) throw new BusinessRuleError('This account has been deactivated');
    // Every scoped route already 404s under a deactivated office (locationScope) — surface a
    // clear reason here instead of letting the user log in only to find nothing works anywhere.
    if (!row.locations?.active) throw new BusinessRuleError('Your office has been deactivated. Contact an admin.');

    if (row.locked_until && new Date(row.locked_until) > new Date()) {
      throw new BusinessRuleError('Account temporarily locked. Try again in a few minutes.');
    }

    const good = await bcrypt.compare(password, row.password_hash);
    if (!good) {
      const attempts = (row.failed_attempts || 0) + 1;
      const patch = { failed_attempts: attempts };
      if (attempts >= LOCK_THRESHOLD) {
        patch.locked_until = addMinutes(now(), LOCK_DURATION_MIN);
        patch.failed_attempts = 0;
      }
      await prisma.users.update({ where: { id: row.id }, data: patch });
      throw invalid();
    }

    await prisma.users.update({
      where: { id: row.id },
      data: { failed_attempts: 0, locked_until: null, last_active_at: now() },
    });

    return {
      user: toPublicUser(row),
      accessToken: signAccessToken(row),
      refreshToken: await issueRefreshToken(row.id, rememberMe),
    };
  },

  async verifyAccessToken(token) {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    return { userId: payload.sub, email: payload.email, role: payload.role, locationId: payload.locationId };
  },

  async refreshAccessToken(refreshToken) {
    if (!refreshToken) throw new AuthenticationError('No refresh token');
    const row = await prisma.refresh_tokens.findFirst({ where: { token_hash: hashToken(refreshToken) } });
    if (!row || row.revoked || new Date(row.expires_at) < new Date()) {
      throw new AuthenticationError('Session expired');
    }
    const userRow = await prisma.users.findUnique({ where: { id: row.user_id }, include: WITH_OFFICE });
    if (!userRow || !userRow.active) throw new AuthenticationError('Session expired');
    // Mirror login()'s office-active gate: if the user's office was deactivated while they were
    // signed in, stop minting fresh tokens. Otherwise the SPA silently refreshes forever and the
    // user is stuck in a broken app where every location-scoped route 404s, with no explanation —
    // failing refresh here bounces them to login, which surfaces the deactivated-office message.
    if (!userRow.locations?.active) throw new AuthenticationError('Session expired');
    return { accessToken: signAccessToken(userRow), user: toPublicUser(userRow) };
  },

  async changePassword(userId, currentPassword, newPassword) {
    const row = await prisma.users.findUnique({ where: { id: userId } });
    if (!row) throw new NotFoundError('User not found');
    if (!row.password_hash || !(await bcrypt.compare(currentPassword, row.password_hash))) {
      throw new ValidationError('Current password is incorrect');
    }
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.users.update({ where: { id: userId }, data: { password_hash: hash } });
    // Revoke all refresh tokens on password change.
    await prisma.refresh_tokens.updateMany({ where: { user_id: userId }, data: { revoked: true } });
  },

  async logout(userId, refreshToken) {
    if (refreshToken) {
      await prisma.refresh_tokens.updateMany({
        where: { user_id: userId, token_hash: hashToken(refreshToken) },
        data: { revoked: true },
      });
    }
  },

  // Revoke by the refresh-token hash alone — no valid access token required. Logout must work
  // even after the access token has expired (the common "walk away for an hour, come back and
  // sign out" case); gating logout on a live access token left the session revocable-only while
  // fresh, so an expired-token logout silently left the refresh cookie valid and the next visit
  // (or the next person on a shared machine) got logged straight back in.
  async logoutByRefreshToken(refreshToken) {
    if (!refreshToken) return;
    await prisma.refresh_tokens.updateMany({
      where: { token_hash: hashToken(refreshToken) },
      data: { revoked: true },
    });
  },
};
