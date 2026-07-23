import { useState } from 'react';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { DurationSlider } from '@/components/common/DurationSlider.jsx';
import { sessionApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';

/**
 * Adjust ETA. Submits a new total duration in minutes measured from the session's start
 * (matches updateEtaSchema + the server clamping total to max session hours from start).
 */
export function EtaModal({ open, onClose, session, onUpdated }) {
  const [minutes, setMinutes] = useState(120);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
