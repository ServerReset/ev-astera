/**
 * Notification dispatcher. Fans a payload out to every ENABLED channel for a user.
 * Adding a channel = import it + add to `channels`. Listeners call dispatchNotification().
 */
import { inAppChannel } from './inApp.channel.js';
import { pushChannel } from './push.channel.js';
import { emailChannel } from './email.channel.js';
import { teamsChannel } from './teams.channel.js';
import { logger } from '../../utils/logger.js';

const channels = [inAppChannel, pushChannel, emailChannel, teamsChannel];

/**
 * @param {string} userId
 * @param {{title, body, type, priority?, actionUrl?, metadata?, locationId?}} payload
 */
export async function dispatchNotification(userId, payload) {
  await Promise.all(
    channels.map(async (ch) => {
      try {
        if (await ch.isEnabled(userId)) await ch.send(userId, payload);
      } catch (err) {
        logger.error(`notification channel ${ch.name} failed`, { message: err.message });
      }
    })
  );
}

/** Bulk variant — dispatch the same payload to many users. */
export async function dispatchBulk(userIds, payload) {
  if (!userIds?.length) return;
  await Promise.all(
    channels.map(async (ch) => {
      try {
        // isEnabled is per-user; filter first for channels that care.
        const enabled = [];
        for (const id of userIds) {
          if (await ch.isEnabled(id)) enabled.push(id);
        }
        if (enabled.length) await ch.sendBulk(enabled, payload);
      } catch (err) {
        logger.error(`notification channel ${ch.name} bulk failed`, { message: err.message });
      }
    })
  );
}
