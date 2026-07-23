/** Consistent page title block with an optional right-aligned action slot. */
export function PageHeader({ title, description, action, icon: Icon }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-brand-strong">
            <Icon className="h-6 w-6" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-content sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
