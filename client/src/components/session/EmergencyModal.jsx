import { useEffect, useState } from 'react';
import { Siren } from 'lucide-react';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Select, Textarea } from '@/components/common/Input.jsx';
import { messageApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { useMessageConfig } from '@/hooks/useMessageConfig.js';

/**
 * Raise an "I need a charger now" emergency. Alerts everyone currently charging so they can offer
 * to wrap up. Reasons are admin-configured (useMessageConfig); cooldown-limited server-side.
 */
export function EmergencyModal({ open, onClose }) {
  const { emergencyReasons } = useMessageConfig();
  const [reason, setReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setReason(emergencyReasons?.[0] || ''); setExplanation(''); setError(null); }
  }, [open, emergencyReasons]);

  const submit = async () => {
    setError(null);
    if (!reason) { setError('Choose a reason.'); return; }
    setSubmitting(true);
    try {
      await messageApi.requestEmergency({ reason, explanation: explanation.trim() || undefined });
      toast.success('Everyone charging has been alerted.');
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
      title="Request a charger urgently"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={submit} loading={submitting} className="press"><Siren className="h-4 w-4" /> Send request</Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-muted">This pings everyone currently charging. Use sparingly — there's a cooldown.</p>
      <div className="space-y-4">
        <Select
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={(emergencyReasons || []).map((r) => ({ value: r, label: r }))}
        />
        <Textarea label="Anything to add? (optional)" value={explanation} maxLength={200} onChange={(e) => setExplanation(e.target.value)} hint={`${explanation.length}/200`} />
        {error && <p className="field-error">{error}</p>}
      </div>
    </Modal>
  );
}
