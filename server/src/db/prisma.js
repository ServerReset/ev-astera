/**
 * Prisma client singleton — with cold-start warm-up + transient-connection retry.
 *
 * Why: this app runs on managed Prisma Postgres, which AUTO-SUSPENDS on inactivity and cold-starts
 * slowly. The first queries after idle fail with P1001 "Can't reach database server" even though the
 * instance is coming back up — which is exactly the intermittent login failure we chased (CLI tools
 * connected during up-windows while the running app hit down-windows). Rather than surface a hard
 * error for what is really a wake-up delay, we:
 *   1. warm the connection at boot — retry a trivial `SELECT 1` with backoff, logging progress, so
 *      the instance is (re)awake before the first real request arrives; and
 *   2. wrap every model operation so a transient connection error retries a few times before giving
 *      up (only then does the global error handler classify it as 503 DATABASE_UNAVAILABLE).
 *
 * Cached on globalThis in dev so nodemon hot-reload reuses one connection pool.
 */
import dns from 'node:dns';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

// Prefer the host's IPv4 (A) record over IPv6 (AAAA). Node ≥17 defaults to "verbatim" DNS ordering,
// which can hand back an IPv6 address first; if the local network can't route IPv6 to the DB host,
// connections fail while IPv4-based tools (which we verified reach 45.63.92.86) succeed. Cheap
// insurance against that class of "works from CLI, fails from app" connectivity mismatch.
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* older Node without this API — ignore */
}

const globalForPrisma = globalThis;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Connection-level errors that are transient (instance waking / brief blip) and worth retrying —
 *  as opposed to real query errors (bad data, constraint violations) which must surface immediately. */
function isTransientConnError(e) {
  const name = e?.name || '';
  const code = e?.code;
  return (
    name === 'PrismaClientInitializationError' ||
    name === 'PrismaClientRustPanicError' ||
    code === 'P1001' || // can't reach database server
    code === 'P1002' || // server rejected the connection (restarting)
    code === 'P1008' || // operation timed out
    code === 'P1017' // server closed the connection
  );
}

// Per-operation retry — short, so a transient blip self-heals without a long user-facing wait.
const QUERY_RETRY_DELAYS_MS = [250, 750, 2000];

function createPrisma() {
  const base = new PrismaClient();

  // Retry transient connection failures on every model operation (findUnique, create, …).
  const client = base.$extends({
    query: {
      async $allOperations({ args, query }) {
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args);
          } catch (e) {
            if (!isTransientConnError(e) || attempt >= QUERY_RETRY_DELAYS_MS.length) throw e;
            await sleep(QUERY_RETRY_DELAYS_MS[attempt]);
          }
        }
      },
    },
  });

  // Fire-and-forget boot warm-up: nudge a possibly-suspended instance awake so the first real
  // request doesn't eat the whole cold-start. Runs on `base` (raw queries aren't covered by the
  // model-op extension above); the per-query retry remains the real guarantee if this doesn't finish
  // in time. Retries span ~21s — longer than any single request would tolerate.
  warmUp(base);

  return client;
}

async function warmUp(base) {
  const delays = [0, 1000, 2000, 3000, 5000, 5000, 5000]; // cumulative ≈ 21s
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await sleep(delays[i]);
    try {
      await base.$queryRaw`SELECT 1`;
      if (i > 0) logger.info('Database connection established (after warm-up).');
      return;
    } catch (e) {
      if (!isTransientConnError(e)) return; // non-connection error at boot — not ours to handle here
      logger.warn(`Database is waking up — retrying connection (${i + 1}/${delays.length})…`);
    }
  }
  logger.error(
    'Database still unreachable after warm-up retries. If this persists, the Prisma Postgres instance may be suspended — open it in the Prisma/Vercel dashboard to resume it. Requests will keep retrying per-query.'
  );
}

export const prisma = globalForPrisma.__prisma ?? createPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}
