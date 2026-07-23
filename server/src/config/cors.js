/**
 * CORS options. Client and API share one Vercel origin, but browsers still send an Origin
 * header on same-origin POST/PATCH/etc. requests (not just cross-origin ones), so that origin
 * has to be explicitly allowed. VERCEL_URL/VERCEL_PROJECT_PRODUCTION_URL are only injected when
 * a project setting ("Automatically expose System Environment Variables") is enabled, so they
 * can't be relied on. Instead, this compares Origin against the request's own Host header —
 * always correct for same-origin requests, with no dependence on env vars or hardcoded domains.
 */
const allowedLocal = new Set(['http://localhost:5173', 'http://localhost:4173']);

export const corsOptions = (req, callback) => {
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const isAllowed = !origin || allowedLocal.has(origin) || origin === `https://${host}`;
  callback(null, {
    origin: isAllowed,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
};
