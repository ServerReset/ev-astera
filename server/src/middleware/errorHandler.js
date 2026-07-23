/** Global error handler (last middleware). Formats the error envelope from docs/CONTRACTS.md §3. */
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/index.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const isApp = err instanceof AppError;
  const status = isApp ? err.status : 500;
  const code = isApp ? err.code : 'INTERNAL_ERROR';
  const message = isApp ? err.message : 'Something went wrong';

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
