import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NavFloating } from './NavFloating.jsx';
import { Spinner } from '@/components/common/States.jsx';
import { ErrorBoundary } from '@/components/common/ErrorBoundary.jsx';
import { useNotificationSync } from '@/hooks/useNotificationSync.js';
import { OnboardingGate } from '@/components/onboarding/OnboardingGate.jsx';
import { CelebrationOverlay } from '@/components/achievements/CelebrationOverlay.jsx';
import { Aurora } from '@/components/common/Aurora.jsx';
import { useEasterEggs } from '@/hooks/useEasterEggs.js';

/**
 * Authenticated app shell. No top bar: navigation is a single floating M3 toolbar pinned to the
 * bottom of the viewport at every window size (NavFloating) — primary destinations plus an
 * Account sheet carrying settings/notifications/sign-out. Also boots the notification sync and
 * the first-run onboarding gate.
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
          {/* Route-level boundary: a single route's lazy chunk failing (common after a redeploy
              invalidates hashed chunk names for a stale tab) recovers here with a scoped reload
              instead of unwinding to the root boundary and white-screening the whole shell. Keyed
              on pathname so navigating away clears a prior route's error. */}
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
