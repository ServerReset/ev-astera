import { useEffect, useState } from 'react';
import { Siren } from 'lucide-react';
import { emergencyRequestSchema } from '@shared/validation.js';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Textarea, Select } from '@/components/common/Input.jsx';
import { messageApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { useMessageConfig } from '@/hooks/useMessageConfig.js';

/**
 * Raise an emergency "I need a charger now" request. Cooldown-limited server-side; the
 * request notifies current chargers so they can offer to wrap up. Use sparingly — the copy
 * says so, and the server enforces a cooldown. The reason list is admin-editable per office
 * (useMessageConfig) — the server validates the submission against that same live list.
 */
export function EmergencyModal({ open, onClose }) {
  const { emergencyReasons } = useMessageConfig();
  const [reason, setReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Seed the select with the first reason once the list loads.
  useEffect(() => {
    if (emergencyReasons?.length && !reason) setReason(emergencyReasons[0]);
  }, [emergencyReasons, reason]);

  const submit = async () => {
    setError(null);
    const parsed = emergencyRequestSchema.safeParse({ reason, explanation: explanation.trim() || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Please choose a reason.');
      return;
    }
    setSubmitting(true);
    try {
      await messageApi.requestEmergency(parsed.data);
      toast.success('Emergency request sent to current chargers.');
      setExplanation('');
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
      title="Request emergency access"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" className="press" onClick={submit} loading={submitting}>
            Send request
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex animate-fade-in items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/5 p-3 text-sm text-muted">
        <Siren className="h-5 w-5 shrink-0 animate-pulse text-danger" />
        <span>This alerts everyone currently charging. Please only use it for genuine emergencies — there's a cooldown between requests.</span>
      </div>
      <Select
        label="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        options={(emergencyReasons || []).map((r) => ({ value: r, label: r }))}
        className="mb-3"
      />
      <Textarea
        label="Details (optional)"
        value={explanation}
        maxLength={200}
        onChange={(e) => setExplanation(e.target.value)}
        placeholder="Anything that helps others decide"
      />
      {error && <p className="field-error mt-2">{error}</p>}
    </Modal>
  );
}
