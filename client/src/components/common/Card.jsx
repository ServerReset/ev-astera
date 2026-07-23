import { cn } from '@/utils/cn.js';

/** Surface container. `as` lets it render a section/article/button. */
export function Card({ as: Tag = 'div', className, children, ...props }) {
  return (
    <Tag className={cn('card p-4', className)} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex items-start gap-2.5 min-w-0">
        {Icon && (
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-brand">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-content truncate">{title}</h3>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
