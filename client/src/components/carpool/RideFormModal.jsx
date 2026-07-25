import { useEffect, useState } from 'react';
import { Car } from 'lucide-react';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input, Textarea, Select } from '@/components/common/Input.jsx';
import { GeoPointField } from './GeoPointField.jsx';
import { carpoolApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { burstConfetti } from '@/utils/confetti.js';
import { useHqAddress } from '@/hooks/useHqAddress.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { CARPOOL_DIRECTION, DIRECTION_LABEL } from '@/utils/constants.js';
import { postRideSchema } from '@shared/validation.js';
import { toLocalInputValue, localInputToISO } from '@/utils/time.js';

const DIRECTION_OPTIONS = [
  { value: CARPOOL_DIRECTION.TO_SITE, label: DIRECTION_LABEL[CARPOOL_DIRECTION.TO_SITE] },
  { value: CARPOOL_DIRECTION.FROM_SITE, label: DIRECTION_LABEL[CARPOOL_DIRECTION.FROM_SITE] },
];

/**
 * Offer a ride: direction, origin (autocompleted, auto-filled with the HQ address when driving
 * "from work"), a departure datetime, seats, and optional notes. Validated against the shared
 * postRideSchema before posting so client + server agree.
 */
export function RideFormModal({ open, onClose, onSaved }) {
  const hqAddress = useHqAddress();
  const ripple = useRipple();
  const [direction, setDirection] = useState(CARPOOL_DIRECTION.TO_SITE);
  const [origin, setOrigin] = useState({ label: '' });
  const [departLocal, setDepartLocal] = useState('');
  const [seats, setSeats] = useState(3);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDirection(CARPOOL_DIRECTION.TO_SITE);
    setOrigin({ label: '' });
    // Default depart ~1h ahead.
    setDepartLocal(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
    setSeats(3);
    setNotes('');
    setErrors({});
  }, [open]);

  // "From work" originates at HQ — auto-fill it (only while origin is still blank).
  useEffect(() => {
    if (direction === CARPOOL_DIRECTION.FROM_SITE && hqAddress && !origin.label) {
      setOrigin({ label: hqAddress });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, hqAddress]);

  const submit = async () => {
    const payload = {
      direction,
      origin: { label: origin.label?.trim() || '' },
      departAt: localInputToISO(departLocal),
      seatsTotal: Number(seats),
      notes: notes.trim() || undefined,
    };
    const parsed = postRideSchema.safeParse(payload);
    if (!parsed.success) {
      const fe = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'origin' ? 'origin' : issue.path[0] ?? '_form';
        if (!fe[key]) fe[key] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setSubmitting(true);
    try {
      await carpoolApi.postRide(parsed.data);
      burstConfetti({ colors: ['#3c79bc', '#4ade80', '#5a96d6', '#ffffff'] });
      toast.success('Ride posted 🚗');
      onSaved?.();
      onClose?.();
    } catch (err) {
      const e = normalizeError(err);
      setErrors((prev) => ({ ...prev, _form: e.message }));
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Offer a ride"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="press ripple" onPointerDown={ripple} onClick={submit} loading={submitting}>
            <Car className="h-4 w-4" /> Post ride
          </Button>
        </div>
      }
    >
      <div className="stagger space-y-4">
        <Select label="Direction" options={DIRECTION_OPTIONS} value={direction} onChange={(e) => setDirection(e.target.value)} />
        <GeoPointField
          label="Where are you leaving from?"
          value={origin}
          onChange={setOrigin}
          error={errors.origin}
          placeholder="Pickup address"
        />
        <Input
          type="datetime-local"
          label="Departure time"
          value={departLocal}
          onChange={(e) => setDepartLocal(e.target.value)}
          error={errors.departAt}
        />
        <Input
          type="number"
          label="Seats offered"
          min={1}
          max={7}
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          error={errors.seatsTotal}
          hint="How many riders can join (1–7)."
        />
        <Textarea
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          error={errors.notes}
          placeholder="Anything riders should know — meeting point, timing flexibility…"
          maxLength={200}
        />
        {errors._form && <p className="field-error">{errors._form}</p>}
      </div>
    </Modal>
  );
}
