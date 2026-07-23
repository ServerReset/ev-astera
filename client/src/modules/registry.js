/**
 * Client module registry — the mirror of server/src/modules/registry.js.
 * Each feature contributes nav items, routes, and the realtime tables it cares about.
 * To add a feature on the client: create a folder under modules/, export a manifest, and
 * add one import line here. Sidebar/BottomNav render from `nav`; App.jsx renders `routes`.
 */
import dashboard from './dashboard/index.js';
import carpool from './carpool/index.js';
import notifications from './notifications/index.js';
import profile from './profile/index.js';
import admin from './admin/index.js';

export const clientModules = [dashboard, carpool, notifications, profile, admin];

/** All routes flattened, in declaration order. */
export const allRoutes = clientModules.flatMap((m) => m.routes || []);

/** Nav items visible to a user with `role`, sorted by `order`. */
export function navForRole(role) {
  return clientModules
    .flatMap((m) => m.nav || [])
    .filter((item) => !item.roles || item.roles.includes(role) || (role === 'admin' && item.roles.includes('user')))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

/** Union of realtime tables declared across modules (documentation/dev aid). */
export const realtimeTables = [...new Set(clientModules.flatMap((m) => m.realtimeTables || []))];
