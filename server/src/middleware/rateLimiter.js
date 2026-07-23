/** Rate limiters. Global + stricter auth limiter. Custom per-endpoint limiters compose these. */
import rateLimit from 'express-rate-limit';

const jsonError = (message) => (req, res) =>
  res.status(429).json({ error: { code: 'RATE_LIMITED', message } });

export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many requests. Please slow down.'),
});

export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonError('Too many auth attempts. Try again shortly.'),
});

/** Factory for tighter per-feature limits (e.g. nudges). */
export const makeLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonError(message || 'Too many requests.'),
  });
