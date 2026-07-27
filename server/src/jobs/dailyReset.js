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
  const ids = locations.map((l) => l.id);
  if (!ids.length) return { actions: 0, resetQueues: 0 };

  // One updateMany scoped to all active offices at once (was one per office in a loop). Same effect
  // — the operation is identical per office, so a `location_id IN (...)` filter covers them all.
  const { count } = await prisma.queue_entries.updateMany({
    where: { location_id: { in: ids }, status: { in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] } },
    data: { status: QUEUE_STATUS.CANCELLED },
  });

  return { actions: count, resetQueues: count };
}
