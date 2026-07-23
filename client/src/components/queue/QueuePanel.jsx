import { useState } from 'react';
import { Users, ArrowRight, LogOut, Hand } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { EmptyState } from '@/components/common/States.jsx';
import { useCountdown } from '@/hooks/useCountdown.js';
import { queueApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { QUEUE_STATUS, QUEUE_STATUS_LABEL } from '@/utils/constants.js';
import { cn } from '@/utils/cn.js';

/**
 * The location queue. Shows the ordered line and, when the viewer is in it, their live
 * position plus the grace/claim countdown and the contextual action (claim their turn, or
 * leave). `mine` is the viewer's entry (or null); `entries` is the full ordered list.
 */
export function QueuePanel({ entries = [], mine, canJoin, onJoin, onChanged }) {
  const [busy, setBusy] = useState(false);

  const run = async (fn, successMsg) => {
    setBusy(true);
    try {
      await fn();
      if (successMsg) toast.success(successMsg);
      onChanged?.();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Queue"
        subtitle={entries.length ? `${entries.length} waiting` : 'No one waiting'}
        icon={Users}
        action={
          !mine && canJoin ? (
            <Button size="sm" onClick={() => run(() => queueApi.join(null), "You're in the queue.")} loading={busy}>
              Join queue
            </Button>
          ) : null
        }
      />

      {mine && <MyTurnBanner entry={mine} busy={busy} run={run} onChanged={onChanged} />}

      {entries.length === 0 ? (
        <EmptyState icon={Users} title="The queue is empty" description="Join to be notified the moment a charger frees up." />
      ) : (
        <ol className="space-y-1.5">
          {entries.map((e) => {
            const isMine = mine && e.id === mine.id;
            return (
              <li
                key={e.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm',
                  isMine ? 'bg-brand/10 ring-1 ring-brand/40' : 'bg-bg-elevated'
                )}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted">
                  {e.position}
                </span>
                <span className="min-w-0 flex-1 truncate text-content">
                  {isMine ? 'You' : e.userDisplayName}
                  {e.prioritySource === 'carpool' && (
                    <Badge tone="brand" className="ml-2">
                      Carpool priority
                    </Badge>
                  )}
                </span>
                {e.status !== QUEUE_STATUS.WAITING && (
                  <Badge tone={e.status === QUEUE_STATUS.NOTIFIED ? 'success' : 'info'}>
                    {QUEUE_STATUS_LABEL[e.status]}
                  </Badge>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

/** Banner for the viewer's own entry: countdown + claim/leave depending on status. */
function MyTurnBanner({ entry, busy, run, onChanged }) {
  const notified = entry.status === QUEUE_STATUS.NOTIFIED;
  const claimed = entry.status === QUEUE_STATUS.CLAIMED;
  const { label, done } = useCountdown(entry.expiresAt, { onDone: onChanged });

  return (
    <div
      className={cn(
        'mb-3 rounded-xl border p-3',
        notified ? 'border-success/50 bg-success/10' : claimed ? 'border-info/50 bg-info/10' : 'border-border bg-bg-elevated'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-content">
            {notified ? "It's your turn!" : claimed ? "You've claimed a charger" : `You're #${entry.position} in line`}
          </p>
          {(notified || claimed) && entry.expiresAt && (
            <p className="text-xs text-muted tabular-nums">
              {done ? 'Time expired' : `${notified ? 'Claim within' : 'Start within'} ${label}`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {notified && (
            <Button size="sm" onClick={() => run(() => queueApi.claim(entry.id), 'Claimed! Head to the charger.')} loading={busy}>
              <Hand className="h-4 w-4" />
              Claim
            </Button>
          )}
          {claimed && (
            <span className="flex items-center gap-1 text-xs text-info">
              <ArrowRight className="h-3.5 w-3.5" />
              Start your session
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => run(() => queueApi.leave(entry.id), 'Left the queue.')}
            loading={busy}
          >
            <LogOut className="h-4 w-4" />
            Leave
          </Button>
        </div>
      </div>
    </div>
  );
}
