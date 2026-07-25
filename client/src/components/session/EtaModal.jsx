import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { DurationSlider } from '@/components/common/DurationSlider.jsx';
import { sessionApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { useSessionConfig } from '@/hooks/useSessionConfig.js';
import { useRipple } from '@/hooks/useInteractions.js';

/** Adjust a live session's total duration (from its start). */
export function EtaModal({ open, session, onClose, onUpdated }) {
  const maxMinutes = useSessionConfig();
  const [duration, setDuration] = useState(120);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const ripple = useRipple();

  // Reset on OPEN only — keying on maxMinutes too would reset the slider the moment the async
  // session-config request resolves, discarding a value the user had already dragged to.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) { setDuration(Math.min(120, maxMinutes || 240)); setError(null); } }, [open]);

  // Clamp down to the real ceiling once it loads (or if an admin lowers it mid-session), so we
  // never submit a duration the server will reject.
  useEffect(() => {
    if (maxMinutes) setDuration((d) => Math.min(d, maxMinutes));
  }, [maxMinutes]);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await sessionApi.updateEta(session.id, duration);
      toast.success('Charging time updated.');
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
      title="Adjust charging time"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="press ripple" onPointerDown={ripple} onClick={submit} loading={submitting}>
            <Clock className="h-4 w-4" /> Update
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted">Total time from when you started. We'll recompute your ETA.</p>
        <DurationSlider label="Total charging time" value={duration} onChange={setDuration} max={maxMinutes || 240} />
        {error && <p className="field-error">{error}</p>}
      </div>
    </Modal>
  );
}
