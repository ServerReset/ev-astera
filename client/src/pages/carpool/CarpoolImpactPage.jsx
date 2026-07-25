import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Sprout, ArrowLeft, Trophy, Leaf } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Spinner, ErrorState, EmptyState } from '@/components/common/States.jsx';
import { ImpactStats } from '@/components/carpool/ImpactStats.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useCountUp } from '@/hooks/useCountUp.js';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { burstConfetti } from '@/utils/confetti.js';
import { carpoolApi } from '@/services/endpoints.js';

/**
 * Personal carpool impact — a hero CO₂-saved number on real liquid glass with a slow light drift,
 * a full count-up stat grid, and a jump to the leaderboards. The one hero moment on this screen.
 */
export default function CarpoolImpactPage() {
  const impact = useApi(() => carpoolApi.myImpact(), []);
  const co2 = impact.data?.co2Kg || 0;
  const co2Display = useCountUp(co2, { decimals: 1 });
  const glassRef = useLiquidGlass(Boolean(impact.data), { scale: -50, chroma: 3, blur: 6, saturate: 1.5, mapBlur: 20, border: 0.14 });
  const hasImpact = impact.data && impact.data.trips > 0;
  const leafRef = useRef(null);

  // Easter egg: tap the leaf to send up a puff of leaf-green confetti. A quiet little "thank you"
  // for anyone who bothers to poke the hero — no-op (reduced-motion safe) via burstConfetti.
  const cheerLeaf = () => {
    const r = leafRef.current?.getBoundingClientRect();
    burstConfetti({
      x: r ? r.left + r.width / 2 : undefined,
      y: r ? r.top + r.height / 2 : undefined,
      colors: ['#4ade80', '#22c55e', '#a3e635', '#bbf7d0', '#ffffff'],
      count: hasImpact ? 90 : 40,
    });
  };

  return (
    <div>
      <PageHeader
        title="Your impact"
        description="Every shared ride keeps a car off the road."
        icon={Sprout}
        action={
          <Link to="/carpool" className="btn-ghost btn-sm flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Carpool</span>
          </Link>
        }
      />

      {impact.loading && !impact.data ? (
        <Spinner label="Tallying your impact…" />
      ) : impact.error ? (
        <ErrorState error={impact.error} onRetry={impact.refetch} title="Could not load your impact" />
      ) : (
        <div className="space-y-6">
          {/* Hero CO2 number */}
          <div
            ref={glassRef}
            className="lg-hero relative overflow-hidden rounded-xl-increased border border-success/40 p-6 sm:p-8 animate-pop-in"
          >
            <div className="glass-drift pointer-events-none absolute inset-0" aria-hidden />
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-success/25 blur-3xl" aria-hidden />

            <div className="relative flex flex-col items-center text-center">
              <button
                ref={leafRef}
                type="button"
                onClick={cheerLeaf}
                aria-label="Celebrate your carbon savings"
                title="Give it a tap 🍃"
                className="grid h-14 w-14 place-items-center rounded-2xl bg-success/15 text-success animate-float transition-transform duration-medium ease-spring hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/80"
              >
                <Leaf className="h-7 w-7" />
              </button>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">CO₂ saved so far</p>
              <p className="text-gradient-brand text-6xl font-black tabular-nums sm:text-7xl">
                {co2Display}
                <span className="ml-2 text-2xl font-bold text-muted sm:text-3xl">kg</span>
              </p>
              <p className="mt-2 max-w-md text-sm text-muted">
                That's roughly {impact.data?.treesEquivalentPerMonth ?? 0} trees' worth of carbon breathed back in every month. Keep it up.
              </p>
            </div>
          </div>

          {/* Stat grid */}
          {hasImpact ? (
            <ImpactStats impact={impact.data} />
          ) : (
            <EmptyState
              icon={Sprout}
              title="Your impact starts with one ride"
              description="Offer or join a carpool and watch this fill up with the CO₂, miles, and credits you rack up."
              action={
                <Link to="/carpool" className="btn-primary btn-sm">Find a ride</Link>
              }
            />
          )}

          {/* Leaderboard link */}
          <Link
            to="/leaderboards"
            className="card card-interactive hover-sheen group flex items-center justify-between gap-3 rounded-xl-increased p-4"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-warning/15 text-warning transition-transform duration-medium ease-spring group-hover:scale-105">
                <Trophy className="h-6 w-6" />
              </span>
              <div>
                <p className="font-semibold text-content">See the leaderboards</p>
                <p className="text-sm text-muted">How does your impact stack up against the office?</p>
              </div>
            </div>
            <ArrowLeft className="h-5 w-5 rotate-180 text-faint transition-transform duration-medium ease-emphasized group-hover:translate-x-1" />
          </Link>
        </div>
      )}
    </div>
  );
}
