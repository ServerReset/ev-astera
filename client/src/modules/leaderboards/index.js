import { lazy } from 'react';

const LeaderboardsPage = lazy(() => import('@/pages/leaderboards/LeaderboardsPage.jsx'));

/** Leaderboards module manifest — carpool CO2/credits + reliability best/worst, one page. */
export default {
  name: 'leaderboards',
  nav: [{ to: '/leaderboards', label: 'Boards', icon: 'Trophy', order: 35, roles: ['user'] }],
  routes: [{ path: '/leaderboards', element: LeaderboardsPage }],
  realtimeTables: [],
};
