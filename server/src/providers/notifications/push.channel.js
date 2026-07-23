/** Web Push channel: sends VAPID push to all of a user's stored subscriptions. */
import { prisma } from '../../db/prisma.js';
import { logger } from '../../utils/logger.js';
import { sendPush, isPushConfigured } from '../../utils/pushUtils.js';

export const pushChannel = {
  name: 'push',

  async isEnabled(userId) {
    if (!isPushConfigured()) return false;
    const count = await prisma.push_subscriptions.count({ where: { user_id: userId } });
    return count > 0;
  },

  async send(userId, payload) {
    const subs = await prisma.push_subscriptions.findMany({ where: { user_id: userId } });
    if (!subs.length) return false;

    const body = {
      title: payload.title,
      body: payload.body,
      icon: '/icons/icon-192.svg',
      badge: '/icons/badge-72.svg',
      tag: payload.type,
      data: { url: payload.actionUrl || '/', ...payload.metadata },
    };

    const dead = [];
    let anyOk = false;
    for (const sub of subs) {
      const { ok, gone } = await sendPush(sub, body);
      anyOk = anyOk || ok;
      if (gone) dead.push(sub.id);
    }
    if (dead.length) {
      await prisma.push_subscriptions.deleteMany({ where: { id: { in: dead } } });
      logger.debug(`pruned ${dead.length} dead push subscriptions`);
    }
    return anyOk;
  },

  async sendBulk(userIds, payload) {
    await Promise.all(userIds.map((id) => this.send(id, payload)));
  },
};
