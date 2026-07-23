import { useState } from 'react';
import { startSessionSchema } from '@shared/validation.js';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input } from '@/components/common/Input.jsx';
import { useZodForm } from '@/hooks/useZodForm.js';
import { sessionApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { DURATION_PRESETS_HOURS } from '@/utils/constants.js';
import { cn } from '@/utils/cn.js';

/**
 * Start-session flow. Pre-fills vehicle/spot from the user profile. Duration is chosen from
 * presets (hours) but submitted as minutes to match startSessionSchema. Requires the
 * "connected" confirmation checkbox (the schema enforces `confirmedConnected === true`).
 */
export function StartSessionModal({ open, onClose, charger, user, onStarted }) {
  const [error, setError] = useState(null);
  const { values, errors, submitting, setField, handleChange, handleSubmit } = useZodForm(startSessionSchema, {
    chargerId: charger?.id,
    durationMinutes: 120,
    vehicleDescription: user?.vehicleDescription || '',
    parkingSpot: user?.parkingSpot || '',
    confirmedConnected: false,
  });

  // Keep chargerId in sync when the modal is reused for different chargers.
  if (charger && values.chargerId !== charger.id) setField('chargerId', charger.id);

  const onSubmit = handleSubmit(async (data) => {
    setError(null);
    try {
      const session = await sessionApi.start(data);
      toast.success('Charging session started.');
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
          <Button onClick={onSubmit} loading={submitting}>
            Start
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <span className="label">How long do you need?</span>
          <div className="grid grid-cols-4 gap-2">
            {DURATION_PRESETS_HOURS.map((h) => {
              const mins = h * 60;
              const active = values.durationMinutes === mins;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => setField('durationMinutes', mins)}
                  className={cn(
                    'rounded-xl border py-2.5 text-sm font-medium transition-colors',
                    active ? 'border-brand bg-brand/15 text-brand' : 'border-border bg-bg-elevated text-muted hover:text-content'
                  )}
                >
                  {h}h
                </button>
              );
            })}
          </div>
          {errors.durationMinutes && <p className="field-error">{errors.durationMinutes}</p>}
        </div>

        <Input
          label="Vehicle"
          name="vehicleDescription"
          value={values.vehicleDescription}
          onChange={handleChange}
          error={errors.vehicleDescription}
          placeholder="White Tesla Model 3"
        />
        <Input
          label="Parking spot"
          name="parkingSpot"
          value={values.parkingSpot}
          onChange={handleChange}
          error={errors.parkingSpot}
          placeholder="Level 2, Spot 14"
        />

        <label className="flex items-start gap-2.5 rounded-xl border border-border bg-bg-elevated p-3 text-sm">
          <input
            type="checkbox"
            name="confirmedConnected"
            checked={values.confirmedConnected}
            onChange={handleChange}
            className="mt-0.5 h-4 w-4 rounded border-border bg-bg text-brand focus:ring-brand"
          />
          <span className="text-muted">
            I've plugged in and confirmed the charger is delivering power to my vehicle.
          </span>
        </label>
        {errors.confirmedConnected && <p className="field-error">{errors.confirmedConnected}</p>}

        {error && <p className="field-error">{error}</p>}
      </form>
    </Modal>
  );
}
