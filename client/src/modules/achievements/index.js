import { lazy } from 'react';

const AchievementsPage = lazy(() => import('@/pages/AchievementsPage.jsx'));

/** Achievements module manifest — the badge wall. Not in the primary nav bar (which is fixed and
 * untouchable); reached from the Settings profile section and a dashboard teaser. */
export default {
  name: 'achievements',
  nav: [],
  routes: [{ path: '/achievements', element: AchievementsPage }],
};
