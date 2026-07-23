/**
 * Vercel serverless entrypoint for the whole Express API. Module-top-level code runs once
 * per cold start (init), and the exported handler runs per request — Express's own router
 * handles everything else exactly as it does in local dev (server/src/index.js). Every
 * /api/* request is rewritten here by vercel.json (rewrite destinations don't overwrite
 * req.url — Vercel preserves the original request path so Express still sees the real route).
 */
import { assertConfig } from '../server/src/config/index.js';
import { createApp } from '../server/src/app.js';
import { registerListeners } from '../server/src/events/listeners/index.js';
import { initWebPush } from '../server/src/utils/pushUtils.js';
import { registerAllServices } from '../server/src/modules/registerServices.js';

assertConfig();
registerAllServices();
registerListeners();
initWebPush();
const app = createApp();

export default function handler(req, res) {
  return app(req, res);
}
