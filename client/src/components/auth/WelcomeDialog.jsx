import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Mail, Zap, Car, ArrowRight, X } from 'lucide-react';
import { AsteraMark } from '@/components/common/AsteraMark.jsx';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { burstConfetti } from '@/utils/confetti.js';
import { cn } from '@/utils/cn.js';

const SEEN_KEY = 'evhub-welcomed-v1';

/**
 * First-run welcome — a warm glass dialog shown ONCE to a first-time visitor landing on the login
 * screen. It explains the one thing a newcomer needs to know: this is an Astera Labs workplace app,
 * so before signing in you create an account with your @asteralabs.com email. Two clear paths out:
 * "Create my account" (→ /register) or "I already have one" (dismiss, stay on login). Remembered in
 * localStorage so it never nags a returning user.
 *
 * Real liquid-glass refraction on the card (gentle params, matching the app's softened rims), the
 * ambient aurora already shows through from AuthShell behind it. Reduced-motion safe: the confetti
 * helper no-ops under reduced-motion, and entrance animations are one-shot.
 */
export function WelcomeDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const cardRef = useLiquidGlass(open, { scale: -34, chroma: 1.5, blur: 5, border: 0.14, mapBlur: 16 });
  const markRef = useRef(null);

  // Decide on mount whether this is a first-time visitor. Wrapped in try/catch because private-mode
  // browsers can throw on localStorage access — a storage failure should never block the login page.
  useEffect(() => {
    let firstTime = false;
    try {
      firstTime = !localStorage.getItem(SEEN_KEY);
    } catch {
      firstTime = false; // can't tell → don't nag
    }
    if (firstTime) setOpen(true);
  }, []);

  // Lock body scroll while the dialog is up; a tiny confetti hello once it appears.
  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    const r = markRef.current?.getBoundingClientRect();
    burstConfetti({
      x: r ? r.left + r.width / 2 : undefined,
      y: r ? r.top + r.height / 2 : undefined,
      colors: ['#3c79bc', '#5a96d6', '#4ade80', '#f5c542', '#ffffff'],
      count: 60,
    });
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const remember = () => {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode — fine, it'll show once more */ }
  };

  const dismiss = () => { remember(); setOpen(false); };

  const goRegister = () => { remember(); setOpen(false); navigate('/register'); };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      {/* Scrim — click to dismiss, its own soft blur so the aurora glows behind. */}
      <button
        type="button"
        aria-label="Close welcome"
        onClick={dismiss}
        className="absolute inset-0 cursor-default bg-bg/60 backdrop-blur-sm animate-fade-in"
      />

      <div
        ref={cardRef}
        className="lg-panel relative w-full max-w-md overflow-hidden rounded-3xl border border-border p-7 text-center shadow-elevation-3 animate-pop-in"
      >
        {/* Dismiss X */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-faint transition-colors duration-short hover:bg-surface-2 hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/80 active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Brand mark with a soft bloom + a gently floating sparkle. */}
        <div className="relative mx-auto grid h-20 w-20 place-items-center">
          <div className="pointer-events-none absolute inset-0 rounded-full bg-brand/25 blur-2xl" aria-hidden />
          <div ref={markRef} className="relative rounded-2xl bg-surface p-3 shadow-elevation-1">
            <AsteraMark size={40} />
          </div>
          <Sparkles className="absolute -right-1 -top-1 h-5 w-5 text-brand-strong animate-float" aria-hidden />
        </div>

        <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand/12 px-3 py-1 text-label-sm font-semibold text-brand-strong">
          <Sparkles className="h-3.5 w-3.5" /> Welcome to EV Hub
        </p>
        <h2 id="welcome-title" className="mt-3 text-title-lg font-bold text-content">
          First time here? Let's get you set up.
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
          EV Hub is Astera Labs' workplace charging &amp; carpool app. To join, create an account with
          your work email — then everything below is yours.
        </p>

        {/* The one must-know: use your Astera email. */}
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-bg-elevated/70 p-3 text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand-strong">
            <Mail className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-content">Use your @asteralabs.com email</p>
            <p className="text-xs text-muted">That's how we know you're on the team.</p>
          </div>
        </div>

        {/* A two-beat taste of what's inside. */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-left">
          <div className="flex items-center gap-2 rounded-2xl bg-bg-elevated/70 p-3">
            <Zap className="h-4 w-4 shrink-0 text-brand-strong" />
            <p className="text-xs text-muted">Grab a charger or a spot in line</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-bg-elevated/70 p-3">
            <Car className="h-4 w-4 shrink-0 text-brand-strong" />
            <p className="text-xs text-muted">Carpool &amp; watch your CO₂ drop</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={goRegister}
            className={cn('btn-primary press ripple hover-sheen group w-full justify-center')}
          >
            Create my account
            <ArrowRight className="h-4 w-4 transition-transform duration-medium ease-spring group-hover:translate-x-1" />
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="btn-ghost press w-full justify-center"
          >
            I already have one — sign in
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
