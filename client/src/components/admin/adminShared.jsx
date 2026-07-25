import { cn } from '@/utils/cn.js';
import { useCountUp } from '@/hooks/useCountUp.js';
import { useTilt, useRipple } from '@/hooks/useInteractions.js';

// Static literal-class map (never interpolate class names) — hoisted so it isn't reallocated
// per render.
const TONE_ICON = {
  brand: 'bg-brand/15 text-brand-strong ring-brand/20',
  success: 'bg-success/15 text-success ring-success/20',
  warning: 'bg-warning/15 text-warning ring-warning/20',
  info: 'bg-info/15 text-info ring-info/20',
};

/**
 * A glass stat tile for the Overview grid. Count-up number, hover lift + sheen, tilt-to-cursor.
 * `hero` renders the number with the brand gradient (reserve for ONE tile per grid).
 */
export function StatTile({ icon: Icon, label, value, decimals = 0, suffix = '', tone = 'brand', hero = false }) {
  const n = useCountUp(Number(value) || 0, { decimals });
  const tiltRef = useTilt(6);
  const display = decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString();
  const toneIcon = TONE_ICON[tone] || TONE_ICON.brand;

  return (
    <div ref={tiltRef} className="tilt h-full">
      <div className="card card-interactive hover-sheen group relative flex h-full flex-col gap-3 overflow-hidden rounded-xl-increased p-5 transition-all duration-medium ease-emphasized">
        <div className="flex items-center justify-between">
          <span className={cn('grid h-11 w-11 place-items-center rounded-2xl ring-1 transition-transform duration-medium ease-spring group-hover:scale-105', toneIcon)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        <div>
          <p
            className={cn(
              'text-title-lg font-bold tabular-nums leading-none',
              hero ? 'text-gradient-brand text-4xl' : 'text-content'
            )}
          >
            {display}
            {suffix && <span className={cn('ml-1 text-lg font-semibold', hero ? '' : 'text-muted')}>{suffix}</span>}
          </p>
          <p className="mt-1.5 text-sm text-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

/** A glassy scrollable table wrapper — always nested in a .card-solid panel to avoid stacked glass. */
export function AdminTable({ head, children, className }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-faint">
            {head.map((h, i) => (
              <th key={i} className={cn('px-3 py-2.5 font-medium', h.right && 'text-right')}>
                {h.label ?? h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="stagger">{children}</tbody>
      </table>
    </div>
  );
}

export function AdminRow({ children }) {
  return (
    <tr className="border-b border-border/60 transition-colors duration-short hover:bg-surface-2/50">
      {children}
    </tr>
  );
}

export function Td({ children, right, className }) {
  return <td className={cn('px-3 py-3 align-middle', right && 'text-right', className)}>{children}</td>;
}

/** Simple prev/next pager for admin tables. */
export function Pager({ page, total, pageSize = 20, onPage }) {
  const ripple = useRipple();
  const pages = Math.max(1, Math.ceil((total || 0) / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-muted">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          className="btn-ghost btn-sm ripple press disabled:opacity-40"
          onPointerDown={ripple}
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
        >
          Prev
        </button>
        <button
          className="btn-ghost btn-sm ripple press disabled:opacity-40"
          onPointerDown={ripple}
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/**
 * Editable array-of-strings field: chips with remove + an add input. Used for nudge_presets and
 * emergency_reasons in the Settings editor (server accepts string arrays).
 */
export function ChipListEditor({ label, hint, values = [], onChange, placeholder = 'Add an item…' }) {
  const ripple = useRipple();
  const add = (e) => {
    e.preventDefault();
    const input = e.target.elements?.chip;
    const v = (input?.value || '').trim();
    if (!v) return;
    if (values.includes(v)) {
      input.value = '';
      return;
    }
    onChange([...values, v]);
    input.value = '';
  };
  const remove = (v) => onChange(values.filter((x) => x !== v));

  return (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="mb-2 text-xs text-faint">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {values.length === 0 && <p className="text-sm text-faint">No items yet.</p>}
        {values.map((v) => (
          <span
            key={v}
            className="animate-pop-in inline-flex items-center gap-1.5 rounded-full bg-brand/12 py-1 pl-3 pr-1.5 text-sm text-brand-strong"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              aria-label={`Remove ${v}`}
              className="grid h-5 w-5 place-items-center rounded-full text-brand-strong/70 transition-colors hover:bg-brand/20 hover:text-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 active:scale-90"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={add} className="mt-2.5 flex gap-2">
        <input name="chip" className="input flex-1" placeholder={placeholder} />
        <button type="submit" className="btn-secondary btn-sm ripple press" onPointerDown={ripple}>
          Add
        </button>
      </form>
    </div>
  );
}
