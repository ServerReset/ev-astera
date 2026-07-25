import { lazy } from 'react';

const AdminPage = lazy(() => import('@/pages/admin/AdminPage.jsx'));

/**
 * Admin module manifest — the operator console. NOT in the nav bar (reached from Settings);
 * the single route is admin-gated, so App.jsx wraps it in <RequireAdmin/> automatically
 * because its `roles` include an admin role.
 */
export default {
  name: 'admin',
  nav: [],
  routes: [{ path: '/admin', element: AdminPage, roles: ['site_admin', 'super_admin'] }],
  realtimeTables: ['chargers', 'sessions', 'queue_entries'],
};
