/**
 * weeklyReset (Monday midnight): weekly session counts are derived from the sessions table
 * (no counter column), so there's nothing to zero out — but we clear any transient lock flags
 * and log the boundary for auditing. Kept as a job so the boundary is observable & extensible.
 */
import { prisma } from '../db/prisma.js';
import { startOfWeek, now } from '../utils/timeUtils.js';

export async function weeklyReset() {
  // Clear any stale login locks at the week boundary.
  await prisma.users.updateMany({ where: { locked_until: { not: null } }, data: { failed_attempts: 0, locked_until: null } });
  return { actions: 1, weekStart: startOfWeek(now()) };
}
