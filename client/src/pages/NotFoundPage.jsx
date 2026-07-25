import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlugZap, Home } from 'lucide-react';
import { Aurora } from '@/components/common/Aurora.jsx';
import { burstConfetti } from '@/utils/confetti.js';
import { cn } from '@/utils/cn.js';

/**
 * 404 — a playful "unplugged" page. The big plug icon wiggles on hover and, after a few taps,
 * throws a little confetti (a tiny hidden delight). Glassy card over the aurora.
 */
export default function NotFoundPage() {
  const [taps, setTaps] = useState(0);

  const tap = (e) => {
    const next = taps + 1;
    setTaps(next);
    if (next % 3 === 0) {
      const r = e.currentTarget.getBoundingClientRect();
      burstConfetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 40 });
    }
  };

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg px-4">
      <Aurora />
      <div className="card relative w-full max-w-md rounded-3xl p-8 text-center animate-pop-in">
        <button
          type="button"
          onClick={tap}
          aria-label="Unplugged"
          className="press mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-brand/15 text-brand-strong transition-transform duration-medium ease-spring hover:-rotate-12 hover:scale-105"
        >
          <PlugZap className="h-12 w-12" strokeWidth={1.5} />
        </button>
        <p className="mt-6 text-5xl font-black tabular-nums text-gradient-brand">404</p>
        <h1 className="mt-2 text-title-lg font-bold text-content">This charger’s unplugged</h1>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
          {taps >= 3 ? 'Okay, you found the easter egg. 🎉' : 'The page you’re after isn’t here — but the lot’s still humming.'}
        </p>
        <Link to="/" className={cn('btn-primary press mt-6 inline-flex')}>
          <Home className="h-4 w-4" /> Back to the hub
        </Link>
      </div>
    </div>
  );
}
