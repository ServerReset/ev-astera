import { lazy } from 'react';

const AchievementsPage = lazy(() => import('@/pages/AchievementsPage.jsx'));

/** Achievements module manifest — the user's trophy case (badge wall + progress). */
export default {
  name: 'achievements',
  nav: [{ to: '/achievements', label: 'Badges', icon: 'Award', order: 40, roles: ['user'] }],
  routes: [{ path: '/achievements', element: AchievementsPage }],
};
