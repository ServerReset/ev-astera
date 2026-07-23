/**
 * CORS options. In production, client and API share one Vercel origin (same-origin requests
 * carry no Origin header), so only local dev ports need to be whitelisted here.
 */
const allowed = new Set(['http://localhost:5173', 'http://localhost:4173']);

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
