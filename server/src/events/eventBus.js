/** Singleton event bus. Services emit; listeners react (decoupled side-effects). */
import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';

class Bus extends EventEmitter {}

export const bus = new Bus();
bus.setMaxListeners(50);

/**
 * Emit a domain event and await every listener before returning. Never throws to the
 * caller — an individual listener's error is logged, not propagated, so one bad listener
 * can't fail the request. Awaited (not deferred via setImmediate) because on Vercel's
 * serverless runtime the execution environment can freeze right after the HTTP response is
 * sent, before a deferred callback gets a chance to run.
 */
export async function emit(event, payload = {}) {
  logger.debug(`event: ${event}`, { payload });
  const handlers = bus.listeners(event);
  await Promise.all(
    handlers.map((handler) =>
      Promise.resolve()
        .then(() => handler(payload))
        .catch((err) => logger.error(`event listener threw for ${event}`, { message: err.message }))
    )
  );
}
