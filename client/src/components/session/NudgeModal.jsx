import { useEffect, useState } from 'react';
import { Hand } from 'lucide-react';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Textarea } from '@/components/common/Input.jsx';
import { messageApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { useMessageConfig } from '@/hooks/useMessageConfig.js';
import { cn } from '@/utils/cn.js';

/**
 * Send a gentle, anonymous nudge to whoever is charging on a given charger. The recipient is
 * derived server-side from the live session; we send chargerId + sessionId + message. Presets are
 * admin-configured (useMessageConfig); a custom message is allowed within 100 chars.
 */
// Mirror of nudgeSchema.message's server cap (shared/validation.js). Presets are admin-editable
// and unbounded, so a preset can be longer than this — always clamp before it reaches state.
const MAX_NUDGE = 100;
const clampNudge = (s) => (s || '').slice(0, MAX_NUDGE);

export function NudgeModal({ open, onClose, charger }) {
  const { nudgePresets } = useMessageConfig();
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset to empty each time the modal opens, so a stale draft doesn't linger between sends.
  useEffect(() => {
    if (open) setMessage('');
  }, [open]);

  // Seed the first preset ONLY into an empty field. useMessageConfig resolves a beat after open;
  // guarding on the current value means a preset landing late can't wipe text the user already
  // typed in the ~100-300ms fetch window. Clamp because a programmatic setMessage bypasses the
  // textarea's maxLength and admin presets are unbounded.
  useEffect(() => {
    if (open && nudgePresets?.length) setMessage((m) => (m ? m : clampNudge(nudgePresets[0])));
  }, [open, nudgePresets]);

  const submit = async () => {
    setError(null);
    const body = { chargerId: charger?.id, sessionId: charger?.session?.id, message: message.trim() };
    if (!body.message) { setError('Enter a short message.'); return; }
    setSubmitting(true);
    try {
      await messageApi.nudge(body);
      toast.success('Nudge sent 👋');
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
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={submitting} className="press group"><Hand className="h-4 w-4 transition-transform duration-medium ease-spring group-hover:-rotate-12" /> Send nudge</Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-muted">Anonymous and friendly — pick a quick message or write your own.</p>
      <div className="mb-3 space-y-2">
        {(nudgePresets || []).map((preset, i) => (
          <button
            // Index-suffixed: presets are admin-editable and two entries could be identical.
            key={`${preset}-${i}`}
            type="button"
            onClick={() => setMessage(clampNudge(preset))}
            className={cn(
              'press w-full rounded-2xl border p-2.5 text-left text-sm transition-colors duration-medium ease-emphasized',
              message === clampNudge(preset) ? 'border-brand bg-brand/10 text-content' : 'border-border bg-bg-elevated text-muted hover:text-content'
            )}
          >
            {clampNudge(preset)}
          </button>
        ))}
      </div>
      <Textarea label="Message" value={message} maxLength={MAX_NUDGE} onChange={(e) => setMessage(clampNudge(e.target.value))} hint={`${message.length}/${MAX_NUDGE}`} />
      {error && <p className="field-error mt-2">{error}</p>}
    </Modal>
  );
}
