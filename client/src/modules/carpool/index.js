import { lazy } from 'react';

const CarpoolPage = lazy(() => import('@/pages/carpool/CarpoolPage.jsx'));
const CarpoolImpactPage = lazy(() => import('@/pages/carpool/CarpoolImpactPage.jsx'));

/** Carpool module — find/offer rides, personal requests + matches, recurring commutes, groups,
 * and a personal CO₂-impact page. */
export default {
  name: 'carpool',
  nav: [{ to: '/carpool', label: 'Carpool', icon: 'Car', order: 20, roles: ['user'] }],
  routes: [
    { path: '/carpool', element: CarpoolPage },
    { path: '/carpool/impact', element: CarpoolImpactPage },
  ],
  realtimeTables: ['carpool_rides', 'carpool_bookings', 'carpool_requests'],
};
