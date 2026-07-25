import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input, Select } from '@/components/common/Input.jsx';
import { GeoPointField } from './GeoPointField.jsx';
import { carpoolApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { useHqAddress } from '@/hooks/useHqAddress.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { CARPOOL_DIRECTION, DIRECTION_LABEL } from '@/utils/constants.js';
import { postRequestSchema } from '@shared/validation.js';
import { toLocalInputValue, localInputToISO } from '@/utils/time.js';

const DIRECTION_OPTIONS = [
  { value: CARPOOL_DIRECTION.TO_SITE, label: DIRECTION_LABEL[CARPOOL_DIRECTION.TO_SITE] },
  { value: CARPOOL_DIRECTION.FROM_SITE, label: DIRECTION_LABEL[CARPOOL_DIRECTION.FROM_SITE] },
];

/**
 * Post a ride request ("I need a ride") with a pickup point and an arrival/departure time window.
 * The matcher cron and the Matches panel use this to suggest rides. Validated against
 * postRequestSchema.
 */
export function RequestFormModal({ open, onClose, onSaved }) {
  const hqAddress = useHqAddress();
  const ripple = useRipple();
  const [direction, setDirection] = useState(CARPOOL_DIRECTION.TO_SITE);
  const [origin, setOrigin] = useState({ label: '' });
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setDirection(CARPOOL_DIRECTION.TO_SITE);
    setOrigin({ label: '' });
    setStartLocal(toLocalInputValue(start));
    setEndLocal(toLocalInputValue(end));
    setErrors({});
  }, [open]);

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
      windowStart: localInputToISO(startLocal),
      windowEnd: localInputToISO(endLocal),
    };
    const parsed = postRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const fe = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'origin' ? 'origin' : issue.path[0] ?? '_form';
        if (!fe[key]) fe[key] = issue.message;
      }
      setErrors(fe);
      return;
    }
    if (new Date(payload.windowEnd) <= new Date(payload.windowStart)) {
      setErrors({ windowEnd: 'Window end must be after start.' });
      return;
    }
    setSubmitting(true);
    try {
      await carpoolApi.postRequest(parsed.data);
      toast.success("Request posted — we'll match you 🔎");
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
      title="Request a ride"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="press ripple" onPointerDown={ripple} onClick={submit} loading={submitting}>
            <Search className="h-4 w-4" /> Find me a ride
          </Button>
        </div>
      }
    >
      <div className="stagger space-y-4">
        <Select label="Direction" options={DIRECTION_OPTIONS} value={direction} onChange={(e) => setDirection(e.target.value)} />
        <GeoPointField
          label="Pickup point"
          value={origin}
          onChange={setOrigin}
          error={errors.origin}
          placeholder="Where should the driver pick you up?"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="datetime-local"
            label="Earliest"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            error={errors.windowStart}
          />
          <Input
            type="datetime-local"
            label="Latest"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
            error={errors.windowEnd}
          />
        </div>
        <p className="text-xs text-faint">We'll suggest rides departing inside your time window.</p>
        {errors._form && <p className="field-error">{errors._form}</p>}
      </div>
    </Modal>
  );
}
