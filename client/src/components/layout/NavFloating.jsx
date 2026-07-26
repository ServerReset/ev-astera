import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { User } from 'lucide-react';
import { navForRole } from '@/modules/registry.js';
import { useAuthStore } from '@/stores/authStore.js';
import { Icon } from '@/components/common/Icon.jsx';
import { AsteraMark } from '@/components/common/AsteraMark.jsx';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { cn } from '@/utils/cn.js';

// If the single row would come within this many px of overflowing its container, we proactively
// wrap into two rows rather than showing a cramped bar jammed to the screen edges.
const WRAP_COMFORT_PX = 44; // ≈ one icon pill

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
 *  `active` (any size) or from `lg` up. `icon` is a lucide-name string or a render node.
 *  `compact` (set when the bar has wrapped to two rows) forces icon-only below lg regardless of
 *  active state, so every pill is a uniform 44px square and the two rows split evenly — the wide
 *  active label would otherwise make the wrapped rows lopsided. Labels still show at lg. */
function NavPill({ to, end, label, iconName, iconNode, className, compact }) {
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
              carrying the label + its trailing padding open. Open when active (single-row mode) or
              at lg. In `compact` (wrapped two-row) mode it stays collapsed below lg so pills are
              uniform and the rows balance. */}
          <span
            data-nav-label
            className={cn(
              'grid transition-[grid-template-columns,padding] duration-medium ease-emphasized',
              !compact && isActive ? 'grid-cols-[1fr] pr-4' : 'grid-cols-[0fr] pr-0',
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
  const { pathname } = useLocation();

  // "Wrap early" logic. CSS flex-wrap alone only breaks at the exact moment of overflow, which
  // leaves a bar crammed edge-to-edge before it finally wraps. We'd rather wrap as soon as the row
  // gets *close* to full. And when it does wrap, we want an even split (e.g. 4 + 3), not one lonely
  // pill on row two. Neither is expressible in pure CSS because the active pill's width varies (its
  // label expands), so we measure: compare the bar's natural single-row width against the space
  // available, and if it's within WRAP_COMFORT_PX of overflowing, cap the width to ⌈cells/2⌉ pills
  // to force a balanced two rows. At `lg` the cap is dropped (labeled single-row toolbar).
  const navRef = useRef(null);
  const [cap, setCap] = useState(null); // px width cap when wrapping early, else null

  const cells = 1 + nav.length + 1; // home + destinations + settings

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return undefined;

    const measure = () => {
      // Only applies below lg (where pills are icon-first and can wrap); at lg+ it's a labeled row.
      if (window.matchMedia('(min-width: 1024px)').matches) { setCap(null); return; }
      const parent = el.parentElement;
      if (!parent) return;
      // AVAILABLE = the parent's content box (its clientWidth minus its own px-3 padding). This is
      // the real horizontal space the bar can occupy on one line.
      const ps = getComputedStyle(parent);
      const available = parent.clientWidth - (parseFloat(ps.paddingLeft) || 0) - (parseFloat(ps.paddingRight) || 0);

      // NATURAL = the bar's single-row content width in its EXPANDED form. Probe with cap cleared +
      // nowrap so scrollWidth reports the full one-line content width even if it would overflow, and
      // open the active pill's label track to `max-content` (its true text width — `1fr` would
      // measure free space, not content). Measuring the EXPANDED width regardless of current compact
      // state is what prevents wrap↔unwrap oscillation (compact icon-only pills are narrower and
      // would falsely "fit"). All synchronous inside useLayoutEffect → the probe never paints.
      const prevMax = el.style.maxWidth;
      const prevWrap = el.style.flexWrap;
      const activeLabel = el.querySelector('a[aria-current="page"] [data-nav-label]');
      const prevCols = activeLabel?.style.gridTemplateColumns;
      const prevPr = activeLabel?.style.paddingRight;
      el.style.maxWidth = 'none';
      el.style.flexWrap = 'nowrap';
      if (activeLabel) { activeLabel.style.gridTemplateColumns = 'max-content'; activeLabel.style.paddingRight = '1rem'; }
      const natural = el.scrollWidth;
      el.style.maxWidth = prevMax;
      el.style.flexWrap = prevWrap;
      if (activeLabel) { activeLabel.style.gridTemplateColumns = prevCols || ''; activeLabel.style.paddingRight = prevPr || ''; }

      if (natural > available - WRAP_COMFORT_PX) {
        // Too close to (or past) full → force a balanced two rows. In this wrapped mode every pill
        // is compact (icon-only, uniform 44px — see `compact` below), so ⌈cells/2⌉ icon-widths
        // caps the row to break the flow into two even rows with no lonely trailing pill.
        // box-sizing is border-box → include p-2 padding (8×2) + border (1×2) + inner gaps (4 each).
        const perRow = Math.ceil(cells / 2);
        setCap(perRow * 44 + (perRow - 1) * 4 + 20);
      } else {
        setCap(null); // comfortably fits one row (expanded active label restored)
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
    // Re-measure when the destination count changes or the active route changes (the active pill's
    // label width shifts the natural width).
  }, [cells, pathname]);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
    >
      {/* Centered; wraps EARLY into a balanced two rows when the single row gets close to full (see
          the measure effect), never a cramped edge-to-edge bar or a sideways scroll. Softly rounded
          when it may be two rows tall (< lg), fully rounded as a single-row labeled toolbar at lg. */}
      <nav
        ref={(node) => { glassRef.current = node; navRef.current = node; }}
        aria-label="Primary"
        style={cap != null ? { maxWidth: `${cap}px` } : undefined}
        className="lg-panel flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-center gap-1 rounded-[1.75rem] border border-border p-2 shadow-elevation-2 lg:!max-w-[calc(100vw-1.5rem)] lg:gap-1.5 lg:rounded-full lg:p-2.5"
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
          <NavPill key={item.to} to={item.to} end={item.end} label={item.label} iconName={item.icon} compact={cap != null} />
        ))}

        <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-border/70 lg:block" aria-hidden />

        <NavPill to="/settings" label="Settings" iconNode={<User className="h-5 w-5" />} compact={cap != null} />
      </nav>
    </div>
  );
}
