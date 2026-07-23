import { cn } from '@/utils/cn.js';

/**
 * Segmented tab bar. `tabs` = [{ key, label, icon?, badge? }]. Controlled via `value`/`onChange`.
 * Horizontally scrollable on small screens so it never wraps.
 */
export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1', className)} role="tablist">
      {tabs.map((t) => {
        const active = t.key === value;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
              active ? 'bg-surface text-content shadow-sm' : 'text-muted hover:text-content'
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {t.label}
            {typeof t.badge === 'number' && t.badge > 0 && (
              <span className="ml-0.5 rounded-full bg-brand/20 px-1.5 text-xs text-brand">{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
