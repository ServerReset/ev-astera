import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Zap, Users, Hand, Car, Bell, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/common/Button.jsx';
import { cn } from '@/utils/cn.js';

const STEPS = [
  {
    icon: Zap,
    title: 'Welcome to EV Charger Hub',
    body: 'Find an open charger, start a session in one tap, and keep the lot moving for everyone else on site.',
  },
  {
    icon: Users,
    title: 'Join the queue',
    body: 'Every charger full? Join its queue and you’ll be notified the moment a spot opens up for you.',
  },
  {
    icon: Hand,
    title: 'Send a nudge',
    body: 'Session run long? Send a friendly nudge to the driver — they’ll see it and can react right from their phone.',
  },
  {
    icon: Car,
    title: 'Carpool to work',
    body: 'Post or join a ride, earn carpool credits, and track your CO₂ impact from the Carpool tab.',
  },
  {
    icon: Bell,
    title: 'Stay in the loop',
    body: 'Announcements, queue turns, and nudges all land in Notifications — turn on push alerts so you never miss one.',
  },
];

function readStoredStep(key) {
  if (!key) return 0;
  try {
    const raw = sessionStorage.getItem(key);
    const n = raw == null ? NaN : parseInt(raw, 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), STEPS.length - 1) : 0;
  } catch {
    return 0; // Storage unavailable (private mode, disabled, quota) — just start at 0.
  }
}

/**
 * Full-screen first-run walkthrough. Rendered by `OnboardingGate` when the signed-in user has
 * no `onboardedAt`, and re-triggerable from Settings via `onFinish` after a manual reset.
 *
 * `persistKey`, when provided, remembers the current step in sessionStorage so an accidental
 * refresh mid-tour resumes instead of restarting from step 0. Scope it to the user (e.g.
 * `onboarding-${user.id}`) so it can never leak across accounts sharing a browser tab — omit
 * it (as Settings' manual replay does) to always start fresh.
 */
export function OnboardingFlow({ onFinish, persistKey }) {
  const [step, setStep] = useState(() => readStoredStep(persistKey));
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    if (!persistKey) return;
    try {
      sessionStorage.setItem(persistKey, String(step));
    } catch {
      // Non-fatal: progress just won't survive a refresh.
    }
  }, [step, persistKey]);

  // Lock background scroll while this full-screen overlay is up, same as Modal does.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const last = step === STEPS.length - 1;
  const { icon: Icon, title, body } = STEPS[step];

  // Clamped so a double-click/tap racing a re-render can never push `step` out of bounds
  // (which would otherwise crash on `STEPS[step]` being undefined).
  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), []);
  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  const finish = useCallback(async () => {
    // Ref guard (not just state) so a second call landing before the first re-render — a
    // fast double-click, or Escape right after clicking Skip — is a true no-op.
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      await onFinish?.();
    } finally {
      finishingRef.current = false;
      if (mountedRef.current) setFinishing(false);
      if (persistKey) {
        try {
          sessionStorage.removeItem(persistKey);
        } catch {
          // ignore
        }
      }
    }
  }, [onFinish, persistKey]);

  // Keyboard support: arrows to move, Escape to leave from any step (not just step 0's Skip
  // button) — a confused or stuck user should always have a way out.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') (last ? finish() : goNext());
      else if (e.key === 'ArrowLeft' && step > 0) goBack();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [last, step, finish, goNext, goBack]);

  if (!STEPS.length) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome walkthrough"
    >
      {/* Re-keyed per step so the entrance motion replays on every advance, not just first
          mount. A light stagger (icon → title → body) matches the app's ENTER rhythm. */}
      <div key={step} className="flex flex-1 flex-col items-center justify-center px-6 text-center" aria-live="polite">
        <div className="grid h-20 w-20 place-items-center rounded-3xl bg-brand/15 text-brand-strong animate-slide-up [animation-fill-mode:backwards]">
          <Icon className="h-10 w-10" />
        </div>
        <h1 className="mt-6 text-xl font-semibold text-content animate-slide-up [animation-fill-mode:backwards]" style={{ animationDelay: '60ms' }}>{title}</h1>
        <p className="mt-2 max-w-sm text-sm text-muted animate-slide-up [animation-fill-mode:backwards]" style={{ animationDelay: '120ms' }}>{body}</p>
      </div>

      <div className="flex items-center justify-center gap-1.5 pb-6">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === step ? 'w-6 bg-brand' : 'w-1.5 bg-surface-2'
            )}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {step > 0 ? (
          <Button variant="ghost" onClick={goBack} disabled={finishing}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        ) : (
          <Button variant="ghost" onClick={finish} loading={finishing}>
            Skip
          </Button>
        )}
        <Button onClick={last ? finish : goNext} loading={last && finishing} disabled={!last && finishing}>
          {last ? 'Get started' : 'Next'}
          {!last && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>,
    document.body
  );
}
