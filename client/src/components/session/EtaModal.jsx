import { useEffect, useState } from 'react';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { DurationSlider } from '@/components/common/DurationSlider.jsx';
import { sessionApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';

/**
 * Minutes between the session's start and its current ETA — the slider's true starting
 * point. Clamped/rounded to the slider's own bounds (30-240, step 15) so an unusual original
 * duration can never render the range input out of bounds.
 */
function originalDurationMinutes(session) {
  if (!session?.startedAt || !session?.etaAt) return 120;
  const mins = Math.round((new Date(session.etaAt).getTime() - new Date(session.startedAt).getTime()) / 60_000);
  if (mins <= 0) return 120;
  const stepped = Math.round(mins / 15) * 15;
  return Math.min(240, Math.max(30, stepped));
}

/**
 * Adjust ETA. Submits a new total duration in minutes measured from the session's start
 * (matches updateEtaSchema + the server clamping total to max session hours from start).
 */
export function EtaModal({ open, onClose, session, onUpdated }) {
  const [minutes, setMinutes] = useState(() => originalDurationMinutes(session));
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Re-seed from the session's actual current duration each time the modal opens — it was
  // previously hardcoded to 120, which silently shortened/lengthened sessions whose real
  // duration differed (updateEta treats this as a TOTAL from start, not "add N minutes").
  useEffect(() => {
    if (open) setMinutes(originalDurationMinutes(session));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await sessionApi.updateEta(session.id, minutes);
      toast.success('Estimated finish time updated.');
      onUpdated?.();
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
      title="Adjust your ETA"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting}>
            Update
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-muted">Set the total time you need, measured from when you started.</p>
      <DurationSlider label="Total duration" value={minutes} onChange={setMinutes} />
      {error && <p className="field-error mt-3">{error}</p>}
    </Modal>
  );
}
