import { Zap } from 'lucide-react';

/** Centered card layout shared by all auth screens. */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-brand-content shadow-glow">
            <Zap className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-content">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="card p-6">{children}</div>
        {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}
