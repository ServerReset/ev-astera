import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { burstConfetti } from '@/utils/confetti.js';
import { useRipple } from '@/hooks/useInteractions.js';

/**
 * 404. Renders standalone (outside AppLayout), so it owns the full window like the auth
 * screens. A restrained ambient brand wash + a tonal icon chip keep it consistent with the
 * rest of the rebuild without over-designing an error page — one primary action home, one
 * quiet "go back".
 *
 * Hidden delight: the floating compass is a real button. Give it a few taps and the needle
 * "finds north" with a confetti burst from the click point — a small reward for the lost.
 */
export default function NotFoundPage() {
  const ripple = useRipple();
  const [spins, setSpins] = useState(0);

  // Poke the compass: each tap nudges the needle; the third one celebrates finding your way.
  const pokeCompass = (e) => {
    const next = spins + 1;
    setSpins(next);
    if (next % 3 === 0) {
      burstConfetti({ x: e.clientX, y: e.clientY, count: 60 });
    }
  };

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

      <div className="relative max-w-sm animate-scale-in">
        {/* Signature moment: an oversized gradient 404 with a floating compass needle spinning
            over it — playful without tipping into noise. The compass is tappable (see pokeCompass). */}
        <div className="relative mx-auto w-fit">
          <span className="block select-none text-[6rem] font-black leading-none tracking-tight text-gradient-brand" aria-hidden="true">
            404
          </span>
          <button
            type="button"
            onClick={pokeCompass}
            onPointerDown={ripple}
            aria-label="Recalibrate the compass"
            className="ripple absolute -right-2 -top-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand/15 text-brand-strong shadow-elevation-2 animate-float transition-transform duration-medium ease-spring hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Compass className="h-7 w-7 animate-spin [animation-duration:9s]" />
          </button>
        </div>
        <p className="mt-6 text-label-sm font-medium uppercase tracking-[0.2em] text-faint animate-slide-up [animation-fill-mode:backwards] [animation-delay:80ms]">Lost your bearings</p>
        <h1 className="mt-2 text-headline-md font-bold text-content animate-slide-up [animation-fill-mode:backwards] [animation-delay:140ms]">Page not found</h1>
        <p className="mt-2 text-sm text-muted animate-slide-up [animation-fill-mode:backwards] [animation-delay:200ms]">
          The page you're looking for doesn't exist or has moved. Let's get you back on track.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row animate-slide-up [animation-fill-mode:backwards] [animation-delay:260ms]">
          <Link
            to="/"
            className="btn-primary press ripple hover-sheen inline-flex w-full justify-center sm:w-auto"
            onPointerDown={ripple}
          >
            Back to dashboard
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            onPointerDown={ripple}
            className="btn-ghost press ripple inline-flex w-full justify-center sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
