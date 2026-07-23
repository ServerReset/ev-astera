import { useState } from 'react';
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

/**
 * Full-screen first-run walkthrough. Rendered by `OnboardingGate` when the signed-in user has
 * no `onboardedAt`, and re-triggerable from Settings via `onFinish` after a manual reset.
 */
export function OnboardingFlow({ onFinish }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const { icon: Icon, title, body } = STEPS[step];

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-bg">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-3xl bg-brand/15 text-brand-strong animate-slide-up">
          <Icon className="h-10 w-10" />
        </div>
        <h1 className="mt-6 text-xl font-semibold text-content animate-slide-up">{title}</h1>
        <p className="mt-2 max-w-sm text-sm text-muted animate-slide-up">{body}</p>
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
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        ) : (
          <Button variant="ghost" onClick={onFinish}>
            Skip
          </Button>
        )}
        <Button onClick={() => (last ? onFinish?.() : setStep((s) => s + 1))}>
          {last ? 'Get started' : 'Next'}
          {!last && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>,
    document.body
  );
}
