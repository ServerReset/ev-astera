import { lazy } from 'react';

const NotificationsPage = lazy(() => import('@/pages/NotificationsPage.jsx'));

/** Notifications module manifest — the alerts inbox (queue turns, nudges, emergencies, etc.). */
export default {
  name: 'notifications',
  nav: [{ to: '/notifications', label: 'Alerts', icon: 'Bell', order: 50, roles: ['user'] }],
  routes: [{ path: '/notifications', element: NotificationsPage }],
  realtimeTables: ['notifications'],
};
