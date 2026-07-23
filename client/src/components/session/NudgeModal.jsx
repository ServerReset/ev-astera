import { useState } from 'react';
import { nudgeSchema } from '@shared/validation.js';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Textarea } from '@/components/common/Input.jsx';
import { messageApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { NUDGE_PRESETS } from '@/utils/constants.js';
import { cn } from '@/utils/cn.js';

/**
 * Send a polite nudge to whoever is charging on a given charger. The recipient is derived
 * server-side from the live session; we only send chargerId + sessionId + message. Presets
 * make the common case one tap; a custom message is allowed within the 100-char limit.
 */
export function NudgeModal({ open, onClose, charger }) {
  const [message, setMessage] = useState(NUDGE_PRESETS[0]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    const body = { chargerId: charger?.id, sessionId: charger?.session?.id, message: message.trim() };
    const parsed = nudgeSchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Enter a message.');
      return;
    }
    setSubmitting(true);
    try {
      await messageApi.nudge(parsed.data);
      toast.success('Nudge sent.');
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
      title={`Nudge ${charger?.session?.userDisplayName || 'the driver'}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting}>
            Send nudge
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-muted">Pick a quick message or write your own.</p>
      <div className="mb-3 space-y-2">
        {NUDGE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setMessage(preset)}
            className={cn(
              'w-full rounded-xl border p-2.5 text-left text-sm transition-colors',
              message === preset ? 'border-brand bg-brand/10 text-content' : 'border-border bg-bg-elevated text-muted hover:text-content'
            )}
          >
            {preset}
          </button>
        ))}
      </div>
      <Textarea
        label="Message"
        value={message}
        maxLength={100}
        onChange={(e) => setMessage(e.target.value)}
        hint={`${message.length}/100`}
      />
      {error && <p className="field-error mt-2">{error}</p>}
    </Modal>
  );
}
