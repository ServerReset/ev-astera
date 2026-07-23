import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { User } from 'lucide-react';
import { navForRole } from '@/modules/registry.js';
import { useAuthStore } from '@/stores/authStore.js';
import { Icon } from '@/components/common/Icon.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { AccountMenuContent } from './AccountMenuContent.jsx';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { cn } from '@/utils/cn.js';

/**
 * M3 navigation bar — the mobile window class (<sm). Primary destinations plus a trailing
 * "Account" entry that opens a bottom sheet with settings/notifications/sign-out (the content
 * that used to live in Header's dropdown). Hidden at `sm+`, where NavFloating takes over.
 * Liquid glass: it's a floating surface and stays under the effect's ~800px safe width on
 * phones. Refraction is Chromium-only; others get the frosted fallback.
 */
export function BottomNav() {
  const role = useAuthStore((s) => s.user?.role) || 'user';
  const nav = navForRole(role).slice(0, 4);
  const glassRef = useLiquidGlass(true, { scale: -70, blur: 5, radius: 0 });
  const [accountOpen, setAccountOpen] = useState(false);
  const cols = nav.length + 1;

  return (
    <>
      <nav
        ref={glassRef}
        aria-label="Primary"
        className="lg-panel sm:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'group flex flex-col items-center gap-1 pb-2 pt-2.5 text-label-md font-medium transition-colors',
                  isActive ? 'text-brand-strong' : 'text-faint hover:text-muted'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'grid h-8 w-16 place-items-center rounded-full transition-[background-color,transform] duration-medium ease-emphasized',
                      'group-active:scale-90',
                      isActive ? 'bg-brand/15' : 'group-hover:bg-surface-2/60'
                    )}
                  >
                    <Icon name={item.icon} className="h-5 w-5" />
                  </span>
                  <span className="leading-none">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={accountOpen}
            className="group flex flex-col items-center gap-1 pb-2 pt-2.5 text-label-md font-medium text-faint transition-colors hover:text-muted"
          >
            <span className="grid h-8 w-16 place-items-center rounded-full transition-[background-color,transform] duration-medium ease-emphasized group-active:scale-90 group-hover:bg-surface-2/60">
              <User className="h-5 w-5" />
            </span>
            <span className="leading-none">Account</span>
          </button>
        </div>
      </nav>

      <Modal open={accountOpen} onClose={() => setAccountOpen(false)} title="Account">
        <AccountMenuContent onNavigate={() => setAccountOpen(false)} />
      </Modal>
    </>
  );
}
