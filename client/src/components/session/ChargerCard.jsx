import { Zap, User, Users, Car, Hand } from 'lucide-react';
import { Badge } from '@/components/common/Badge.jsx';
import { Button } from '@/components/common/Button.jsx';
import { CHARGER_STATUS, CHARGER_STATUS_META, DIRECTION_LABEL } from '@/utils/constants.js';
import { formatTime, relativeTime } from '@/utils/time.js';
import { useTilt, useRipple } from '@/hooks/useInteractions.js';
import { cn } from '@/utils/cn.js';

/**
 * A single charger tile for the dashboard grid. Shows live status, the current session
 * (with occupant + ETA), queue depth, and — the carpool tie-in — a chip
 * when the occupant is carpooling today. Action buttons are contextual to the viewer.
 */
export function ChargerCard({ charger, isMine, canStart, onStart, onNudge, onEndMine }) {
  const meta = CHARGER_STATUS_META[charger.status] || CHARGER_STATUS_META.available;
  const s = charger.session;
  const offline = charger.status === CHARGER_STATUS.OFFLINE;
  // A reserved charger is free but spoken-for by a queue turn in progress — don't offer Start to
  // others (the server rejects it anyway; this keeps the UI honest). See charger.service reserved.
  const available = charger.status === CHARGER_STATUS.AVAILABLE && !charger.reserved;
  // The hero interaction: an available, startable card feels irresistibly tappable — a subtle
  // tilt-toward-cursor on the wrapper (kept off the card so it doesn't fight the hover lift). The
  // card is NOT itself a click target (that would be a mouse-only, keyboard-unreachable action, and
  // clicking any corner to start a session is easy to do by accident) — the "Start charging" button
  // inside is the real, fully-accessible action; the lift/sheen just draw the eye to it.
  const interactive = available && canStart;
  const tiltRef = useTilt(5);
  const ripple = useRipple();

  const card = (
    <div
      className={cn(
        'card group relative flex h-full flex-col overflow-hidden rounded-xl-increased p-4 transition-all duration-medium ease-emphasized',
        available && 'card-interactive hover-sheen',
        charger.status === CHARGER_STATUS.OVERTIME && 'border-warning/50',
        isMine && 'ring-2 ring-brand/50'
      )}
    >
      {/* Overtime urgency: a soft, slowly-breathing warning aura bleeding in from the corner. */}
      {charger.status === CHARGER_STATUS.OVERTIME && (
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 animate-pulse rounded-full bg-warning/25 blur-2xl"
          aria-hidden
        />
      )}

      <div className="relative flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'grid h-11 w-11 place-items-center rounded-2xl transition-transform duration-medium ease-spring',
              available
                ? 'bg-brand/15 text-brand-strong ring-1 ring-brand/20 group-hover:scale-105 group-hover:ring-brand/40'
                : 'bg-surface-2 text-muted'
            )}
          >
            <Zap
              className={cn(
                'h-5 w-5 transition-transform duration-medium ease-spring',
                available && 'group-hover:scale-110 group-hover:-rotate-6'
              )}
            />
          </span>
          <div>
            <p className="text-title-md text-content">{charger.name}</p>
            <Badge tone={meta.tone} dot>
              {meta.label}
            </Badge>
          </div>
        </div>
        {charger.queueCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted">
            <Users className="h-3.5 w-3.5" />
            {charger.queueCount}
          </span>
        )}
      </div>

      {/* Occupied */}
      {s && (
        <div className="rounded-2xl bg-bg-elevated p-3 text-sm">
          <div className="flex items-center gap-2 text-content">
            <User className="h-4 w-4 text-muted" />
            <span className="font-medium">{isMine ? 'You' : s.userDisplayName}</span>
          </div>
          {s.vehicleDescription && <p className="mt-1 text-xs text-muted">{s.vehicleDescription}</p>}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-muted">Est. done {formatTime(s.etaAt)}</span>
            <span className={cn(charger.status === CHARGER_STATUS.OVERTIME ? 'text-warning' : 'text-faint')}>
              {relativeTime(s.etaAt)}
            </span>
          </div>
          {charger.carpool && (
            <div className="mt-2 flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs text-brand-strong">
              <Car className="h-3.5 w-3.5" />
              Carpooling {DIRECTION_LABEL[charger.carpool.direction]} · departs {formatTime(charger.carpool.departAt)}
            </div>
          )}
        </div>
      )}

      {offline && charger.offlineReason && <p className="text-xs text-faint">{charger.offlineReason}</p>}

      {charger.reserved && !s && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Users className="h-3.5 w-3.5" />
          Reserved for the next person in the queue
        </p>
      )}

      {/* Actions */}
      <div className="mt-auto flex gap-2 pt-1">
        {available && canStart && (
          <Button
            size="sm"
            className="press hover-sheen ripple flex-1"
            onPointerDown={ripple}
            onClick={(e) => {
              e.stopPropagation();
              onStart?.(charger);
            }}
          >
            Start charging
          </Button>
        )}
        {s && isMine && (
          <Button size="sm" variant="secondary" className="press ripple flex-1" onPointerDown={ripple} onClick={() => onEndMine?.(charger)}>
            End session
          </Button>
        )}
        {s && !isMine && (
          <Button size="sm" variant="ghost" className="press ripple group/nudge flex-1" onPointerDown={ripple} onClick={() => onNudge?.(charger)}>
            <Hand className="h-4 w-4 transition-transform duration-medium ease-spring group-hover/nudge:-rotate-12" />
            Nudge
          </Button>
        )}
      </div>
      </div>
    </div>
  );

  // Only available/startable cards get the 3D tilt; occupied/offline tiles stay calm and flat.
  if (interactive) {
    return (
      <div ref={tiltRef} className="tilt h-full">
        {card}
      </div>
    );
  }
  return card;
}
