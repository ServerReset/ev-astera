/** dailyReset (midnight): cancel remaining waiting queue entries, close expired reservations. */
import { prisma } from '../db/prisma.js';
import { QUEUE_STATUS, RESERVATION_STATUS } from '../../../shared/constants.js';
import { now } from '../utils/timeUtils.js';

export async function dailyReset() {
  const { count: cancelled } = await prisma.queue_entries.updateMany({
    where: { status: { in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] } },
    data: { status: QUEUE_STATUS.CANCELLED },
  });

  await prisma.reservations.updateMany({
    where: { status: { in: [RESERVATION_STATUS.UPCOMING, RESERVATION_STATUS.ACTIVE] }, end_at: { lt: now() } },
    data: { status: RESERVATION_STATUS.COMPLETED },
  });

  return { actions: cancelled, resetQueues: cancelled };
}
