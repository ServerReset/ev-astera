import { Link } from 'react-router-dom';
import { User, Bell, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore.js';
import { useNotificationStore } from '@/stores/notificationStore.js';
import { cn } from '@/utils/cn.js';

/**
 * Account block shared by NavFloating's desktop overlay and BottomNav's mobile sheet: identity
 * header, Settings, Notifications (w/ unread badge), Sign out. `onNavigate` closes whichever
 * container (overlay/sheet) is hosting this before the route change.
 */
export function AccountMenuContent({ onNavigate }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const unread = useNotificationStore((s) => s.unread);

  const initials = (user?.displayName || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-semibold text-brand-strong">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-content">{user?.displayName}</p>
          <p className="truncate text-xs text-faint">{user?.email}</p>
        </div>
      </div>
      <div className="p-1.5">
        <MenuItem icon={User} label="Settings" to="/settings" onNavigate={onNavigate} />
        <MenuItem icon={Bell} label="Notifications" to="/notifications" badge={unread} onNavigate={onNavigate} />
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onNavigate?.();
            logout();
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-danger hover:bg-surface-2"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, to, badge, onNavigate }) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={() => onNavigate?.()}
      className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-content hover:bg-surface-2')}
    >
      <Icon className="h-4 w-4 text-muted" />
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-danger px-1 text-2xs font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}
