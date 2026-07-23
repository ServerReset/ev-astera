/** Global error handler (last middleware). Formats the error envelope from docs/CONTRACTS.md §3. */
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/index.js';

/** Prisma error codes that map to a specific, user-facing message instead of a generic one. */
const PRISMA_MESSAGES = {
  P2002: 'That already exists — try a different value.',
  P2025: 'That record no longer exists. It may have just been changed or removed.',
  P2003: "That can't be completed because something it depends on is missing.",
  P2028: 'That took too long and timed out. Please try again.',
};

function fallbackMessage(err) {
  const prismaCode = err?.code;
  if (typeof prismaCode === 'string' && PRISMA_MESSAGES[prismaCode]) return PRISMA_MESSAGES[prismaCode];
  if (err?.name === 'PrismaClientValidationError') return "That request wasn't formatted the way we expected.";
  return 'Something went wrong on our end. Please try again in a moment.';
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const isApp = err instanceof AppError;
  const status = isApp ? err.status : 500;
  const code = isApp ? err.code : 'INTERNAL_ERROR';
  const message = isApp ? err.message : fallbackMessage(err);

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} → ${status}`, { message: err.message, stack: err.stack });
  } else {
    logger.debug(`${req.method} ${req.originalUrl} → ${status}`, { message: err.message });
  }

  const body = { error: { code, message } };
  if (isApp && err.details) body.error.details = err.details;
  if (!isApp && !env.isProd) body.error.debug = err.message;

  res.status(status).json(body);
}

/** 404 for unmatched routes. */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` } });
}
