import { NavLink } from 'react-router-dom';
import { navForRole } from '@/modules/registry.js';
import { useAuthStore } from '@/stores/authStore.js';
import { Icon } from '@/components/common/Icon.jsx';
import { AsteraMark } from '@/components/common/AsteraMark.jsx';
import { cn } from '@/utils/cn.js';

/**
 * M3 permanent navigation drawer — the expanded window class (laptop, ≥840px). Full-width
 * labels beside icons, a pill-shaped active indicator, brand header and a footer note.
 * Shown only ≥840: the NavRail covers 600–839, BottomNav below 600.
 * (Filename kept as Sidebar for import stability; this is the drawer.)
 */
export function Sidebar() {
  const role = useAuthStore((s) => s.user?.role) || 'user';
  const nav = navForRole(role);

  return (
    <aside
      aria-label="Primary"
      className="hidden expanded:flex w-72 shrink-0 flex-col border-r border-border bg-bg-elevated"
    >
      <NavLink to="/" className="flex items-center gap-3 px-6 h-16 border-b border-border">
        <AsteraMark size={34} />
        <div className="leading-tight">
          <p className="font-semibold text-content">EV Hub</p>
          <p className="text-label-sm text-faint">Astera Labs</p>
        </div>
      </NavLink>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-full px-4 py-2.5 text-label-lg font-medium',
                'transition-[background-color,color] duration-medium ease-emphasized',
                isActive
                  ? 'bg-brand/15 text-brand-strong'
                  : 'text-muted hover:bg-surface-2 hover:text-content'
              )
            }
          >
            <Icon name={item.icon} className="h-5 w-5 shrink-0 transition-transform duration-short ease-emphasized group-active:scale-90" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 text-label-sm text-faint border-t border-border">
        Charging guidelines by Taylor Frostholm.
      </div>
    </aside>
  );
}
