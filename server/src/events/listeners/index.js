/**
 * Registers ALL event listeners: core listeners (audit + notification) plus every
 * module-contributed listener from the registry. Called once at boot.
 */
import { bus } from '../eventBus.js';
import { logger } from '../../utils/logger.js';
import { moduleListeners } from '../../modules/registry.js';
import { auditListeners } from './audit.listeners.js';
import { notificationListeners } from './notification.listeners.js';

export function registerListeners() {
  const core = [...auditListeners, ...notificationListeners];
  const all = [...core, ...moduleListeners];

  for (const { event, handler, module } of all) {
    bus.on(event, (payload) =>
      Promise.resolve(handler(payload)).catch((err) =>
        logger.error(`listener error on ${event}${module ? ` [${module}]` : ''}`, { message: err.message })
      )
    );
  }
  logger.info(`registered ${all.length} event listeners (${core.length} core, ${moduleListeners.length} module)`);
}
