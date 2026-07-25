import { useState } from 'react';
import { Zap } from 'lucide-react';
import { startSessionSchema } from '@shared/validation.js';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input } from '@/components/common/Input.jsx';
import { DurationSlider } from '@/components/common/DurationSlider.jsx';
import { useZodForm } from '@/hooks/useZodForm.js';
import { useSessionConfig } from '@/hooks/useSessionConfig.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { sessionApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { burstConfetti } from '@/utils/confetti.js';

/**
 * Start-session flow. Pre-fills vehicle from the user profile. Duration is chosen on a
 * slider (minutes), bounded by the admin-configured MAX_SESSION_HOURS setting (fetched via
 * useSessionConfig — not a hardcoded 4hr ceiling, which used to silently desync from whatever
 * an admin actually set). Requires the "connected" confirmation checkbox (the schema enforces
 * `confirmedConnected === true`).
 */
export function StartSessionModal({ open, onClose, charger, user, onStarted }) {
  const [error, setError] = useState(null);
  const maxSessionMinutes = useSessionConfig();
  const ripple = useRipple();
  const { values, errors, submitting, setField, handleChange, handleSubmit } = useZodForm(startSessionSchema, {
    chargerId: charger?.id,
    durationMinutes: 120,
    vehicleDescription: user?.vehicleDescription || '',
    confirmedConnected: false,
  });

  // Keep chargerId in sync when the modal is reused for different chargers.
  if (charger && values.chargerId !== charger.id) setField('chargerId', charger.id);

  // Clamp the default once the real max loads — an admin-lowered ceiling below the 120min
  // default would otherwise start the slider out of its own bounds.
  if (maxSessionMinutes && values.durationMinutes > maxSessionMinutes) {
    setField('durationMinutes', maxSessionMinutes);
  }

  const onSubmit = handleSubmit(async (data) => {
    setError(null);
    try {
      const session = await sessionApi.start(data);
      toast.success('Charging session started.');
      // Signature moment: a quick electric-green burst as the plug comes alive.
      burstConfetti({ colors: ['#4fb477', '#f5c542', '#3c79bc', '#ffffff'], count: 70 });
      onStarted?.(session);
      onClose?.();
    } catch (err) {
      setError(normalizeError(err).message);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Start charging · ${charger?.name || ''}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button className="press ripple hover-sheen" onPointerDown={ripple} onClick={onSubmit} loading={submitting}>
            <Zap className="h-4 w-4" aria-hidden />
            Start
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="stagger space-y-4" noValidate>
        <DurationSlider
          label="How long do you need?"
          value={values.durationMinutes}
          onChange={(mins) => setField('durationMinutes', mins)}
          max={maxSessionMinutes || undefined}
          error={errors.durationMinutes}
        />

        <Input
          label="Vehicle"
          name="vehicleDescription"
          value={values.vehicleDescription}
          onChange={handleChange}
          error={errors.vehicleDescription}
          placeholder="White Tesla Model 3"
        />

        <label
          className={
            'press flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 text-sm transition-colors duration-medium ' +
            (values.confirmedConnected
              ? 'border-success/50 bg-success/10'
              : 'border-border bg-bg-elevated hover:border-border-strong')
          }
        >
          <input
            type="checkbox"
            name="confirmedConnected"
            checked={values.confirmedConnected}
            onChange={handleChange}
            className="mt-0.5 h-4 w-4 rounded border-border bg-bg text-brand focus:ring-brand"
          />
          <span className={values.confirmedConnected ? 'text-content' : 'text-muted'}>
            I've plugged in and confirmed the charger is delivering power to my vehicle.
          </span>
        </label>
        {errors.confirmedConnected && <p className="field-error">{errors.confirmedConnected}</p>}

        {error && <p className="field-error">{error}</p>}
      </form>
    </Modal>
  );
}
