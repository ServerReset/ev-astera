/** Centralized, validated environment configuration. Import `env` everywhere. */
import dotenv from 'dotenv';

dotenv.config();

function required(key) {
  const v = process.env[key];
  if (!v && process.env.NODE_ENV !== 'test') {
    // Warn loudly but don't crash dev when optional integrations are absent.
    // Truly required values are asserted in assertConfig() below. (Plain console, not
    // utils/logger.js, to avoid a circular import — that module imports `env` from here.)
    // eslint-disable-next-line no-console
    console.warn(`[config] Missing environment variable: ${key}`);
  }
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port: parseInt(process.env.PORT || '3001', 10),

  postgresUrl: required('POSTGRES_URL'),
  postgresUrlDirect: required('POSTGRES_URL_DIRECT'),
  cronSecret: required('CRON_SECRET'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiry: process.env.JWT_EXPIRY || '1h',
  refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  refreshExpiryRemember: process.env.REFRESH_TOKEN_EXPIRY_REMEMBER || '30d',
  authProvider: process.env.AUTH_PROVIDER || 'local',

  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',

  // Soft fallback only, for a handful of call sites that need SOME location when none is in
  // scope (a push notification with no locationId in its payload, the audit log, /users/me/stats
  // for a user whose own locationId is somehow missing). Not required — with multiple offices
  // there is no single "the" default anymore, so nothing in assertConfig() enforces this is set.
  defaultLocationId: process.env.DEFAULT_LOCATION_ID,
};

/** Called at boot; throws if a hard-required value is missing in production. */
export function assertConfig() {
  const hard = ['postgresUrl', 'postgresUrlDirect', 'jwtSecret', 'cronSecret'];
  const missing = hard.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
