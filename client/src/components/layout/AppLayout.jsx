import { NavFloating } from './NavFloating.jsx';
import { Aurora } from '@/components/common/Aurora.jsx';
import { useEasterEggs } from '@/hooks/useEasterEggs.js';

/**
 * Authenticated app shell — stripped to the essentials. The feature UI (dashboard, carpool,
 * leaderboards, settings, admin, etc.) has been removed; all that renders is the living aurora
 * background and the floating M3 nav bar. NavFloating reads its items from the (now-empty) module
 * registry, so it shows just the logo + account entry. Restoring the full app = repopulate
 * modules/registry.js and reinstate the routed <Outlet>/overlays here (see git history).
 */
export function AppLayout() {
  useEasterEggs();

  return (
    <div className="min-h-screen bg-bg">
      <Aurora />
      <NavFloating />
    </div>
  );
}
