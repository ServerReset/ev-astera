import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Zap, Users, Hand, Car, Trophy, ArrowRight, ArrowLeft, PartyPopper, Sparkles } from 'lucide-react';
import { Button } from '@/components/common/Button.jsx';
import { burstConfetti } from '@/utils/confetti.js';
import { useAuthStore } from '@/stores/authStore.js';
import { cn } from '@/utils/cn.js';

/**
 * First-run walkthrough — an interactive, glassy tour. Each step has a hands-on mini-demo (tap a
 * charger, join a queue, send a nudge & get a reaction, reveal a carpool match) so the user learns
 * by doing. Full-screen over the aurora, spring transitions, confetti on finish. Contract:
 * { onFinish, persistKey } — persistKey remembers the step (per user) so a refresh resumes.
 */

// Static accent → class map (Tailwind JIT needs literal strings).
const ACCENT = {
  brand: 'bg-brand/15 text-brand-strong ring-brand/40',
  info: 'bg-info/15 text-info ring-info/40',
  warning: 'bg-warning/15 text-warning ring-warning/40',
  success: 'bg-success/15 text-success ring-success/40',
};

function readStoredStep(key, max) {
  if (!key) return 0;
  try {
    const raw = sessionStorage.getItem(key);
    const n = raw == null ? NaN : parseInt(raw, 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
  } catch { return 0; }
}

// ── Interactive demos (one per step) ──────────────────────────────────────────
function ChargerDemo({ onDone }) {
  const [state, setState] = useState('available');
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => {
          if (state === 'available') { setState('charging'); onDone?.(); }
          else if (state === 'charging') setState('done');
          else setState('available');
        }}
        className={cn(
          'group relative grid h-28 w-28 place-items-center rounded-3xl border press transition-colors duration-medium ease-emphasized',
          state === 'available' && 'border-brand/40 bg-brand/10 text-brand-strong animate-glow',
          state === 'charging' && 'border-info/50 bg-info/15 text-info',
          state === 'done' && 'border-success/50 bg-success/15 text-success'
        )}
        aria-label="Demo charger"
      >
        <Zap className={cn('h-12 w-12 transition-transform', state === 'charging' && 'animate-pulse')} strokeWidth={1.75} />
      </button>
      <p className="text-sm font-medium text-muted">
        {state === 'available' && 'Tap the charger to start a session →'}
        {state === 'charging' && 'Charging! Tap again to finish early ⚡'}
        {state === 'done' && 'Done! You freed it for the next person 🎉'}
      </p>
    </div>
  );
}

function QueueDemo({ onDone }) {
  const [joined, setJoined] = useState(false);
  const people = joined ? ['You', 'Priya', 'Sam'] : ['Priya', 'Sam'];
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        {people.map((p, i) => (
          <div key={p + i} className={cn('grid h-12 w-12 place-items-center rounded-2xl text-xs font-semibold animate-slide-up [animation-fill-mode:backwards]', p === 'You' ? 'bg-brand text-brand-content ring-2 ring-brand/40' : 'bg-surface-2 text-muted')} style={{ animationDelay: `${i * 60}ms` }}>
            {p === 'You' ? 'You' : p[0]}
          </div>
        ))}
      </div>
      <Button variant={joined ? 'secondary' : 'primary'} size="sm" onClick={() => { setJoined((v) => !v); if (!joined) onDone?.(); }}>
        {joined ? "You're #1 — leave queue" : 'Join the queue'}
      </Button>
      <p className="text-sm text-muted">{joined ? "We'll ping you the moment it's your turn." : 'All chargers busy? Grab a spot in line.'}</p>
    </div>
  );
}

const REACTIONS = ['👍', '🙏', '🏃', '👀'];
function NudgeDemo({ onDone }) {
  const [sent, setSent] = useState(false);
  const [reaction, setReaction] = useState(null);
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-3">
      {!sent ? (
        <Button size="sm" onClick={() => { setSent(true); onDone?.(); }}><Hand className="h-4 w-4" /> Send a friendly nudge</Button>
      ) : (
        <div className="w-full space-y-2 animate-slide-up">
          <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-sm text-brand-content">Hey! Almost done charging? 🙏</div>
          {reaction ? (
            <div className="w-fit rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2 text-lg animate-slide-up">{reaction}</div>
          ) : (
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-xs text-faint">They react:</span>
              {REACTIONS.map((r) => (
                <button key={r} type="button" onClick={() => setReaction(r)} className="grid h-8 w-8 place-items-center rounded-full text-base transition-transform duration-spring ease-spring hover:scale-125 active:scale-90">{r}</button>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="text-center text-sm text-muted">{sent ? 'Nudges are anonymous — kind and low-pressure.' : 'Someone running long? A tap lets them know.'}</p>
    </div>
  );
}

function CarpoolDemo({ onDone }) {
  const [matched, setMatched] = useState(false);
  const match = () => {
    if (matched) return;
    setMatched(true);
    onDone?.();
    burstConfetti({ colors: ['#4fb477', '#3c79bc', '#f5c542', '#ffffff'] });
  };
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/15 text-brand-strong"><Car className="h-7 w-7" /></div>
        <div className={cn('h-0.5 w-10 transition-colors duration-long', matched ? 'bg-success' : 'bg-border')} />
        <div className={cn('grid h-14 w-14 place-items-center rounded-2xl transition-colors', matched ? 'bg-success/15 text-success' : 'bg-surface-2 text-faint')}><Users className="h-7 w-7" /></div>
      </div>
      {matched ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-success animate-slide-up"><Sparkles className="h-4 w-4" /> It's a match — 92% route overlap!</p>
      ) : (
        <Button size="sm" onClick={match}>Find me a carpool</Button>
      )}
      <p className="text-center text-sm text-muted">Share the commute, earn credits, cut your CO₂.</p>
    </div>
  );
}

function FinishDemo() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-brand/15 text-brand-strong animate-float"><Trophy className="h-10 w-10" strokeWidth={1.5} /></div>
      <p className="text-center text-sm text-muted">Earn badges as you charge, carpool, and help the lot flow.</p>
    </div>
  );
}

const STEPS = [
  { icon: Zap, accent: 'brand', title: 'Charge in one tap', body: 'Find an open charger and start a session instantly. End early to free it for the next person.', Demo: ChargerDemo },
  { icon: Users, accent: 'info', title: 'Never circle the lot', body: 'Every charger busy? Join the queue and get pinged the second a spot opens.', Demo: QueueDemo },
  { icon: Hand, accent: 'warning', title: 'A friendly nudge', body: 'Someone running long? Send an anonymous nudge — they can react right from their phone.', Demo: NudgeDemo },
  { icon: Car, accent: 'success', title: 'Carpool & save', body: 'Match with drivers and riders headed your way, and watch your impact add up.', Demo: CarpoolDemo },
  { icon: Trophy, accent: 'brand', title: "You're all set!", body: 'That’s the tour. Rack up achievements and keep the whole site moving.', Demo: FinishDemo },
];

export function OnboardingFlow({ onFinish, persistKey }) {
  const displayName = useAuthStore((s) => s.user?.displayName);
  const [step, setStep] = useState(() => readStoredStep(persistKey, STEPS.length - 1));
  const [tried, setTried] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);
  useEffect(() => { if (persistKey) { try { sessionStorage.setItem(persistKey, String(step)); } catch { /* ignore */ } } }, [step, persistKey]);
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);

  const last = step === STEPS.length - 1;
  const first = step === 0;
  const { icon: Icon, title, body, Demo } = STEPS[step];

  const goNext = useCallback(() => setStep((s) => { setTried(false); return Math.min(s + 1, STEPS.length - 1); }), []);
  const goBack = useCallback(() => setStep((s) => { setTried(false); return Math.max(s - 1, 0); }), []);

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try { await onFinish?.(); }
    finally {
      finishingRef.current = false;
      if (mountedRef.current) setFinishing(false);
      if (persistKey) { try { sessionStorage.removeItem(persistKey); } catch { /* ignore */ } }
    }
  }, [onFinish, persistKey]);

  const finishWithConfetti = useCallback(() => { burstConfetti({ count: 120 }); finish(); }, [finish]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') (last ? finishWithConfetti() : goNext());
      else if (e.key === 'ArrowLeft' && !first) goBack();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [last, first, finish, finishWithConfetti, goNext, goBack]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-bg/80" role="dialog" aria-modal="true" aria-label="Welcome walkthrough">
      <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <p className="text-sm font-medium text-muted">{first && displayName ? `Welcome, ${displayName.split(' ')[0]} 👋` : 'Quick tour'}</p>
        <span className="text-xs text-faint tabular-nums">{step + 1} / {STEPS.length}</span>
      </div>

      <div className="flex flex-1 items-center justify-center px-5">
        <div key={step} className="card w-full max-w-md rounded-3xl p-7 text-center animate-pop-in" aria-live="polite">
          <div className={cn('mx-auto grid h-16 w-16 place-items-center rounded-2xl ring-1', ACCENT[STEPS[step].accent] || ACCENT.brand)}>
            <Icon className="h-8 w-8" strokeWidth={1.75} />
          </div>
          <h1 className="mt-4 text-title-lg font-bold text-content">{title}</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{body}</p>
          <div className="mt-6 rounded-2xl border border-border/60 bg-bg-elevated/40 p-5">
            <Demo onDone={() => setTried(true)} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 py-4">
        {STEPS.map((_, i) => (
          <button key={i} type="button" aria-label={`Go to step ${i + 1}`} onClick={() => { setTried(false); setStep(i); }}
            className={cn('h-1.5 rounded-full transition-all duration-medium ease-emphasized', i === step ? 'w-7 bg-brand' : i < step ? 'w-1.5 bg-brand/50' : 'w-1.5 bg-surface-2 hover:bg-border-strong')} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/60 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!first ? (
          <Button variant="ghost" onClick={goBack} disabled={finishing}><ArrowLeft className="h-4 w-4" /> Back</Button>
        ) : (
          <Button variant="ghost" onClick={finish} loading={finishing}>Skip tour</Button>
        )}
        <Button onClick={last ? finishWithConfetti : goNext} loading={last && finishing} disabled={!last && finishing} className={cn(tried && !last && 'animate-glow')}>
          {last ? (<><PartyPopper className="h-4 w-4" /> Get started</>) : tried ? (<>Nice — next <ArrowRight className="h-4 w-4" /></>) : (<>Next <ArrowRight className="h-4 w-4" /></>)}
        </Button>
      </div>
    </div>,
    document.body
  );
}
