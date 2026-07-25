/**
 * dailyReset (midnight): cancel remaining waiting queue entries — scoped per active office,
 * not global. The cron fires once daily at a single UTC instant (vercel.json), which can't
 * land at true local midnight for every office simultaneously; this only fixes the correctness
 * bug (one office's reset used to wipe every other office's queue too), not the alignment —
 * that would need per-office cron scheduling, which Vercel Cron doesn't support natively.
 */
import { prisma } from '../db/prisma.js';
import { QUEUE_STATUS } from '../../../shared/constants.js';

export async function dailyReset() {
  const locations = await prisma.locations.findMany({ where: { active: true }, select: { id: true } });
  let cancelled = 0;
  for (const loc of locations) {
    const { count } = await prisma.queue_entries.updateMany({
      where: { location_id: loc.id, status: { in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] } },
      data: { status: QUEUE_STATUS.CANCELLED },
    });
    cancelled += count;
  }

  return { actions: cancelled, resetQueues: cancelled };
}
