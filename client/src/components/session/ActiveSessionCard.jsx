import { useState } from 'react';
import { Zap, Clock, Timer } from 'lucide-react';
import { Card } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { useCountdown } from '@/hooks/useCountdown.js';
import { formatTime } from '@/utils/time.js';
import { SESSION_STATUS } from '@/utils/constants.js';
import { cn } from '@/utils/cn.js';

/**
 * Banner for the viewer's own active session: a live countdown to ETA, overtime emphasis,
 * and quick actions (extend ETA, end). Rendered at the top of the dashboard when present.
 */
export function ActiveSessionCard({ session, onExtend, onEnd, onLinkCarpool }) {
  const overtime = session.status === SESSION_STATUS.OVERTIME;
  const { label, done } = useCountdown(session.etaAt);
  const [busy, setBusy] = useState(false);

  const wrap = (fn) => async () => {
    setBusy(true);
    try {
      await fn?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cn('relative overflow-hidden', overtime ? 'border-warning/50' : 'border-brand/40')}>
      <div className={cn('absolute inset-x-0 top-0 h-1', overtime ? 'bg-warning' : 'bg-brand')} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn('grid h-12 w-12 place-items-center rounded-2xl', overtime ? 'bg-warning/15 text-warning' : 'bg-brand/15 text-brand animate-pulse-ring')}>
            <Zap className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm text-muted">{session.chargerName || 'Your charger'}</p>
            <p className="text-lg font-semibold text-content">
              {overtime ? 'Overtime' : 'Charging'}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className={cn('flex items-center justify-end gap-1.5 text-2xl font-bold tabular-nums', overtime ? 'text-warning' : 'text-content')}>
            {overtime ? <Timer className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
            {overtime ? `+${label}` : done ? '0:00' : label}
          </div>
          <p className="text-xs text-faint">
            {overtime ? 'over your estimate' : `est. done ${formatTime(session.etaAt)}`}
          </p>
        </div>
      </div>

      {overtime && (
        <div className="mt-3">
          <Badge tone="warning">Others may be waiting — please wrap up or extend.</Badge>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" loading={busy} onClick={wrap(onExtend)}>
          Adjust ETA
        </Button>
        {onLinkCarpool && (
          <Button variant="ghost" size="sm" onClick={onLinkCarpool}>
            Offer a carpool
          </Button>
        )}
        <Button variant="primary" size="sm" className="ml-auto" loading={busy} onClick={wrap(onEnd)}>
          End session
        </Button>
      </div>
    </Card>
  );
}
