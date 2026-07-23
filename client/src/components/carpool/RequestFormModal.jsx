import { useEffect, useRef, useState } from 'react';
import { postRequestSchema } from '@shared/validation.js';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input, Select } from '@/components/common/Input.jsx';
import { GeoPointField } from './GeoPointField.jsx';
import { carpoolApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { toLocalInputValue, localInputToISO } from '@/utils/time.js';
import { CARPOOL_DIRECTION, DIRECTION_LABEL } from '@/utils/constants.js';
import { useHqAddress } from '@/hooks/useHqAddress.js';

/**
 * Post a ride request — "I need a ride" (Feature 1b). The matcher pairs open requests with
 * open rides in the window. Body matches postRequestSchema.
 */
export function RequestFormModal({ open, onClose, onCreated, groups = [] }) {
  const [direction, setDirection] = useState(CARPOOL_DIRECTION.TO_SITE);
  const [origin, setOrigin] = useState(null);
  const [startLocal, setStartLocal] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [endLocal, setEndLocal] = useState(() => toLocalInputValue(new Date(Date.now() + 3 * 60 * 60 * 1000)));
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
      windowStart: localInputToISO(startLocal),
      windowEnd: localInputToISO(endLocal),
      groupId: groupId || undefined,
    };
    const parsed = postRequestSchema.safeParse(body);
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
      await carpoolApi.postRequest(parsed.data);
      toast.success("Request posted. We'll match you with a driver.");
      setOrigin(null);
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
      title="Request a ride"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting}>
            Post request
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Select
          label="Direction"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          options={Object.values(CARPOOL_DIRECTION).map((d) => ({ value: d, label: DIRECTION_LABEL[d] }))}
        />
        <GeoPointField label="Pick me up near" value={origin} onChange={setOrigin} error={errors.origin} />
        <Input
          label="Earliest departure"
          type="datetime-local"
          value={startLocal}
          onChange={(e) => setStartLocal(e.target.value)}
          error={errors.windowStart}
        />
        <Input
          label="Latest departure"
          type="datetime-local"
          value={endLocal}
          onChange={(e) => setEndLocal(e.target.value)}
          error={errors.windowEnd}
        />
        {groups.length > 0 && (
          <Select label="Group (optional)" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Anyone at the site</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        )}
        {formError && <p className="field-error">{formError}</p>}
      </div>
    </Modal>
  );
}
