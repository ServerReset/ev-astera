/**
 * Vercel serverless entrypoint for the whole Express API. Module-top-level code runs once
 * per cold start (init), and the exported handler runs per request — Express's own router
 * handles everything else exactly as it does in local dev (server/src/index.js). Every
 * /api/* request is rewritten here by vercel.json (rewrite destinations don't overwrite
 * req.url — Vercel preserves the original request path so Express still sees the real route).
 *
 * Init is wrapped in try/catch: if it throws at cold start (e.g. a required env var is missing,
 * so assertConfig() throws, or the Prisma client wasn't generated in the build), an UNCAUGHT
 * throw here crashes the whole function and Vercel returns an opaque FUNCTION_INVOCATION_FAILED
 * page — bypassing our Express error handler, so the real reason is invisible. Instead we capture
 * the init error and serve a readable JSON 500 that names the cause, so a broken deploy is
 * diagnosable from the response itself (and healthy requests are completely unaffected).
 */
import { assertConfig } from '../server/src/config/index.js';
import { createApp } from '../server/src/app.js';
import { registerListeners } from '../server/src/events/listeners/index.js';
import { initWebPush } from '../server/src/utils/pushUtils.js';
import { registerAllServices } from '../server/src/modules/registerServices.js';

let app = null;
let initError = null;

try {
  assertConfig();
  registerAllServices();
  registerListeners();
  initWebPush();
  app = createApp();
} catch (err) {
  initError = err;
  // Surface it in the Vercel function logs too.
  // eslint-disable-next-line no-console
  console.error('[api] init failed at cold start:', err);
}

export default function handler(req, res) {
  if (initError) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: {
          code: 'INIT_FAILED',
          message: 'The API failed to start. This is a deploy/configuration problem, not a bug in the request.',
          debug: initError?.message || String(initError),
        },
      })
    );
    return undefined;
  }
  return app(req, res);
}
