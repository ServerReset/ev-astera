import { NavLink } from 'react-router-dom';
import { User } from 'lucide-react';
import { navForRole } from '@/modules/registry.js';
import { useAuthStore } from '@/stores/authStore.js';
import { Icon } from '@/components/common/Icon.jsx';
import { AsteraMark } from '@/components/common/AsteraMark.jsx';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { cn } from '@/utils/cn.js';

/**
 * M3 floating toolbar (https://m3.material.io/components/toolbars/overview) — one bottom-floating
 * nav bar for every window size: a compact pill inset from the screen edges, never docked flush
 * against an edge like a navigation bar. Primary destinations plus an Account entry that goes
 * straight to Settings — no intermediate popup (Settings already has notification prefs and
 * sign-out; Alerts already has its own nav destination, so the popup only added an extra tap).
 *
 * Adaptive labels: icon-only circular pills on phones/tablets (thumb-sized targets, minimal
 * chrome), and — from `lg` up, where there's room and a pointer — each destination expands into a
 * label + icon pill so a wide screen reads as a proper labeled toolbar instead of a lonely row of
 * glyphs. The active item always shows its label so the current place is named at every size.
 *
 * Two-row wrap: instead of scrolling sideways when the pills don't fit (an easy-to-miss, awkward
 * interaction on a phone), the bar wraps onto a second centered row. `flex-wrap` + the max-width
 * ceiling makes it break exactly when it would otherwise overflow; the softly-rounded (not fully
 * circular) shape stays graceful whether it's one row tall or two. AppLayout reserves the matching
 * bottom clearance so content never tucks under a two-row bar.
 */

/** One destination pill. Below `lg` every pill is a uniform 44px icon-only circle (active shown by
 *  tint alone — never a width change, so the row layout is identical on every route and can't shuffle
 *  when you navigate). At `lg`↑ pills expand to label + icon so a wide screen reads as a labeled
 *  toolbar. `icon` is the lucide-name string or a render node. */
function NavPill({ to, end, label, iconName, iconNode, className }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'group relative flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-full px-0',
          'lg:w-auto lg:px-3.5',
          'transition-[background-color,transform] duration-medium ease-emphasized active:scale-90',
          isActive
            ? 'bg-brand/15 text-brand-strong'
            : 'text-faint hover:bg-surface-2 hover:text-content',
          className
        )
      }
    >
      {iconNode || <Icon name={iconName} className="h-5 w-5 shrink-0" />}
      <span className="hidden text-label-lg font-medium whitespace-nowrap lg:inline">{label}</span>
    </NavLink>
  );
}

export function NavFloating() {
  const role = useAuthStore((s) => s.user?.role) || 'user';
  const nav = navForRole(role).slice(0, 5);
  const glassRef = useLiquidGlass(true, { scale: -30, chroma: 1.5, blur: 6, border: 0.14, mapBlur: 16 });

  // Below `lg` all cells are uniform 44px icons with a 4px gap inside 8px padding. Cap the bar's
  // width to exactly ceil(n/2) cells so, when it can't fit one row, it wraps into two EVEN rows
  // (e.g. 7 cells → 4 + 3) instead of a lopsided greedy split. At lg the cap is dropped for the
  // labeled single-row toolbar. n = home + nav items + settings.
  // box-sizing is border-box, so the cap must include padding (8px×2) AND border (1px×2); +2px
  // safety absorbs sub-pixel rounding that would otherwise bump the last cell to a new row.
  const cells = 1 + nav.length + 1;
  const perRow = Math.ceil(cells / 2);
  const capPx = perRow * 44 + (perRow - 1) * 4 + 20; // cells + inner gaps + padding + border + fudge

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
    >
      <nav
        ref={glassRef}
        aria-label="Primary"
        style={{ '--nav-cap': `${capPx}px` }}
        className="lg-panel flex max-w-[var(--nav-cap)] flex-wrap items-center justify-center gap-1 rounded-[1.75rem] border border-border p-2 shadow-elevation-2 lg:max-w-[calc(100vw-2rem)] lg:gap-1.5 lg:rounded-full lg:p-2.5"
      >
        <NavLink to="/" aria-label="EV Hub home" title="EV Hub home" className="group grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform duration-medium ease-spring hover:scale-110 active:scale-90">
          <AsteraMark size={26} />
        </NavLink>

        {nav.map((item) => (
          <NavPill key={item.to} to={item.to} end={item.end} label={item.label} iconName={item.icon} />
        ))}

        <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-border/70 lg:block" aria-hidden />

        <NavPill to="/settings" label="Settings" iconNode={<User className="h-5 w-5 shrink-0" />} />
      </nav>
    </div>
  );
}
