/** dailyReset (midnight): cancel remaining waiting queue entries. */
import { prisma } from '../db/prisma.js';
import { QUEUE_STATUS } from '../../../shared/constants.js';

export async function dailyReset() {
  const { count: cancelled } = await prisma.queue_entries.updateMany({
    where: { status: { in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.NOTIFIED, QUEUE_STATUS.CLAIMED] } },
    data: { status: QUEUE_STATUS.CANCELLED },
  });

  return { actions: cancelled, resetQueues: cancelled };
}
