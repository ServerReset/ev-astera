import { lazy } from 'react';

const CarpoolPage = lazy(() => import('@/pages/carpool/CarpoolPage.jsx'));
const CarpoolImpactPage = lazy(() => import('@/pages/carpool/CarpoolImpactPage.jsx'));

/**
 * Carpool module manifest — mirrors the server carpool module. Contributes the main
 * carpool nav entry (rides/requests/schedules/groups) and the impact/leaderboard sub-route.
 */
export default {
  name: 'carpool',
  nav: [{ to: '/carpool', label: 'Carpool', icon: 'Car', order: 30, roles: ['user'] }],
  routes: [
    { path: '/carpool', element: CarpoolPage },
    { path: '/carpool/impact', element: CarpoolImpactPage },
  ],
  realtimeTables: ['carpool_rides', 'carpool_bookings'],
};
