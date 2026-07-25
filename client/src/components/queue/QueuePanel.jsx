import { useState } from 'react';
import { ListOrdered, Hourglass, PartyPopper, LogOut, Plus } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { queueApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { burstConfetti } from '@/utils/confetti.js';
import { useCountdown } from '@/hooks/useCountdown.js';
import { QUEUE_STATUS } from '@/utils/constants.js';
import { cn } from '@/utils/cn.js';

/**
 * The charger queue: join for "any" charger, see your live position, and — when it's your turn —
 * a glowing claim banner with the grace-window countdown. Reads the already-fetched list + the
 * caller's own entry; all mutations refetch via onChanged.
 */
export function QueuePanel({ entries = [], mine, canJoin, onChanged }) {
  const [busy, setBusy] = useState(false);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      onChanged?.();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const myTurn = mine && mine.status === QUEUE_STATUS.NOTIFIED;

  return (
    <Card>
      <CardHeader title="Queue" subtitle={entries.length ? `${entries.length} waiting` : 'No one waiting'} icon={ListOrdered} />

      {/* It's-your-turn banner — the celebratory moment. */}
      {myTurn && <MyTurnBanner mine={mine} busy={busy} onClaim={() => run(() => queueApi.claim(mine.id), null)} />}

      {entries.length === 0 && !mine ? (
        // Compact inline empty — the header already says "No one waiting", so this doesn't repeat
        // it; it just offers the one action (join) with a light, non-bulky treatment.
        <div className="group flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-bg-elevated px-5 py-6 text-center transition-colors duration-medium ease-emphasized hover:border-brand/40">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-surface-2 text-faint transition-colors duration-medium ease-emphasized group-hover:bg-brand/10 group-hover:text-brand-strong">
            <Hourglass className="h-5 w-5" />
          </span>
          <p className="text-sm text-muted">Be first in line — get pinged the moment a charger frees up.</p>
          {canJoin && (
            <Button size="sm" className="press ripple" onClick={() => run(() => queueApi.join(), 'Joined the queue.')} loading={busy}>
              <Plus className="h-4 w-4" /> Join queue
            </Button>
          )}
        </div>
      ) : (
        <>
          <ol className="stagger space-y-1.5">
            {entries.map((e) => {
              const isMe = mine && e.id === mine.id;
              return (
                <li
                  key={e.id}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors duration-medium ease-emphasized',
                    isMe ? 'bg-brand/10 ring-1 ring-brand/40' : 'bg-bg-elevated'
                  )}
                >
                  <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums', isMe ? 'bg-brand text-brand-content' : 'bg-surface-2 text-muted')}>
                    {e.position}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-content">
                    {isMe ? 'You' : e.userDisplayName}
                    {e.status === QUEUE_STATUS.NOTIFIED && <span className="ml-1.5 text-xs font-medium text-brand-strong">· it's their turn</span>}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="mt-3">
            {mine ? (
              <Button variant="ghost" size="sm" className="w-full text-danger" onClick={() => run(() => queueApi.leave(mine.id), 'Left the queue.')} loading={busy}>
                <LogOut className="h-4 w-4" /> Leave queue
              </Button>
            ) : canJoin ? (
              <Button variant="secondary" size="sm" className="w-full" onClick={() => run(() => queueApi.join(), 'Joined the queue.')} loading={busy}>
                <Plus className="h-4 w-4" /> Join queue
              </Button>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}

/** The glowing "claim your turn" banner with the live grace-window countdown. */
function MyTurnBanner({ mine, busy, onClaim }) {
  const { label, done } = useCountdown(mine.expiresAt);
  return (
    <div className="animate-glow mb-3 overflow-hidden rounded-2xl border border-brand/50 bg-brand/10 p-3 hover-sheen">
      <div className="flex items-center gap-2 text-brand-strong">
        <PartyPopper className="h-5 w-5 animate-float" />
        <p className="font-semibold">It's your turn!</p>
      </div>
      <p className="mt-1 text-sm text-muted">
        {done ? 'Claim window closing…' : <>Claim within <span className="font-semibold tabular-nums text-content">{label}</span> to keep your spot.</>}
      </p>
      <Button
        size="sm"
        className="press ripple mt-2 w-full"
        loading={busy}
        // Once the grace window has elapsed the server will reject the claim ("no longer
        // available"), so disabling here prevents both a doomed request AND a premature confetti
        // burst that would celebrate a spot the user has already lost.
        disabled={busy || done}
        onClick={(e) => {
          if (done) return;
          // Burst from the button you actually pressed, in warm "you won the wait" colors.
          const r = e.currentTarget.getBoundingClientRect();
          burstConfetti({ x: r.left + r.width / 2, y: r.top, colors: ['#3c79bc', '#5a96d6', '#4ade80', '#f5c542', '#ffffff'] });
          onClaim();
        }}
      >
        {done ? 'Window closed' : 'Claim my charger'}
      </Button>
    </div>
  );
}
