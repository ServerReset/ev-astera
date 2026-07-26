import { useState } from 'react';
import { Info, Compass, Zap, Github, HeartHandshake } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { useRipple } from '@/hooks/useInteractions.js';
import { useConfirm } from '@/components/common/ConfirmDialog.jsx';
import { useAuthStore } from '@/stores/authStore.js';
import { userApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { burstConfetti } from '@/utils/confetti.js';

const APP_VERSION = '1.0.0';

export function AboutSection() {
  const ripple = useRipple();
  const patchUser = useAuthStore((s) => s.patchUser);
  const [confirm, confirmDialog] = useConfirm();
  const [replaying, setReplaying] = useState(false);
  const [vtaps, setVtaps] = useState(0);

  // Hidden delight: tap the version number 5 times to pop a little confetti + a warm thank-you.
  const tapVersion = (e) => {
    const next = vtaps + 1;
    setVtaps(next);
    if (next === 5) {
      const r = e.currentTarget.getBoundingClientRect();
      burstConfetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 44 });
      toast.success('You found the build. Thanks for charging with us. ⚡');
      setVtaps(0);
    }
  };

  const replay = async () => {
    const ok = await confirm({
      title: 'Replay the walkthrough?',
      message: "We'll show the first-run tour again from the top.",
      confirmLabel: 'Replay',
    });
    if (!ok) return;
    setReplaying(true);
    try {
      await userApi.resetOnboarding();
      // Clearing onboardedAt makes the OnboardingGate reappear immediately.
      patchUser({ onboardedAt: null });
      toast.success('Walkthrough reset — here we go!');
    } catch (err) {
      toast.error(normalizeError(err).message || "The walkthrough couldn't be reset — the server didn't say why. Try again in a moment.");
    } finally {
      setReplaying(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Take the tour again" subtitle="New here, or just want a refresher?" icon={Compass} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-sm text-muted">
            Replay the first-run walkthrough that shows you how chargers, the queue and carpool fit together.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="press ripple shrink-0"
            onPointerDown={ripple}
            loading={replaying}
            onClick={replay}
          >
            <Compass className="h-4 w-4" />
            Replay walkthrough
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="About" subtitle="Astera Labs EV Charger Hub" icon={Info} />
        <dl className="flex flex-col divide-y divide-border/60 text-sm">
          <div className="flex items-center justify-between py-2.5 first:pt-0">
            <dt className="flex items-center gap-2 text-muted">
              <Zap className="h-4 w-4" /> App
            </dt>
            <dd className="font-medium text-content">EV Charger Hub + Carpool</dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted">Version</dt>
            <dd>
              <button
                type="button"
                onClick={tapVersion}
                title="Tap a few times…"
                className="press rounded-lg px-1.5 font-mono tabular-nums text-content transition-transform duration-medium ease-spring hover:scale-105 hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/80"
              >
                v{APP_VERSION}
              </button>
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5 last:pb-0">
            <dt className="flex items-center gap-2 text-muted">
              <HeartHandshake className="h-4 w-4" /> Made for
            </dt>
            <dd className="font-medium text-content">Astera Labs staff</dd>
          </div>
        </dl>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-faint">
          <Github className="h-3.5 w-3.5" />
          Charge considerately — cap it, wrap the cable, and move your car when you're done.
        </p>
      </Card>

      {confirmDialog}
    </div>
  );
}
