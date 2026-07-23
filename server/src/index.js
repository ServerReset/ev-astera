/**
 * Local-dev-only entrypoint (per docs/ARCHITECTURE.md). Production runs as Vercel serverless
 * functions (api/[[...path]].js for the app, api/cron/daily.js for the daily cron) — neither
 * of those calls listen() or needs a persistent process.
 */
import { env, assertConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { createApp } from './app.js';
import { registerListeners } from './events/listeners/index.js';
import { initWebPush } from './utils/pushUtils.js';
import { registerAllServices } from './modules/registerServices.js';

async function boot() {
  assertConfig();

  // 1. Register each module's service into the shared registry (so listeners can reach them).
  registerAllServices();

  // 2. Build the app (mounts module routes).
  const app = createApp();

  // 3. Wire event listeners (core + module).
  registerListeners();

  // 4. Web Push.
  initWebPush();

  // 5. Listen.
  app.listen(env.port, () => {
    logger.info(`EV Charger Hub API listening on :${env.port} (${env.nodeEnv})`);
  });
}

boot().catch((err) => {
  logger.error('Fatal boot error', { message: err.message, stack: err.stack });
  process.exit(1);
});

// Never let an unhandled rejection crash the process silently.
process.on('unhandledRejection', (reason) => logger.error('unhandledRejection', { reason: String(reason) }));
process.on('uncaughtException', (err) => logger.error('uncaughtException', { message: err.message }));
