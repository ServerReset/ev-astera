/** cleanup (daily): delete notifications older than 30 days and expired refresh tokens. */
import { prisma } from '../db/prisma.js';
import { addDays, now } from '../utils/timeUtils.js';

export async function cleanup() {
  const cutoff = addDays(now(), -30);
  const { count: notifs } = await prisma.notifications.deleteMany({ where: { created_at: { lt: cutoff } } });
  await prisma.refresh_tokens.deleteMany({ where: { expires_at: { lt: now() } } });
  return { actions: notifs };
}
