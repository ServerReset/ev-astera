import { useEffect, useRef, useState } from 'react';
import { postRideSchema } from '@shared/validation.js';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input, Textarea, Select } from '@/components/common/Input.jsx';
import { GeoPointField } from './GeoPointField.jsx';
import { carpoolApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { toLocalInputValue, localInputToISO } from '@/utils/time.js';
import { CARPOOL_DIRECTION, DIRECTION_LABEL } from '@/utils/constants.js';
import { useHqAddress } from '@/hooks/useHqAddress.js';

/**
 * Offer a ride (Feature 1). Posts to carpoolApi.postRide with a body matching postRideSchema.
 * `linkedSessionId` optionally ties the ride to the driver's active charging session — that's
 * what surfaces the carpool chip on the dashboard and earns queue priority.
 */
export function RideFormModal({ open, onClose, onCreated, groups = [], linkedSessionId = null }) {
  const [direction, setDirection] = useState(CARPOOL_DIRECTION.FROM_SITE);
  const [origin, setOrigin] = useState(null);
  const [departLocal, setDepartLocal] = useState(() => toLocalInputValue(new Date(Date.now() + 90 * 60 * 1000)));
  const [seatsTotal, setSeatsTotal] = useState(3);
  const [notes, setNotes] = useState('');
  const [groupId, setGroupId] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const hqAddress = useHqAddress();
  const autoFilledRef = useRef(null);
  useEffect(() => {
    if (direction !== CARPOOL_DIRECTION.FROM_SITE || !hqAddress) return;
    const isUntouched = !origin?.label || origin.label === autoFilledRef.current;
    if (!isUntouched) return;
    autoFilledRef.current = hqAddress;
    setOrigin({ label: hqAddress });
  }, [direction, hqAddress, origin]);

  const submit = async () => {
    setErrors({});
    setFormError(null);
    const body = {
      direction,
      origin: origin || {},
      departAt: localInputToISO(departLocal),
      seatsTotal: Number(seatsTotal),
      notes: notes.trim() || undefined,
      linkedSessionId: linkedSessionId || undefined,
      groupId: groupId || undefined,
    };
    const parsed = postRideSchema.safeParse(body);
    if (!parsed.success) {
      const fe = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] === 'origin' ? 'origin' : issue.path[0] ?? '_form';
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setSubmitting(true);
    try {
      await carpoolApi.postRide(parsed.data);
      toast.success('Ride posted. Riders can now request a seat.');
      setOrigin(null);
      setNotes('');
      onCreated?.();
    } catch (err) {
      setFormError(normalizeError(err).message);
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
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting}>
            Post ride
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {linkedSessionId && (
          <p className="rounded-xl bg-brand/10 px-3 py-2 text-sm text-brand-strong">
            This ride will be linked to your current charging session.
          </p>
        )}
        <Select
          label="Direction"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          options={Object.values(CARPOOL_DIRECTION).map((d) => ({ value: d, label: DIRECTION_LABEL[d] }))}
        />
        <GeoPointField label="Starting from" value={origin} onChange={setOrigin} error={errors.origin} />
        <Input
          label="Departure time"
          type="datetime-local"
          value={departLocal}
          onChange={(e) => setDepartLocal(e.target.value)}
          error={errors.departAt}
        />
        <Input
          label="Seats offered"
          type="number"
          min={1}
          max={7}
          value={seatsTotal}
          onChange={(e) => setSeatsTotal(e.target.value)}
          error={errors.seatsTotal}
        />
        {groups.length > 0 && (
          <Select
            label="Group (optional)"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">Anyone at the site</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        )}
        <Textarea
          label="Notes (optional)"
          value={notes}
          maxLength={200}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Meeting point, luggage space, etc."
        />
        {formError && <p className="field-error">{formError}</p>}
      </div>
    </Modal>
  );
}
