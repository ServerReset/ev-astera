import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { NavFloating } from './NavFloating.jsx';
import { BottomNav } from './BottomNav.jsx';
import { Spinner } from '@/components/common/States.jsx';
import { useNotificationSync } from '@/hooks/useNotificationSync.js';
import { OnboardingGate } from '@/components/onboarding/OnboardingGate.jsx';

/**
 * Authenticated app shell. No top bar: on mobile (<sm) a floating bottom nav pill carries
 * primary destinations + an Account sheet; on sm+ a floating collapsed icon strip + overlay
 * drawer (NavFloating) carries navigation and the account/settings/notifications/sign-out menu
 * that used to live in Header's dropdown. Also boots the notification sync and the first-run
 * onboarding gate.
 */
export function AppLayout() {
  useNotificationSync();

  return (
    <div className="min-h-screen bg-bg">
      <OnboardingGate />
      <NavFloating />

      <main className="px-4 py-4 pb-24 sm:pl-28 sm:pr-6 sm:py-6 sm:pb-8">
        <div className="mx-auto w-full max-w-6xl animate-fade-in">
          <Suspense fallback={<Spinner label="Loading…" />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
