/**
 * Queue listeners: react to session/charger lifecycle to keep the line moving.
 *   - SESSION_STARTED  → the starter's claimed/notified entry is fulfilled.
 *   - SESSION_ENDED    → the charger is free; advance to the next person.
 *   - CHARGER_ONLINE   → a charger came back; advance.
 */
import { EVENTS } from '../../events/events.js';
import { queueService } from './queue.service.js';

export const queueListeners = [
  {
    event: EVENTS.SESSION_STARTED,
    handler: async (p) => {
      await queueService.fulfillForUser(p.userId);
    },
  },
  {
    event: EVENTS.SESSION_ENDED,
    handler: async (p) => {
      await queueService.advance(p.locationId, p.chargerId);
    },
  },
  {
    event: EVENTS.CHARGER_ONLINE,
    handler: async (p) => {
      await queueService.advance(p.locationId, p.chargerId);
    },
  },
];
