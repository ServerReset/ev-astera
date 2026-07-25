import { lazy } from 'react';

const LeaderboardsPage = lazy(() => import('@/pages/leaderboards/LeaderboardsPage.jsx'));

/**
 * Leaderboards module manifest — carpool CO₂ savings + reliability standings for the whole site.
 * Realtime-tracks the trip logs and reliability events so the boards re-rank live as trips
 * complete and scores decay/update.
 */
export default {
  name: 'leaderboards',
  nav: [{ to: '/leaderboards', label: 'Boards', icon: 'Trophy', order: 30, roles: ['user'] }],
  routes: [{ path: '/leaderboards', element: LeaderboardsPage }],
  realtimeTables: ['carpool_trip_logs', 'reliability_events'],
};
