import { lazy } from 'react';

const NotificationsPage = lazy(() => import('@/pages/NotificationsPage.jsx'));

/** Notifications module manifest — full history + push toggle. */
export default {
  name: 'notifications',
  nav: [{ to: '/notifications', label: 'Alerts', icon: 'Bell', order: 40, roles: ['user'] }],
  routes: [{ path: '/notifications', element: NotificationsPage }],
  realtimeTables: ['notifications'],
};
