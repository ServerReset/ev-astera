import { NavLink } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { navForRole } from '@/modules/registry.js';
import { useAuthStore } from '@/stores/authStore.js';
import { Icon } from '@/components/common/Icon.jsx';
import { cn } from '@/utils/cn.js';

/** Desktop left sidebar. Hidden below `md`; BottomNav takes over on mobile. */
export function Sidebar() {
  const role = useAuthStore((s) => s.user?.role) || 'user';
  const nav = navForRole(role);

  return (
    <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-border bg-bg-elevated">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-content">
          <Zap className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <p className="font-semibold text-content">EV Hub</p>
          <p className="text-[11px] text-faint">Astera Labs</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-surface-2 hover:text-content'
              )
            }
          >
            <Icon name={item.icon} className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 text-[11px] text-faint border-t border-border">
        Charging guidelines by Taylor Frostholm.
      </div>
    </aside>
  );
}
