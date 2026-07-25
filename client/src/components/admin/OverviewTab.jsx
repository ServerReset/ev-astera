import { Activity, Users, Timer, Zap, Car, Leaf } from 'lucide-react';
import { StatTile } from './adminShared.jsx';
import { Spinner, ErrorState } from '@/components/common/States.jsx';

/**
 * Admin Overview — glass stat tiles with count-up. One tile (CO₂ saved) gets the brand-gradient
 * hero treatment; the rest lift + sheen on hover. Reads adminApi.overview().
 */
export function OverviewTab({ overview }) {
  if (overview.loading && !overview.data) return <Spinner label="Loading overview…" />;
  if (overview.error) return <ErrorState error={overview.error} onRetry={overview.refetch} title="Could not load overview" />;
  const d = overview.data || {};

  const tiles = [
    { icon: Activity, label: 'Active sessions', value: d.activeSessions, tone: 'info' },
    { icon: Timer, label: 'Waiting in queue', value: d.queueWaiting, tone: 'warning' },
    { icon: Users, label: 'Active members', value: d.activeUsers, tone: 'brand' },
    { icon: Zap, label: 'Sessions (last 24h)', value: d.sessionsLast24h, tone: 'brand' },
    { icon: Car, label: 'Open carpool rides', value: d.carpoolOpenRides, tone: 'info' },
    { icon: Leaf, label: 'CO₂ saved this week', value: d.carpoolCo2KgThisWeek, decimals: 1, suffix: 'kg', tone: 'success', hero: true },
  ];

  return (
    <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t) => (
        <StatTile key={t.label} {...t} />
      ))}
    </div>
  );
}
