import { lazy } from 'react';

const ReservationsPage = lazy(() => import('@/pages/ReservationsPage.jsx'));

/** Reservations module manifest — book future charging windows. */
export default {
  name: 'reservations',
  nav: [{ to: '/reservations', label: 'Reserve', icon: 'CalendarClock', order: 20, roles: ['user'] }],
  routes: [{ path: '/reservations', element: ReservationsPage }],
  realtimeTables: ['reservations'],
};
