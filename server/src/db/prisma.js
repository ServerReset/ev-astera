/**
 * Prisma client singleton. Cached on globalThis in dev so nodemon/hot-reload doesn't spin up
 * a new connection pool on every file change; in prod each cold start creates exactly one.
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}
