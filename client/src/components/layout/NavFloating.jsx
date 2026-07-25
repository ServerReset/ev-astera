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
 */

/** One destination pill. `label` shows from lg↑ (and always when active) so wide screens read as a
 *  labeled toolbar; phones stay icon-only. `icon` is the lucide-name string or a render node. */
function NavPill({ to, end, label, iconName, iconNode, className }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'group relative flex h-11 shrink-0 items-center justify-center gap-2 rounded-full',
          'transition-[background-color,transform,width,padding] duration-medium ease-emphasized active:scale-90',
          isActive
            ? 'w-auto px-3.5 bg-brand/15 text-brand-strong'
            : 'w-11 px-0 text-faint hover:bg-surface-2 hover:text-content lg:w-auto lg:px-3.5',
          className
        )
      }
    >
      {({ isActive }) => (
        <>
          {iconNode || <Icon name={iconName} className="h-5 w-5 shrink-0" />}
          <span className={cn('text-label-lg font-medium whitespace-nowrap', isActive ? 'inline' : 'hidden lg:inline')}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function NavFloating() {
  const role = useAuthStore((s) => s.user?.role) || 'user';
  const nav = navForRole(role).slice(0, 5);
  const glassRef = useLiquidGlass(true, { scale: -45, chroma: 2, blur: 6 });

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
    >
      <nav
        ref={glassRef}
        aria-label="Primary"
        className="lg-panel inline-flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto rounded-full border border-border p-2 shadow-elevation-2 lg:gap-1.5 lg:p-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <NavLink to="/" aria-label="EV Hub home" title="EV Hub home" className="group mr-0.5 grid h-11 w-11 shrink-0 place-items-center transition-transform duration-medium ease-spring hover:scale-110 active:scale-90 lg:mr-1">
          <AsteraMark size={26} />
        </NavLink>

        {nav.map((item) => (
          <NavPill key={item.to} to={item.to} end={item.end} label={item.label} iconName={item.icon} />
        ))}

        <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-border/70 lg:block" aria-hidden />

        <NavPill to="/settings" label="Settings" className="ml-0.5 lg:ml-0" iconNode={<User className="h-5 w-5 shrink-0" />} />
      </nav>
    </div>
  );
}
