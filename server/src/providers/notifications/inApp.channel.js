/** In-app channel: writes a row to `notifications`. Always enabled; delivered to clients via polling. */
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { NOTIFICATION_PRIORITY } from '../../../../shared/constants.js';

export const inAppChannel = {
  name: 'inApp',

  async isEnabled() {
    return true; // in-app notifications are always on
  },

  async send(userId, payload) {
    const { title, body, type, priority = NOTIFICATION_PRIORITY.NORMAL, actionUrl = null, metadata = {}, locationId } = payload;
    try {
      await prisma.notifications.create({
        data: {
          user_id: userId,
          location_id: locationId || env.defaultLocationId,
          type,
          priority,
          title,
          body,
          action_url: actionUrl,
          metadata,
        },
      });
    } catch (err) {
      logger.error('inApp notification insert failed', { message: err.message });
      return false;
    }
    return true;
  },

  async sendBulk(userIds, payload) {
    const { title, body, type, priority = NOTIFICATION_PRIORITY.NORMAL, actionUrl = null, metadata = {}, locationId } = payload;
    if (!userIds.length) return;
    const rows = userIds.map((user_id) => ({
      user_id,
      location_id: locationId || env.defaultLocationId,
      type,
      priority,
      title,
      body,
      action_url: actionUrl,
      metadata,
    }));
    try {
      await prisma.notifications.createMany({ data: rows });
    } catch (err) {
      logger.error('inApp bulk insert failed', { message: err.message });
    }
  },
};
