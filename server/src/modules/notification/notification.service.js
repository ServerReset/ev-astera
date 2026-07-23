/**
 * Notification service: the READ side of notifications (the write side is the channel
 * providers, driven by event listeners). Also manages Web Push subscriptions.
 */
import { prisma } from '../../db/prisma.js';
import { NotFoundError } from '../../utils/errors.js';
import { PAGE_SIZE } from '../../../../shared/constants.js';
import { now } from '../../utils/timeUtils.js';

function toDto(n) {
  return {
    id: n.id,
    type: n.type,
    priority: n.priority,
    title: n.title,
    body: n.body,
    actionUrl: n.action_url,
    metadata: n.metadata || {},
    readAt: n.read_at,
    createdAt: n.created_at,
  };
}

export const notificationService = {
  async list(userId, page = 1) {
    const skip = (page - 1) * PAGE_SIZE;
    const [data, count] = await Promise.all([
      prisma.notifications.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.notifications.count({ where: { user_id: userId } }),
    ]);
    return { items: data.map(toDto), total: count, page };
  },

  async unreadCount(userId) {
    const count = await prisma.notifications.count({ where: { user_id: userId, read_at: null } });
    return { count };
  },

  async markRead(userId, notificationId) {
    const { count } = await prisma.notifications.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { read_at: now() },
    });
    if (!count) throw new NotFoundError('Notification not found');
    return { success: true };
  },

  async markAllRead(userId) {
    await prisma.notifications.updateMany({
      where: { user_id: userId, read_at: null },
      data: { read_at: now() },
    });
    return { success: true };
  },

  // ── Push subscriptions ──────────────────────────────────────────────────────
  async subscribePush(userId, { endpoint, keys }) {
    try {
      await prisma.push_subscriptions.upsert({
        where: { endpoint },
        create: { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
        update: { user_id: userId, p256dh: keys.p256dh, auth: keys.auth },
      });
    } catch (err) {
      throw new Error(`push subscribe failed: ${err.message}`);
    }
    return { success: true };
  },

  async unsubscribePush(userId, endpoint) {
    await prisma.push_subscriptions.deleteMany({ where: { user_id: userId, endpoint } });
    return { success: true };
  },
};
