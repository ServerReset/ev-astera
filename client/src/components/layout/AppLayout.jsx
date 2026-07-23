import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { BottomNav } from './BottomNav.jsx';
import { Header } from './Header.jsx';
import { Spinner } from '@/components/common/States.jsx';
import { useNotificationSync } from '@/hooks/useNotificationSync.js';
import { OnboardingGate } from '@/components/onboarding/OnboardingGate.jsx';

/**
 * Authenticated app shell: sidebar (desktop) + bottom nav (mobile) + header, with the routed
 * page rendered in the main region. Also boots the notification realtime/refresh sync and the
 * first-run onboarding gate.
 */
export function AppLayout() {
  useNotificationSync();

  return (
    <div className="flex min-h-screen bg-bg">
      <OnboardingGate />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
          <div className="mx-auto w-full max-w-5xl">
            <Suspense fallback={<Spinner label="Loading…" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
