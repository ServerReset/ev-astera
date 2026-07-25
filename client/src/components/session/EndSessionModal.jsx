import { useEffect, useState } from 'react';
import { PlugZap, Check } from 'lucide-react';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { sessionApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { cn } from '@/utils/cn.js';

// The four wrap-up confirmations (endSessionSchema: all must be true).
const CHECKS = [
  { key: 'unplugged', label: 'Unplugged the cable' },
  { key: 'capped', label: 'Capped the connector' },
  { key: 'cablesWrapped', label: 'Wrapped the cables neatly' },
  { key: 'vehicleMoved', label: "I'll move my vehicle promptly" },
];

/** End a charging session — a courteous wrap-up checklist so the next person finds it tidy. */
export function EndSessionModal({ open, session, onClose, onEnded }) {
  const [state, setState] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const ripple = useRipple();

  useEffect(() => { if (open) { setState({}); setError(null); } }, [open]);

  const allChecked = CHECKS.every((c) => state[c.key]);

  const submit = async () => {
    setError(null);
    if (!allChecked) { setError('Please confirm all four before ending.'); return; }
    setSubmitting(true);
    try {
      await sessionApi.end(session.id, { unplugged: true, capped: true, cablesWrapped: true, vehicleMoved: true });
      toast.success('Session ended — thanks for keeping the lot moving!');
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
      title="Wrap up your session"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="press ripple" onPointerDown={ripple} onClick={submit} loading={submitting} disabled={!allChecked}>
            <PlugZap className="h-4 w-4" /> End session
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-muted">A quick courtesy check before you free the charger.</p>
      <div className="stagger space-y-2">
        {CHECKS.map((c) => {
          const on = !!state[c.key];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setState((s) => ({ ...s, [c.key]: !s[c.key] }))}
              aria-pressed={on}
              className={cn(
                'press flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm transition-colors duration-medium ease-emphasized',
                on ? 'border-success/50 bg-success/10 text-content' : 'border-border bg-bg-elevated text-muted hover:border-border-strong'
              )}
            >
              <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition-colors', on ? 'border-success bg-success text-white' : 'border-border-strong')}>
                {on && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
              {c.label}
            </button>
          );
        })}
      </div>
      {error && <p className="field-error mt-2">{error}</p>}
    </Modal>
  );
}
