import { Link } from 'react-router-dom';
import { Leaf, ArrowLeft, Trophy, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { ErrorState } from '@/components/common/States.jsx';
import { ImpactStats } from '@/components/carpool/ImpactStats.jsx';
import { useApi } from '@/hooks/useApi.js';
import { carpoolApi } from '@/services/endpoints.js';

/** Skeleton matching the 6-tile ImpactStats grid so there's no layout jump on load. */
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton h-[76px] rounded-2xl" />
      ))}
    </div>
  );
}

/**
 * Carpool impact & incentives (Feature 4): the viewer's personal savings plus the
 * site CO₂-savings leaderboard. The leaderboard window (week/month/all) is refetched
 * whenever it changes — useApi now discards out-of-order responses, so a fast window
 * switch can't leave a stale board under the wrong label.
 */
export default function CarpoolImpactPage() {
  const impact = useApi(() => carpoolApi.myImpact(), []);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Your impact"
        description="What carpooling has saved — for you and the whole site."
        icon={Leaf}
        action={
          <Link to="/carpool" className="btn-ghost btn-sm">
            <ArrowLeft className="h-4 w-4" />
            Carpool
          </Link>
        }
      />

      <section className="mb-6">
        {impact.loading && !impact.data ? (
          <StatsSkeleton />
        ) : impact.error ? (
          <ErrorState error={impact.error} onRetry={impact.refetch} title="Could not load your impact" />
        ) : (
          <div className="animate-fade-in">
            <ImpactStats impact={impact.data} />
          </div>
        )}
      </section>

      <Link to="/leaderboards" className="block">
        <Card className="transition-colors hover:bg-surface-2">
          <CardHeader
            title="Leaderboards"
            subtitle="See best/worst performers across carpool and reliability"
            icon={Trophy}
            action={<ChevronRight className="h-5 w-5 shrink-0 text-faint" />}
          />
        </Card>
      </Link>
    </div>
  );
}
