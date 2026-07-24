import { useState } from 'react';
import { Trophy, Leaf } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { ErrorState } from '@/components/common/States.jsx';
import { Leaderboard } from '@/components/carpool/Leaderboard.jsx';
import { ReliabilityLeaderboard } from '@/components/leaderboards/ReliabilityLeaderboard.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useAuthStore } from '@/stores/authStore.js';
import { carpoolApi, reliabilityApi } from '@/services/endpoints.js';

/**
 * Dedicated leaderboards home: carpool CO₂/credits (relocated from CarpoolImpactPage, which
 * now only teases it), reliability best/worst, and a site-wide energy/CO₂ savings summary.
 */
export default function LeaderboardsPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const [window, setWindow] = useState('week');

  const carpoolBoard = useApi(() => carpoolApi.leaderboard({ window }), [window]);
  // A true site-wide aggregate, not a sum over the leaderboard's own top-50-capped rows —
  // summing the capped array would silently understate totals past 50 active carpoolers.
  const totals = useApi(() => carpoolApi.leaderboardTotals({ window }), [window]);
  const reliabilityBoard = useApi(() => reliabilityApi.leaderboard(10), []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Leaderboards" description="Best and worst performers across charging and carpooling." icon={Trophy} />

      <Card>
        <CardHeader title="Site-wide savings" subtitle="Carpool-derived CO₂ and trips this window" icon={Leaf} />
        {totals.loading && !totals.data ? (
          <div className="skeleton h-16 rounded-xl" />
        ) : totals.error ? (
          <ErrorState error={totals.error} onRetry={totals.refetch} title="Could not load savings" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-bg-elevated p-3">
              <p className="text-2xl font-bold text-success tabular-nums">{totals.data?.co2Kg ?? 0} kg</p>
              <p className="text-xs text-muted">CO₂ saved</p>
            </div>
            <div className="rounded-xl bg-bg-elevated p-3">
              <p className="text-2xl font-bold text-content tabular-nums">{totals.data?.trips ?? 0}</p>
              <p className="text-xs text-muted">Carpool trips</p>
            </div>
          </div>
        )}
      </Card>

      {carpoolBoard.loading && !carpoolBoard.data ? (
        <div className="skeleton h-80 rounded-2xl" />
      ) : carpoolBoard.error ? (
        <ErrorState error={carpoolBoard.error} onRetry={carpoolBoard.refetch} title="Could not load the carpool leaderboard" />
      ) : (
        <Leaderboard rows={carpoolBoard.data || []} highlightUserId={userId} window={window} onWindowChange={setWindow} />
      )}

      {reliabilityBoard.loading && !reliabilityBoard.data ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      ) : reliabilityBoard.error ? (
        <ErrorState error={reliabilityBoard.error} onRetry={reliabilityBoard.refetch} title="Could not load the reliability leaderboard" />
      ) : (
        <ReliabilityLeaderboard data={reliabilityBoard.data} highlightUserId={userId} />
      )}
    </div>
  );
}
