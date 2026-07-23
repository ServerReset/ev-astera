import { useState } from 'react';
import { Car, Clock, MapPin } from 'lucide-react';
import { bookRideSchema } from '@shared/validation.js';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input } from '@/components/common/Input.jsx';
import { GeoPointField } from './GeoPointField.jsx';
import { carpoolApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { formatDateTime } from '@/utils/time.js';
import { DIRECTION_LABEL } from '@/utils/constants.js';

/** Request a seat on a ride (Feature 1). Body matches bookRideSchema: { pickup, seats }. */
export function BookRideModal({ open, onClose, ride, onBooked }) {
  const [pickup, setPickup] = useState(null);
  const [seats, setSeats] = useState(1);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setErrors({});
    setFormError(null);
    const parsed = bookRideSchema.safeParse({ pickup: pickup || {}, seats: Number(seats) });
    if (!parsed.success) {
      const fe = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] === 'pickup' ? 'pickup' : issue.path[0] ?? '_form';
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setSubmitting(true);
    try {
      await carpoolApi.bookRide(ride.id, parsed.data);
      toast.success('Seat requested — the driver will confirm.');
      setPickup(null);
      onBooked?.();
    } catch (err) {
      setFormError(normalizeError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!ride) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request a seat"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting}>
            Request seat
          </Button>
        </div>
      }
    >
      <div className="mb-4 rounded-xl bg-bg-elevated p-3 text-sm">
        <div className="flex items-center gap-2 font-medium text-content">
          <Car className="h-4 w-4 text-brand-strong" />
          {ride.driverName} · {DIRECTION_LABEL[ride.direction]}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-muted">
          <Clock className="h-4 w-4" />
          {formatDateTime(ride.departAt)}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-muted">
          <MapPin className="h-4 w-4" />
          From {ride.origin?.label}
        </div>
      </div>

      <div className="space-y-4">
        <GeoPointField label="Where should the driver pick you up?" value={pickup} onChange={setPickup} error={errors.pickup} />
        <Input
          label="Seats"
          type="number"
          min={1}
          max={Math.min(6, ride.seatsAvailable)}
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          error={errors.seats}
        />
        {formError && <p className="field-error">{formError}</p>}
      </div>
    </Modal>
  );
}
