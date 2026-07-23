import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { NavRail } from './NavRail.jsx';
import { BottomNav } from './BottomNav.jsx';
import { Header } from './Header.jsx';
import { Spinner } from '@/components/common/States.jsx';
import { useNotificationSync } from '@/hooks/useNotificationSync.js';
import { OnboardingGate } from '@/components/onboarding/OnboardingGate.jsx';

/**
 * Authenticated app shell with a Material 3 adaptive nav that changes form factor by window
 * class: bottom navigation bar on compact (<600), navigation rail on medium (600–839), and a
 * permanent navigation drawer on expanded (≥840). Exactly one is visible at any width — each
 * component self-hides via its own breakpoint utilities. Also boots the notification sync and
 * the first-run onboarding gate.
 */
export function AppLayout() {
  useNotificationSync();

  return (
    <div className="flex min-h-screen bg-bg">
      <OnboardingGate />

      {/* Expanded (≥840): permanent drawer. Medium (600–839): rail. */}
      <Sidebar />
      <NavRail />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-4 py-4 pb-24 medium:px-6 medium:py-6 medium:pb-8">
          <div className="mx-auto w-full max-w-6xl animate-fade-in">
            <Suspense fallback={<Spinner label="Loading…" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Compact (<600): bottom bar. */}
      <BottomNav />
    </div>
  );
}
