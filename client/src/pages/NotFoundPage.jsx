import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

/**
 * 404. Renders standalone (outside AppLayout), so it owns the full window like the auth
 * screens. A restrained ambient brand wash + a tonal icon chip keep it consistent with the
 * rest of the rebuild without over-designing an error page — one primary action home, one
 * quiet "go back".
 */
export default function NotFoundPage() {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-bg px-6 text-center">
      {/* Ambient brand wash — tokenized so it adapts light/dark. Purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(48rem 32rem at 50% 0%, rgb(var(--c-brand) / 0.14), transparent 60%)',
        }}
      />

      <div className="relative max-w-sm animate-slide-up">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand/15 text-brand-strong shadow-elevation-1">
          <Compass className="h-8 w-8" />
        </span>
        <p className="mt-6 text-label-sm font-medium uppercase tracking-[0.2em] text-faint">Error 404</p>
        <h1 className="mt-2 text-headline-md font-bold text-content">Page not found</h1>
        <p className="mt-2 text-sm text-muted">
          The page you're looking for doesn't exist or has moved. Let's get you back on track.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link to="/" className="btn-primary inline-flex w-full justify-center sm:w-auto">
            Back to dashboard
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn-ghost inline-flex w-full justify-center sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
