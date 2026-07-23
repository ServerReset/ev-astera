import { lazy } from 'react';

const ProfilePage = lazy(() => import('@/pages/ProfilePage.jsx'));

/** Profile module manifest — account, vehicle, stats, notification prefs. Reachable from the
 *  header avatar; not shown in the primary nav bar. */
export default {
  name: 'profile',
  nav: [],
  routes: [{ path: '/profile', element: ProfilePage }],
};
