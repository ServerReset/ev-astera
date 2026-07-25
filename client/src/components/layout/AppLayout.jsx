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

      {/*
        UI intentionally blanked to the floating bar only (per request). The page content —
        <main> with the routed <Outlet> — is commented out below, NOT deleted: every page file and
        route still exists on disk, so restoring the full UI is just uncommenting this block (and
        re-adding OnboardingGate/CelebrationOverlay if desired). Only the aurora + NavFloating render.

      <OnboardingGate />
      <CelebrationOverlay />

      <main className="px-4 py-4 pb-28 sm:px-6 sm:py-6 sm:pb-28">
        <div className="mx-auto w-full max-w-6xl animate-fade-in">
          <ErrorBoundary scoped resetKey={pathname}>
            <Suspense fallback={<Spinner label="Loading…" />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      */}

      <NavFloating />
    </div>
  );
}
