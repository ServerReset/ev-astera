import { useState } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { endSessionSchema } from '@shared/validation.js';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { useRipple } from '@/hooks/useInteractions.js';
import { sessionApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { cn } from '@/utils/cn.js';

/** The clean-up checklist enforced when ending a session (endSessionSchema requires all true). */
const CHECKLIST = [
  { key: 'unplugged', label: "I've unplugged the connector" },
  { key: 'capped', label: "I've replaced the charger cap" },
  { key: 'cablesWrapped', label: "I've wrapped the cables neatly" },
  { key: 'vehicleMoved', label: 'I will move my vehicle so the next person can charge' },
];

export function EndSessionModal({ open, onClose, session, onEnded }) {
  const [checked, setChecked] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const ripple = useRipple();

  const toggle = (key) => setChecked((c) => ({ ...c, [key]: !c[key] }));
  const allChecked = CHECKLIST.every((c) => checked[c.key]);

  const submit = async () => {
    const parsed = endSessionSchema.safeParse(checked);
    if (!parsed.success) {
      setError('Please confirm every step first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await sessionApi.end(session.id, parsed.data);
      toast.success('Session ended. Thanks for keeping it tidy!');
      setChecked({});
      onEnded?.();
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
      title="End charging session"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className={cn('ripple', allChecked && 'hover-sheen')}
            onPointerDown={ripple}
            onClick={submit}
            loading={submitting}
            disabled={!allChecked}
          >
            End session
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-muted">Before you go, confirm the charger is ready for the next person.</p>
      <div className="space-y-2">
        {CHECKLIST.map((item, i) => {
          const on = Boolean(checked[item.key]);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggle(item.key)}
              className={cn(
                'press flex w-full animate-slide-up items-center gap-3 rounded-2xl border p-3 text-left text-sm transition-colors duration-medium [animation-fill-mode:backwards]',
                on ? 'border-success/50 bg-success/10 text-content' : 'border-border bg-bg-elevated text-muted hover:text-content hover:border-border-strong'
              )}
              style={{ animationDelay: `${i * 50}ms` }}
              aria-pressed={on}
            >
              <CheckCircle2
                className={cn(
                  'h-5 w-5 shrink-0 transition-transform duration-medium ease-spring',
                  on ? 'scale-110 text-success' : 'text-faint'
                )}
              />
              {item.label}
            </button>
          );
        })}
      </div>
      {allChecked && !error && (
        <div className="mt-3 flex animate-scale-in items-center gap-2 rounded-2xl border border-success/40 bg-success/10 p-3 text-sm text-content">
          <Sparkles className="h-4 w-4 shrink-0 text-success" aria-hidden />
          All set — the charger's ready for the next driver. Thanks for keeping it tidy!
        </div>
      )}
      {error && <p className="field-error mt-3">{error}</p>}
    </Modal>
  );
}
