import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { navForRole } from '@/modules/registry.js';
import { useAuthStore } from '@/stores/authStore.js';
import { Icon } from '@/components/common/Icon.jsx';
import { AsteraMark } from '@/components/common/AsteraMark.jsx';
import { AccountMenuContent } from './AccountMenuContent.jsx';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { cn } from '@/utils/cn.js';

/**
 * Desktop nav (≥sm): a slim floating icon strip, always visible, plus a toggle that opens a
 * floating overlay panel (full labels + the account/settings/notifications/sign-out block that
 * used to live in Header's dropdown). The overlay sits on top of content — it never pushes
 * layout — and closes on outside click or Escape, mirroring the interaction Header.jsx used to
 * have for its own menu.
 */
export function NavFloating() {
  const role = useAuthStore((s) => s.user?.role) || 'user';
  const nav = navForRole(role);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const glassRef = useLiquidGlass(true, { scale: -70, blur: 5 });
  const overlayGlassRef = useLiquidGlass(open, { scale: -90, blur: 4 });

  useEffect(() => {
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div ref={rootRef} className="hidden sm:block">
      {/* Collapsed icon strip */}
      <nav
        ref={glassRef}
        aria-label="Primary"
        className="lg-panel fixed left-4 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1 rounded-full border border-border p-2"
      >
        <NavLink to="/" aria-label="EV Hub home" className="mb-1 grid h-11 w-11 place-items-center">
          <AsteraMark size={28} />
        </NavLink>

        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            className={({ isActive }) =>
              cn(
                'group grid h-11 w-11 place-items-center rounded-full transition-[background-color,transform] duration-medium ease-emphasized',
                'active:scale-90',
                isActive ? 'bg-brand/15 text-brand-strong' : 'text-faint hover:bg-surface-2 hover:text-content'
              )
            }
          >
            <Icon name={item.icon} className="h-5 w-5" />
          </NavLink>
        ))}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="mt-1 grid h-11 w-11 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-content"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Overlay drawer */}
      {open && (
        <div
          ref={overlayGlassRef}
          className="lg-panel fixed left-[88px] top-1/2 z-30 w-64 -translate-y-1/2 overflow-hidden rounded-2xl border border-border animate-fade-in"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="font-semibold text-content">EV Hub</p>
            <p className="text-label-sm text-faint">Astera Labs</p>
          </div>
          <nav className="space-y-1 p-2">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-full px-4 py-2.5 text-label-lg font-medium',
                    'transition-[background-color,color] duration-medium ease-emphasized',
                    isActive ? 'bg-brand/15 text-brand-strong' : 'text-muted hover:bg-surface-2 hover:text-content'
                  )
                }
              >
                <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-border">
            <AccountMenuContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
