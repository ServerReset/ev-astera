import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { User } from 'lucide-react';
import { navForRole } from '@/modules/registry.js';
import { useAuthStore } from '@/stores/authStore.js';
import { Icon } from '@/components/common/Icon.jsx';
import { AsteraMark } from '@/components/common/AsteraMark.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { AccountMenuContent } from './AccountMenuContent.jsx';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { cn } from '@/utils/cn.js';

/**
 * M3 floating toolbar (https://m3.material.io/components/toolbars/overview) — one bottom-floating
 * nav bar for every window size: a compact pill inset from the screen edges, never docked flush
 * against an edge like a navigation bar. Primary destinations plus an Account entry that opens the
 * settings/notifications/sign-out sheet (shared AccountMenuContent).
 */
export function NavFloating() {
  const role = useAuthStore((s) => s.user?.role) || 'user';
  const nav = navForRole(role).slice(0, 4);
  const glassRef = useLiquidGlass(true, { scale: -70, blur: 5 });
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <nav
          ref={glassRef}
          aria-label="Primary"
          className="lg-panel inline-flex items-center gap-1 rounded-full border border-border p-2 shadow-elevation-2"
        >
          <NavLink to="/" aria-label="EV Hub home" className="mr-1 grid h-11 w-11 shrink-0 place-items-center">
            <AsteraMark size={26} />
          </NavLink>

          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              aria-label={item.label}
              className={({ isActive }) =>
                cn(
                  'group grid h-11 w-11 shrink-0 place-items-center rounded-full transition-[background-color,transform] duration-medium ease-emphasized',
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
            onClick={() => setAccountOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={accountOpen}
            aria-label="Account"
            title="Account"
            className="ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-faint transition-[background-color,transform] duration-medium ease-emphasized active:scale-90 hover:bg-surface-2 hover:text-content"
          >
            <User className="h-5 w-5" />
          </button>
        </nav>
      </div>

      <Modal open={accountOpen} onClose={() => setAccountOpen(false)} title="Account">
        <AccountMenuContent onNavigate={() => setAccountOpen(false)} />
      </Modal>
    </>
  );
}
