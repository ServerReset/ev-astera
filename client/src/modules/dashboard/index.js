import { lazy } from 'react';

const DashboardPage = lazy(() => import('@/pages/DashboardPage.jsx'));

/** Dashboard module manifest — the home screen (chargers, queue, my session). */
export default {
  name: 'dashboard',
  nav: [{ to: '/', label: 'Dashboard', icon: 'LayoutDashboard', order: 10, roles: ['user'], end: true }],
  routes: [{ path: '/', element: DashboardPage }],
  realtimeTables: ['chargers', 'sessions', 'queue_entries'],
};
