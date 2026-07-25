import { useState } from 'react';
import { Siren, Check, X } from 'lucide-react';
import { Button } from '@/components/common/Button.jsx';
import { messageApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { useApi } from '@/hooks/useApi.js';
import { useRealtime } from '@/hooks/useRealtime.js';
import { useCountdown } from '@/hooks/useCountdown.js';
import { burstConfetti } from '@/utils/confetti.js';

/**
 * Live banner for active "I need a charger" emergencies at this office. Anyone currently charging
 * can offer to wrap up or decline; the request auto-expires on its response window (countdown).
 * `hasActiveSession` gates the respond actions to people who can actually free a charger.
 */
export function EmergencyBanner({ hasActiveSession }) {
  const { data, refetch } = useApi(() => messageApi.emergencies(), []);
  useRealtime('emergencies', ['emergency_requests'], refetch);
  const list = data || [];
  if (!list.length) return null;

  return (
    <div className="mb-6 space-y-2">
      {list.map((e) => (
        <EmergencyRow key={e.id} req={e} canRespond={hasActiveSession} onChanged={refetch} />
      ))}
    </div>
  );
}

function EmergencyRow({ req, canRespond, onChanged }) {
  const [busy, setBusy] = useState(false);
  const { label, done } = useCountdown(req.expiresAt);
  if (done) return null;

  const respond = async (accept, e) => {
    // Capture the button's position NOW, synchronously — React nulls out e.currentTarget once the
    // handler returns, so reading it after the await below would always be null and the confetti
    // would fall back to screen-center instead of bursting from the button the user pressed.
    const rect = e?.currentTarget?.getBoundingClientRect();
    setBusy(true);
    try {
      await messageApi.respondEmergency({ requestId: req.id, accept });
      if (accept) {
        // A small thank-you flourish for the good deed — burst from the button pressed.
        burstConfetti(rect ? { x: rect.left + rect.width / 2, y: rect.top, count: 60, colors: ['#4ade80', '#5a96d6', '#f5c542', '#ffffff'] } : { count: 60 });
        toast.success('You’re a lifesaver — they’ve been told you’re wrapping up.');
      } else {
        toast.success('No worries — response sent.');
      }
      onChanged?.();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-slide-up overflow-hidden rounded-2xl border border-danger/40 bg-danger/10 p-3.5 hover-sheen">
      <div className="flex items-start gap-3">
        {/* No infinite pulse here: emergencies can stack into a list, and several pulsing icons at
            rest reads as noise. The danger border + tint + live countdown carry the urgency; the
            siren gets a one-shot pop on entrance only. */}
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-danger/15 text-danger animate-pop-in">
          <Siren className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-content">
            {req.userDisplayName} needs a charger — <span className="text-danger">{req.reason}</span>
          </p>
          {req.explanation && <p className="mt-0.5 text-sm text-muted">{req.explanation}</p>}
          <p className="mt-0.5 text-xs text-faint tabular-nums">Expires in {label}</p>
        </div>
      </div>
      {canRespond && (
        <div className="mt-2.5 flex gap-2">
          <Button size="sm" className="press flex-1" loading={busy} onClick={(e) => respond(true, e)}>
            <Check className="h-4 w-4" /> I'll wrap up
          </Button>
          <Button size="sm" variant="ghost" className="press" loading={busy} onClick={(e) => respond(false, e)}>
            <X className="h-4 w-4" /> Can't now
          </Button>
        </div>
      )}
    </div>
  );
}
