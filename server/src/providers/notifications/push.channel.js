/** Web Push channel: sends VAPID push to all of a user's stored subscriptions. */
import { prisma } from '../../db/prisma.js';
import { logger } from '../../utils/logger.js';
import { sendPush, isPushConfigured } from '../../utils/pushUtils.js';

function buildBody(payload) {
  return {
    title: payload.title,
    body: payload.body,
    icon: '/icons/icon-192.svg',
    badge: '/icons/badge-72.svg',
    tag: payload.type,
    data: { url: payload.actionUrl || '/', ...payload.metadata },
  };
}

/** Push a set of subscription rows, prune any that came back "gone" in ONE deleteMany. */
async function pushToSubs(subs, body) {
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
}

export const pushChannel = {
  name: 'push',

  // DB-FREE: this only answers "is the push channel operational" (VAPID configured), NOT "does this
  // user have subscriptions" — send()/sendBulk() already fetch subscriptions once and no-op when a
  // user has none. Previously this ran a push_subscriptions.count on EVERY notification (and N times
  // per bulk send), doubling the channel's query cost for information send() re-derives anyway.
  isEnabled() {
    return isPushConfigured();
  },

  async send(userId, payload) {
    const subs = await prisma.push_subscriptions.findMany({ where: { user_id: userId } });
    if (!subs.length) return false;
    return pushToSubs(subs, buildBody(payload));
  },

  // ONE query for all recipients' subscriptions (was N: one findMany per user via send()). Users
  // with no subscriptions simply don't appear in the result — no wasted lookup.
  async sendBulk(userIds, payload) {
    if (!userIds?.length) return;
    const subs = await prisma.push_subscriptions.findMany({ where: { user_id: { in: userIds } } });
    if (!subs.length) return;
    await pushToSubs(subs, buildBody(payload));
  },
};
