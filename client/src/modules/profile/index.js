import { lazy } from 'react';

const SettingsPage = lazy(() => import('@/pages/SettingsPage.jsx'));

/** Settings module manifest — profile, notification prefs, and app settings (theme, onboarding
 *  replay). Reachable from the header avatar; not shown in the primary nav bar. */
export default {
  name: 'settings',
  nav: [],
  routes: [{ path: '/settings', element: SettingsPage }],
};
