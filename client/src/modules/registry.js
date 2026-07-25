/**
 * Client module registry — the mirror of server/src/modules/registry.js.
 * Each feature contributes nav items, routes, and the realtime tables it cares about.
 * To add a feature on the client: create a folder under modules/, export a manifest, and
 * add one import line here. NavFloating renders from `nav`; App.jsx renders `routes`.
 */
import { ADMIN_ROLES } from '@shared/constants.js';

// Feature modules removed — the app UI has been stripped down to the floating nav bar + aurora
// shell. Re-registering a feature is one import + one array entry here (see git history for the
// prior manifests). With no modules, allRoutes is [] and navForRole returns [], so App.jsx renders
// the authenticated shell with no page content and NavFloating shows just the logo + account.
export const clientModules = [];

/** All routes flattened, in declaration order. */
export const allRoutes = clientModules.flatMap((m) => m.routes || []);

/** Nav items visible to a user with `role`, sorted by `order`. Either admin role also sees
 * every 'user'-gated item — an admin never loses access to ordinary-user destinations. */
export function navForRole(role) {
  return clientModules
    .flatMap((m) => m.nav || [])
    .filter((item) => !item.roles || item.roles.includes(role) || (ADMIN_ROLES.includes(role) && item.roles.includes('user')))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

/** Union of realtime tables declared across modules (documentation/dev aid). */
export const realtimeTables = [...new Set(clientModules.flatMap((m) => m.realtimeTables || []))];
