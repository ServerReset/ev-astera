/** Web Push (VAPID) setup + a thin send wrapper that prunes dead subscriptions. */
import webpush from 'web-push';
import { env } from '../config/index.js';
import { logger } from './logger.js';

let configured = false;

export function initWebPush() {
  if (!env.vapidPublicKey || !env.vapidPrivateKey) {
    logger.warn('VAPID keys not set — push notifications disabled. Run `npm run gen:vapid`.');
    return;
  }
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
  configured = true;
  logger.info('Web Push configured');
}

export const isPushConfigured = () => configured;

/**
 * Send a push payload to a stored subscription row.
 * Returns { ok, gone } — `gone` true means the subscription is dead (410/404) and should be deleted.
 */
export async function sendPush(subscription, payload) {
  if (!configured) return { ok: false, gone: false };
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload)
    );
    return { ok: true, gone: false };
  } catch (err) {
    const gone = err.statusCode === 404 || err.statusCode === 410;
    if (!gone) logger.error('push send failed', { status: err.statusCode, message: err.message });
    return { ok: false, gone };
  }
}
