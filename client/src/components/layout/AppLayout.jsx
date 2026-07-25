import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NavFloating } from './NavFloating.jsx';
import { Spinner } from '@/components/common/States.jsx';
import { ErrorBoundary } from '@/components/common/ErrorBoundary.jsx';
import { Aurora } from '@/components/common/Aurora.jsx';
import { OnboardingGate } from '@/components/onboarding/OnboardingGate.jsx';
import { CelebrationOverlay } from '@/components/achievements/CelebrationOverlay.jsx';
import { useNotificationSync } from '@/hooks/useNotificationSync.js';
import { useEasterEggs } from '@/hooks/useEasterEggs.js';

/**
 * Authenticated app shell. Living aurora behind everything, a single floating M3 toolbar
 * (NavFloating) pinned to the bottom at every window size, and the routed page in between.
 * Boots notification sync + easter eggs; the onboarding gate and celebration overlay live here
 * so they're available on every authenticated route.
 */
export function AppLayout() {
  useNotificationSync();
  useEasterEggs();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-bg">
      <Aurora />
      <OnboardingGate />
      <CelebrationOverlay />

      <main className="px-4 py-4 pb-28 sm:px-6 sm:py-6 sm:pb-28">
        <div className="mx-auto w-full max-w-6xl animate-fade-in">
          {/* Route-level boundary: a single route's lazy chunk failing (e.g. a stale tab after a
              redeploy) recovers here with a scoped reload instead of white-screening the shell.
              Keyed on pathname so navigating away clears a prior route's error. */}
          <ErrorBoundary scoped resetKey={pathname}>
            <Suspense fallback={<Spinner label="Loading…" />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <NavFloating />
    </div>
  );
}
