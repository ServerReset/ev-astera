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
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  // Only failed attempts count toward the limit — successful logins/registrations (and
  // retries after a typo) shouldn't burn down the same budget as a brute-force attempt.
  // This matters a lot behind a shared office IP (many people, one NAT address) where the
  // old count-everything limiter could lock out the whole site from 10 login attempts/min.
  skipSuccessfulRequests: true,
  handler: jsonError('Too many failed attempts. Try again in a minute.'),
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
