/**
 * Local auth provider: email + password with bcrypt hashing and JWT access/refresh tokens.
 * Refresh tokens are stored hashed in `refresh_tokens` so they can be revoked (logout, rotation).
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/index.js';
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
const LOCK_WINDOW_MIN = 15;
const LOCK_DURATION_MIN = 15;

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

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
  async register({ email, password, displayName, vehicleDescription, locationId }) {
    const loc = locationId || env.defaultLocationId;
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
      });
    } catch {
      throw new ConflictError('Could not create account');
    }

    const user = toPublicUser(data);
    return {
      user,
      accessToken: signAccessToken(data),
      refreshToken: await issueRefreshToken(data.id, false),
    };
  },

  async login({ email, password, rememberMe }) {
    const row = await prisma.users.findUnique({ where: { email } });

    // Generic failure to prevent user enumeration.
    const invalid = () => new AuthenticationError('Invalid email or password');

    if (!row || !row.password_hash) {
      // Still run a hash compare to equalize timing.
      await bcrypt.compare(password, '$2a$12$0000000000000000000000000000000000000000000000000000');
      throw invalid();
    }
    if (!row.active) throw new BusinessRuleError('This account has been deactivated');

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
    const userRow = await prisma.users.findUnique({ where: { id: row.user_id } });
    if (!userRow || !userRow.active) throw new AuthenticationError('Session expired');
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
};
