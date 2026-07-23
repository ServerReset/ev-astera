/**
 * CORS options. Client and API share one Vercel origin, but browsers still send an Origin
 * header on same-origin POST/PATCH/etc. requests (not just cross-origin ones), so that
 * origin has to be explicitly allowed — not just local dev ports. Vercel injects VERCEL_URL
 * (current deployment) and VERCEL_PROJECT_PRODUCTION_URL (stable production alias) as system
 * env vars at runtime, so both are picked up automatically without hardcoding a domain that
 * changes across deployments/aliases.
 */
const allowed = new Set(['http://localhost:5173', 'http://localhost:4173']);
for (const host of [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
  if (host) allowed.add(`https://${host}`);
}

export const corsOptions = {
  origin(origin, callback) {
    // Allow same-origin / server-to-server (no Origin header) and whitelisted origins.
    if (!origin || allowed.has(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
