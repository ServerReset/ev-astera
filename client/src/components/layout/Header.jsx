import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, User, LogOut, Settings } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore.js';
import { useNotificationStore } from '@/stores/notificationStore.js';
import { AsteraMark } from '@/components/common/AsteraMark.jsx';
import { cn } from '@/utils/cn.js';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';

/** Top bar: mobile brand, spacer, notification bell w/ unread badge, and user menu. */
export function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const unread = useNotificationStore((s) => s.unread);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const glassRef = useLiquidGlass(menuOpen, { scale: -90, blur: 4 });

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initials = (user?.displayName || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-bg-elevated/95 px-4 backdrop-blur md:px-6">
      <Link to="/" className="flex items-center gap-2 md:hidden">
        <AsteraMark size={32} />
        <span className="font-semibold">EV Hub</span>
      </Link>

      <div className="flex-1" />

      <Link
        to="/notifications"
        className="relative grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-content"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-danger px-1 text-2xs font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Link>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface-2"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 text-sm font-semibold text-brand-strong">
            {initials}
          </span>
          <span className="hidden sm:block max-w-[120px] truncate text-sm text-content">{user?.displayName}</span>
        </button>

        {menuOpen && (
          <div
            ref={glassRef}
            role="menu"
            className="lg-panel absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-border animate-fade-in"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-medium text-content">{user?.displayName}</p>
              <p className="truncate text-xs text-faint">{user?.email}</p>
            </div>
            <MenuItem icon={User} label="Settings" onClick={() => { setMenuOpen(false); navigate('/settings'); }} />
            <MenuItem icon={Settings} label="Notifications" onClick={() => { setMenuOpen(false); navigate('/notifications'); }} />
            <button
              role="menuitem"
              onClick={() => { setMenuOpen(false); logout(); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-surface-2"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function MenuItem({ icon: Icon, label, onClick }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-sm text-content hover:bg-surface-2')}
    >
      <Icon className="h-4 w-4 text-muted" />
      {label}
    </button>
  );
}
