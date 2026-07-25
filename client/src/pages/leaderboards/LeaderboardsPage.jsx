import { useState } from 'react';
import { Trophy, Leaf, Route } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { ErrorState } from '@/components/common/States.jsx';
import { Leaderboard } from '@/components/carpool/Leaderboard.jsx';
import { ReliabilityLeaderboard } from '@/components/leaderboards/ReliabilityLeaderboard.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useCountUp } from '@/hooks/useCountUp.js';
import { useAuthStore } from '@/stores/authStore.js';
import { carpoolApi, reliabilityApi } from '@/services/endpoints.js';

/** Site-wide total that counts up from 0 (re-animates when the window filter changes). */
function TotalValue({ value, decimals = 0, suffix = '' }) {
  const n = useCountUp(value, { decimals });
  return (
    <span className="tabular-nums">
      {n.toLocaleString(undefined, { maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

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
      <div className="animate-fade-in">
        <PageHeader title="Leaderboards" description="Best and worst performers across charging and carpooling." icon={Trophy} />
      </div>

      <Card className="animate-slide-up [animation-fill-mode:backwards]">
        <CardHeader title="Site-wide savings" subtitle="Carpool-derived CO₂ and trips this window" icon={Leaf} />
        {totals.loading && !totals.data ? (
          <div className="skeleton h-16 rounded-xl" />
        ) : totals.error ? (
          <ErrorState error={totals.error} onRetry={totals.refetch} title="Could not load savings" />
        ) : (
          <div className="stagger grid grid-cols-2 gap-3">
            <div className="card-solid hover-sheen group relative overflow-hidden rounded-2xl p-3.5">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-success/20 blur-2xl transition-transform duration-medium ease-emphasized group-hover:scale-125" aria-hidden />
              <span className="mb-1.5 grid h-8 w-8 place-items-center rounded-xl bg-success/15 text-success transition-transform duration-medium ease-spring group-hover:scale-110">
                <Leaf className="h-4 w-4" />
              </span>
              <p className="text-3xl font-bold tabular-nums text-gradient-brand">
                <TotalValue value={totals.data?.co2Kg ?? 0} decimals={1} suffix=" kg" />
              </p>
              <p className="text-xs text-muted">CO₂ saved</p>
            </div>
            <div className="card-solid hover-sheen group relative overflow-hidden rounded-2xl p-3.5">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand/20 blur-2xl transition-transform duration-medium ease-emphasized group-hover:scale-125" aria-hidden />
              <span className="mb-1.5 grid h-8 w-8 place-items-center rounded-xl bg-brand/12 text-brand-strong transition-transform duration-medium ease-spring group-hover:scale-110">
                <Route className="h-4 w-4" />
              </span>
              <p className="text-3xl font-bold tabular-nums text-content">
                <TotalValue value={totals.data?.trips ?? 0} />
              </p>
              <p className="text-xs text-muted">Carpool trips</p>
            </div>
          </div>
        )}
      </Card>

      <div className="animate-slide-up [animation-fill-mode:backwards] [animation-delay:80ms]">
        {carpoolBoard.loading && !carpoolBoard.data ? (
          <div className="skeleton h-80 rounded-2xl" />
        ) : carpoolBoard.error ? (
          <ErrorState error={carpoolBoard.error} onRetry={carpoolBoard.refetch} title="Could not load the carpool leaderboard" />
        ) : (
          <Leaderboard rows={carpoolBoard.data || []} highlightUserId={userId} window={window} onWindowChange={setWindow} />
        )}
      </div>

      <div className="animate-slide-up [animation-fill-mode:backwards] [animation-delay:160ms]">
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
    </div>
  );
}
