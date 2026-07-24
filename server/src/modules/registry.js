/**
 * THE module registry — the single list of active feature modules.
 *
 * To add a feature: create server/src/modules/<name>/index.js exporting defineModule(...),
 * then add one import + one array entry here. The core (app.js, jobs, listeners) iterates
 * this list and wires everything up. Nothing else in the core changes.
 *
 * Order matters only for route mounting precedence; keep auth/user first for clarity.
 */
import authModule from './auth/index.js';
import userModule from './user/index.js';
import chargerModule from './charger/index.js';
import sessionModule from './session/index.js';
import queueModule from './queue/index.js';
import notificationModule from './notification/index.js';
import messageModule from './message/index.js';
import carpoolModule from './carpool/index.js';
import reliabilityModule from './reliability/index.js';
import adminModule from './admin/index.js';

export const modules = [
  authModule,
  userModule,
  chargerModule,
  sessionModule,
  queueModule,
  notificationModule,
  messageModule,
  carpoolModule,
  reliabilityModule,
  adminModule,
];

/** All listeners contributed by modules, flattened. */
export const moduleListeners = modules.flatMap((m) => m.listeners.map((l) => ({ ...l, module: m.name })));

/** All Realtime tables modules expect (for docs / health output). */
export const realtimeTables = [...new Set(modules.flatMap((m) => m.realtimeTables))];
