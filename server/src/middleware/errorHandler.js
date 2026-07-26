/** Global error handler (last middleware). Formats the error envelope from docs/CONTRACTS.md §3. */
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/index.js';

/**
 * Prisma known-request codes (err.code, "P2xxx") that map to a specific, user-facing message +
 * status instead of a generic one. Each entry is { status, code, message } so the handler can set
 * an accurate HTTP status too (not everything Prisma-shaped is a 500).
 */
const PRISMA_KNOWN = {
  P2002: { status: 409, code: 'ALREADY_EXISTS', message: 'That already exists — try a different value.' },
  P2025: { status: 404, code: 'NOT_FOUND', message: 'That record no longer exists — it may have just been changed or removed. Refresh and try again.' },
  P2003: { status: 409, code: 'DEPENDENCY_MISSING', message: "That can't be completed because something it depends on is missing or was removed." },
  P2028: { status: 503, code: 'DATABASE_TIMEOUT', message: 'The database took too long to respond. Please try again in a moment.' },
  P2024: { status: 503, code: 'DATABASE_BUSY', message: 'The service is under heavy load and ran out of database connections. Please try again in a moment.' },
  // Connection-level failures Prisma surfaces via err.code on a known-request error.
  P1001: { status: 503, code: 'DATABASE_UNAVAILABLE', message: "We can't reach the service's database right now — this is on our side, not something you did. Please try again in a moment." },
  P1002: { status: 503, code: 'DATABASE_UNAVAILABLE', message: 'The database server rejected the connection (it may be restarting). Please try again in a moment.' },
  P1008: { status: 503, code: 'DATABASE_TIMEOUT', message: 'The database took too long to respond. Please try again shortly.' },
  P1017: { status: 503, code: 'DATABASE_UNAVAILABLE', message: 'The database closed the connection. Please try again in a moment.' },
};

/** Turn a leading "VERB /path" into a plain-language operation name for the catch-all message. */
function describeRoute(req) {
  const p = (req?.originalUrl || '').split('?')[0];
  if (/\/auth\/login/.test(p)) return 'sign you in';
  if (/\/auth\/register/.test(p)) return 'create your account';
  if (/\/auth\/refresh/.test(p)) return 'restore your session';
  if (/\/sessions/.test(p)) return 'update your charging session';
  if (/\/queue/.test(p)) return 'update the charger queue';
  if (/\/carpool/.test(p)) return 'complete that carpool action';
  if (/\/notifications/.test(p)) return 'load your notifications';
  if (/\/messages/.test(p)) return 'send that message';
  if (/\/admin/.test(p)) return 'complete that admin action';
  if (/\/chargers/.test(p)) return 'load charger data';
  if (/\/offices/.test(p)) return 'load office data';
  return 'complete that request';
}

/**
 * Resolve a non-AppError into { status, code, message }. DB-connectivity and other distinguishable
 * infra failures get their own honest status/code/message rather than collapsing into a bland 500.
 * The user-facing message never leaks the query/stack (that goes to the logs); it names what failed
 * and whether it's on our side + what to do next.
 */
function resolveUnknown(err, req) {
  const prismaCode = err?.code;
  if (typeof prismaCode === 'string' && PRISMA_KNOWN[prismaCode]) return PRISMA_KNOWN[prismaCode];

  // Prisma can't establish a connection at all (bad/unreachable DATABASE_URL, DB down, network).
  // This is the case behind the "Can't reach database server" 500s — surface it as an honest 503.
  if (err?.name === 'PrismaClientInitializationError' || /reach (the )?database server|Can't reach database/i.test(err?.message || '')) {
    return {
      status: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: "We can't reach the service's database right now — this is on our side, not something you did. Please try again in a moment; if it keeps happening, the database may be temporarily down.",
    };
  }
  // The Rust query engine crashed — transient, retryable.
  if (err?.name === 'PrismaClientRustPanicError') {
    return { status: 503, code: 'DATABASE_ENGINE_CRASH', message: 'The database engine hit a transient fault. Please try again in a moment.' };
  }
  // Malformed query shape — a bug on our side, but distinguishable from a total failure.
  if (err?.name === 'PrismaClientValidationError') {
    return { status: 500, code: 'QUERY_SHAPE_ERROR', message: "The server built an invalid database query for that request — this is a bug on our side. It's been logged; please try again or report it if it persists." };
  }

  // True unknown: name the operation that failed so it's never a context-free "something went wrong".
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: `Something failed on our side while trying to ${describeRoute(req)}. It's been logged and we're not hiding it — please try again in a moment.`,
  };
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const isApp = err instanceof AppError;
  const resolved = isApp
    ? { status: err.status, code: err.code, message: err.message }
    : resolveUnknown(err, req);
  const { status, code, message } = resolved;

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} → ${status} [${code}]`, { message: err.message, stack: err.stack });
  } else {
    logger.debug(`${req.method} ${req.originalUrl} → ${status} [${code}]`, { message: err.message });
  }

  // 503s are transient — tell clients/proxies it's worth retrying shortly.
  if (status === 503) res.setHeader('Retry-After', '5');

  const body = { error: { code, message } };
  if (isApp && err.details) body.error.details = err.details;
  // Non-AppError: include the raw cause for developers (dev only), never in prod responses.
  if (!isApp && !env.isProd) body.error.debug = err.message;

  res.status(status).json(body);
}

/** 404 for unmatched routes. */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` } });
}
