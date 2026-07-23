/**
 * The shared context object handed to every module's `routes(router, ctx)`.
 * Modules reach shared singletons through this instead of deep-importing each other.
 */
import { services } from '../../services/index.js';
import { configService } from '../../services/config.service.js';
import { bus, emit } from '../../events/eventBus.js';
import { EVENTS } from '../../events/events.js';
import { dispatchNotification, dispatchBulk } from '../../providers/notifications/index.js';

export const moduleContext = {
  services,
  config: configService,
  bus,
  emit,
  EVENTS,
  dispatchNotification,
  dispatchBulk,
};
