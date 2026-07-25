import { lazy } from 'react';

const SettingsPage = lazy(() => import('@/pages/SettingsPage.jsx'));

/**
 * Settings module — the account/profile screen. Intentionally has NO nav entry: it's reached
 * from the floating bar's account icon → /settings, not from the primary nav rail.
 */
export default {
  name: 'settings',
  nav: [],
  routes: [{ path: '/settings', element: SettingsPage }],
};
