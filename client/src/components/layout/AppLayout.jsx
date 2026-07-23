import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { NavFloating } from './NavFloating.jsx';
import { Spinner } from '@/components/common/States.jsx';
import { useNotificationSync } from '@/hooks/useNotificationSync.js';
import { OnboardingGate } from '@/components/onboarding/OnboardingGate.jsx';

/**
 * Authenticated app shell. No top bar: navigation is a single floating M3 toolbar pinned to the
 * bottom of the viewport at every window size (NavFloating) — primary destinations plus an
 * Account sheet carrying settings/notifications/sign-out. Also boots the notification sync and
 * the first-run onboarding gate.
 */
export function AppLayout() {
  useNotificationSync();

  return (
    <div className="min-h-screen bg-bg">
      <OnboardingGate />

      <main className="px-4 py-4 pb-28 sm:px-6 sm:py-6 sm:pb-28">
        <div className="mx-auto w-full max-w-6xl animate-fade-in">
          <Suspense fallback={<Spinner label="Loading…" />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <NavFloating />
    </div>
  );
}
