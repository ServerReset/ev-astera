/**
 * Express app factory. Applies security middleware, then mounts every module's routes
 * from the registry under the correct scope. The core never imports a domain directly.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { corsOptions } from './config/cors.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { authenticate } from './middleware/authenticate.js';
import { locationScope } from './middleware/locationScope.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { modules, realtimeTables } from './modules/registry.js';
import { moduleContext } from './modules/_kit/moduleContext.js';
import { ok } from './utils/respond.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Render/Vercel sit behind a proxy — needed for rate-limit IPs
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use(globalLimiter);

  // Health check (no auth) — used by uptime pings to defeat Render cold starts.
  app.get('/api/health', (_req, res) =>
    ok(res, { status: 'ok', time: new Date().toISOString(), realtimeTables })
  );

  // Mount each module.
  for (const mod of modules) {
    const router = express.Router({ mergeParams: true });
    mod.routes(router, moduleContext);

    if (mod.scope === 'root') {
      app.use(`/api${mod.basePath}`, router);
      logger.info(`mounted module "${mod.name}" at /api${mod.basePath}`);
    } else {
      // location-scoped: authenticate + validate location before the module's routes
      app.use(`/api/locations/:locationId${mod.basePath}`, authenticate, locationScope, router);
      logger.info(`mounted module "${mod.name}" at /api/locations/:locationId${mod.basePath}`);
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
