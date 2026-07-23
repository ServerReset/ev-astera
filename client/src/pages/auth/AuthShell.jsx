import { AsteraMark } from '@/components/common/AsteraMark.jsx';

/** Centered card layout shared by all auth screens. */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <AsteraMark size={56} className="rounded-2xl shadow-glow" />
          <h1 className="mt-4 text-2xl font-bold text-content">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="card p-6">{children}</div>
        {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}
