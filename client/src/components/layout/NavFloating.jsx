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
 * The signature move: the ACTIVE destination's pill smoothly expands to show its name — the icon
 * stays a fixed 44px square and the label slides open beside it via an animatable
 * grid-template-columns 0fr→1fr reveal (not a width:auto snap), so the current place is always
 * named and the expand/collapse glides as you navigate. At `lg`↑ every pill shows its label, so a
 * wide screen reads as a full labeled toolbar. When the row can't fit, it wraps, centered.
 */

/** One destination pill. The icon is always a 44px square; the label reveals to its right when
 *  `active` (any size) or from `lg` up. `icon` is a lucide-name string or a render node. */
function NavPill({ to, end, label, iconName, iconNode, className }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'group relative flex h-11 shrink-0 items-center overflow-hidden rounded-full',
          'transition-[background-color,transform] duration-medium ease-emphasized active:scale-90',
          isActive
            ? 'bg-brand/15 text-brand-strong shadow-elevation-1'
            : 'text-faint hover:bg-surface-2 hover:text-content',
          className
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="grid h-11 w-11 shrink-0 place-items-center">
            {iconNode || <Icon name={iconName} className="h-5 w-5" />}
          </span>
          {/* Animatable label reveal: the grid track slides 0fr↔1fr (smooth, unlike width:auto),
              carrying the label + its trailing padding open only when this destination is active
              (any width) or at lg (labeled-toolbar mode). */}
          <span
            className={cn(
              'grid transition-[grid-template-columns,padding] duration-medium ease-emphasized',
              isActive ? 'grid-cols-[1fr] pr-4' : 'grid-cols-[0fr] pr-0',
              'lg:grid-cols-[1fr] lg:pr-4'
            )}
          >
            <span className="overflow-hidden whitespace-nowrap text-label-lg font-medium">{label}</span>
          </span>
        </>
      )}
    </NavLink>
  );
}

export function NavFloating() {
  const role = useAuthStore((s) => s.user?.role) || 'user';
  const nav = navForRole(role).slice(0, 5);
  const glassRef = useLiquidGlass(true, { scale: -30, chroma: 1.5, blur: 6, border: 0.14, mapBlur: 16 });

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
    >
      {/* Centered, wraps when it can't fit one row (never a sideways scroll). Softly rounded when it
          may be two rows tall (< lg), fully rounded as a single-row labeled toolbar at lg. */}
      <nav
        ref={glassRef}
        aria-label="Primary"
        className="lg-panel flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-center gap-1 rounded-[1.75rem] border border-border p-2 shadow-elevation-2 lg:gap-1.5 lg:rounded-full lg:p-2.5"
      >
        <NavLink
          to="/"
          aria-label="EV Hub home"
          title="EV Hub home"
          className="group grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform duration-medium ease-spring hover:scale-110 active:scale-90"
        >
          <AsteraMark size={26} />
        </NavLink>

        {nav.map((item) => (
          <NavPill key={item.to} to={item.to} end={item.end} label={item.label} iconName={item.icon} />
        ))}

        <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-border/70 lg:block" aria-hidden />

        <NavPill to="/settings" label="Settings" iconNode={<User className="h-5 w-5" />} />
      </nav>
    </div>
  );
}
