import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Spinner, ErrorState } from '@/components/common/States.jsx';
import { ImpactStats } from '@/components/carpool/ImpactStats.jsx';
import { Leaderboard } from '@/components/carpool/Leaderboard.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useAuthStore } from '@/stores/authStore.js';
import { carpoolApi } from '@/services/endpoints.js';

/**
 * Carpool impact & incentives (Feature 4): the viewer's personal savings plus the
 * site CO₂-savings leaderboard. The leaderboard window (week/month/all) is refetched
 * whenever it changes.
 */
export default function CarpoolImpactPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const [window, setWindow] = useState('week');

  const impact = useApi(() => carpoolApi.myImpact(), []);
  const board = useApi(() => carpoolApi.leaderboard({ window }), [window]);

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
        {impact.loading ? (
          <Spinner />
        ) : impact.error ? (
          <ErrorState error={impact.error} onRetry={impact.refetch} />
        ) : (
          <ImpactStats impact={impact.data} />
        )}
      </section>

      {board.loading && !board.data ? (
        <Spinner />
      ) : board.error ? (
        <ErrorState error={board.error} onRetry={board.refetch} />
      ) : (
        <Leaderboard rows={board.data || []} highlightUserId={userId} window={window} onWindowChange={setWindow} />
      )}
    </div>
  );
}
