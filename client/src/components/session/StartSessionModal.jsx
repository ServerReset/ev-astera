import { useEffect, useState } from 'react';
import { Zap, Check } from 'lucide-react';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input } from '@/components/common/Input.jsx';
import { DurationSlider } from '@/components/common/DurationSlider.jsx';
import { sessionApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { burstConfetti } from '@/utils/confetti.js';
import { useSessionConfig } from '@/hooks/useSessionConfig.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { cn } from '@/utils/cn.js';

/**
 * Start a charging session on a charger. Duration slider bounded by the office's real max
 * (useSessionConfig), a vehicle field prefilled from the user, and a "charger connected"
 * confirmation. A successful start fires a celebratory confetti burst.
 */
export function StartSessionModal({ open, charger, user, onClose, onStarted }) {
  const maxMinutes = useSessionConfig();
  const [duration, setDuration] = useState(120);
  const [vehicle, setVehicle] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const ripple = useRipple();

  useEffect(() => {
    if (open) {
      setDuration(Math.min(120, maxMinutes || 240));
      setVehicle(user?.vehicleDescription || '');
      setConnected(false);
      setError(null);
    }
  }, [open, maxMinutes, user]);

  const submit = async () => {
    setError(null);
    if (!connected) { setError('Please confirm the charger is connected.'); return; }
    setSubmitting(true);
    try {
      await sessionApi.start({
        chargerId: charger.id,
        durationMinutes: duration,
        vehicleDescription: vehicle.trim(),
        confirmedConnected: true,
      });
      burstConfetti({ colors: ['#3c79bc', '#5a96d6', '#4ade80', '#ffffff'] });
      toast.success('Charging started ⚡');
      onStarted?.();
      onClose?.();
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={charger ? `Start on ${charger.name}` : 'Start charging'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="press ripple" onPointerDown={ripple} onClick={submit} loading={submitting}>
            <Zap className="h-4 w-4" /> Start charging
          </Button>
        </div>
      }
    >
      <div className="stagger space-y-4">
        <DurationSlider label="How long will you charge?" value={duration} onChange={setDuration} max={maxMinutes || 240} />
        <Input label="Vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Blue Model 3" />
        <button
          type="button"
          onClick={() => setConnected((v) => !v)}
          aria-pressed={connected}
          className={cn(
            'press flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm transition-colors duration-medium ease-emphasized',
            connected ? 'border-brand bg-brand/10 text-content' : 'border-border bg-bg-elevated text-muted hover:border-brand/40'
          )}
        >
          <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition-colors', connected ? 'border-brand bg-brand text-brand-content' : 'border-border-strong')}>
            {connected && <Check className="h-4 w-4" strokeWidth={3} />}
          </span>
          The charger is plugged into my vehicle
        </button>
        {error && <p className="field-error">{error}</p>}
      </div>
    </Modal>
  );
}
