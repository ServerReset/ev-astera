import { NavLink } from 'react-router-dom';
import { navForRole } from '@/modules/registry.js';
import { useAuthStore } from '@/stores/authStore.js';
import { Icon } from '@/components/common/Icon.jsx';
import { AsteraMark } from '@/components/common/AsteraMark.jsx';
import { cn } from '@/utils/cn.js';

/**
 * M3 navigation rail — the medium window class (tablet, 600–839px). Vertical, compact,
 * icon-over-label with an active-indicator pill behind the icon. Shown only in that band:
 * BottomNav takes over below 600, the permanent NavDrawer above 840.
 */
export function NavRail() {
  const role = useAuthStore((s) => s.user?.role) || 'user';
  const nav = navForRole(role);

  return (
    <nav
      aria-label="Primary"
      className="hidden medium:flex expanded:hidden w-20 shrink-0 flex-col items-center gap-2 border-r border-border bg-bg-elevated py-4"
    >
      <NavLink to="/" aria-label="EV Hub home" className="mb-3 grid h-12 w-12 place-items-center">
        <AsteraMark size={30} />
      </NavLink>

      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'group flex w-full flex-col items-center gap-1 px-1 py-1.5 text-label-md',
              isActive ? 'text-brand-strong' : 'text-faint hover:text-content'
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  'grid h-8 w-14 place-items-center rounded-full transition-[background-color,transform] duration-medium ease-emphasized',
                  'group-active:scale-90',
                  isActive ? 'bg-brand/15' : 'group-hover:bg-surface-2'
                )}
              >
                <Icon name={item.icon} className="h-5 w-5" />
              </span>
              <span className="max-w-full truncate font-medium leading-none">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
