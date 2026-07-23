import { lazy } from 'react';

const AdminPage = lazy(() => import('@/pages/admin/AdminPage.jsx'));

/** Admin module manifest — admin-only. The nav entry is filtered out for non-admins by the
 *  registry's role check, and the route is additionally guarded by <RequireAdmin>. */
export default {
  name: 'admin',
  nav: [{ to: '/admin', label: 'Admin', icon: 'ShieldCheck', order: 90, roles: ['admin'] }],
  routes: [{ path: '/admin', element: AdminPage, roles: ['admin'] }],
  realtimeTables: ['chargers', 'sessions', 'queue_entries', 'announcements'],
};
