import { useEffect, useState } from 'react';
import { Car, MapPin, Clock, Users } from 'lucide-react';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input } from '@/components/common/Input.jsx';
import { GeoPointField } from './GeoPointField.jsx';
import { carpoolApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { burstConfetti } from '@/utils/confetti.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { DIRECTION_LABEL } from '@/utils/constants.js';
import { bookRideSchema } from '@shared/validation.js';
import { formatDateTime } from '@/utils/time.js';

/**
 * Book a seat on someone's ride: pickup point (autocompleted) + seat count, bounded by the seats
 * still available. A ride summary header keeps context. Success confetti + a "requested" toast —
 * the driver still has to confirm.
 */
export function BookRideModal({ open, ride, onClose, onBooked }) {
  const ripple = useRipple();
  const [pickup, setPickup] = useState({ label: '' });
  const [seats, setSeats] = useState(1);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPickup({ label: '' });
      setSeats(1);
      setErrors({});
    }
  }, [open]);

  // bookRideSchema caps a single booking at 6 seats, so never advertise or allow more than that —
  // otherwise a legit "book all 7" attempt on a 7-seat ride fails Zod validation with a confusing
  // "less than or equal to 6" message before the friendly maxSeats check ever runs.
  const maxSeats = Math.min(6, Math.max(1, ride?.seatsAvailable || 1));

  const submit = async () => {
    const payload = { pickup: { label: pickup.label?.trim() || '' }, seats: Number(seats) };
    const parsed = bookRideSchema.safeParse(payload);
    if (!parsed.success) {
      const fe = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'pickup' ? 'pickup' : issue.path[0] ?? '_form';
        if (!fe[key]) fe[key] = issue.message;
      }
      setErrors(fe);
      return;
    }
    if (parsed.data.seats > maxSeats) {
      setErrors({ seats: `Only ${maxSeats} seat${maxSeats > 1 ? 's' : ''} available.` });
      return;
    }
    setSubmitting(true);
    try {
      await carpoolApi.bookRide(ride.id, parsed.data);
      burstConfetti({ colors: ['#3c79bc', '#4ade80', '#5a96d6', '#ffffff'] });
      toast.success('Seat requested — waiting on the driver 🚗');
      onBooked?.();
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
      title="Book a seat"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="press ripple" onPointerDown={ripple} onClick={submit} loading={submitting}>
            <Car className="h-4 w-4" /> Request seat
          </Button>
        </div>
      }
    >
      {ride && (
        <div className="stagger space-y-4">
          {/* Ride summary */}
          <div className="rounded-2xl bg-bg-elevated p-3 text-sm">
            <p className="flex items-center gap-2 text-content">
              <Car className="h-4 w-4 text-brand-strong" />
              <span className="font-medium">{ride.driverName}</span>
              <span className="text-muted">· {DIRECTION_LABEL[ride.direction]}</span>
            </p>
            <p className="mt-1.5 flex items-start gap-2 text-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              {ride.origin?.label}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{formatDateTime(ride.departAt)}</span>
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{ride.seatsAvailable} of {ride.seatsTotal} free</span>
            </div>
          </div>

          <GeoPointField
            label="Where should the driver pick you up?"
            value={pickup}
            onChange={setPickup}
            error={errors.pickup}
            placeholder="Your pickup address"
          />
          <Input
            type="number"
            label="Seats"
            min={1}
            max={maxSeats}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            error={errors.seats}
            hint={`Up to ${maxSeats} available.`}
          />
          {errors._form && <p className="field-error">{errors._form}</p>}
        </div>
      )}
    </Modal>
  );
}
