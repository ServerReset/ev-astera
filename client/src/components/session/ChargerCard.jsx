import { Zap, User, Users, Car, Hand } from 'lucide-react';
import { Badge } from '@/components/common/Badge.jsx';
import { Button } from '@/components/common/Button.jsx';
import { CHARGER_STATUS, CHARGER_STATUS_META, DIRECTION_LABEL } from '@/utils/constants.js';
import { formatTime, relativeTime } from '@/utils/time.js';
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
  const available = charger.status === CHARGER_STATUS.AVAILABLE;

  return (
    <div
      className={cn(
        'card p-4 flex flex-col gap-3 transition-shadow',
        charger.status === CHARGER_STATUS.OVERTIME && 'border-warning/40',
        isMine && 'ring-1 ring-brand/50'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'grid h-10 w-10 place-items-center rounded-xl',
              available ? 'bg-brand/15 text-brand' : 'bg-surface-2 text-muted'
            )}
          >
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-content">{charger.name}</p>
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
        <div className="rounded-xl bg-bg-elevated p-3 text-sm">
          <div className="flex items-center gap-2 text-content">
            <User className="h-4 w-4 text-muted" />
            <span className="font-medium">{isMine ? 'You' : s.userDisplayName}</span>
            {s.parkingSpot && <span className="text-faint">· {s.parkingSpot}</span>}
          </div>
          {s.vehicleDescription && <p className="mt-1 text-xs text-muted">{s.vehicleDescription}</p>}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-muted">Est. done {formatTime(s.etaAt)}</span>
            <span className={cn(charger.status === CHARGER_STATUS.OVERTIME ? 'text-warning' : 'text-faint')}>
              {relativeTime(s.etaAt)}
            </span>
          </div>
          {charger.carpool && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand/10 px-2 py-1 text-xs text-brand">
              <Car className="h-3.5 w-3.5" />
              Carpooling {DIRECTION_LABEL[charger.carpool.direction]} · departs {formatTime(charger.carpool.departAt)}
            </div>
          )}
        </div>
      )}

      {offline && charger.offlineReason && <p className="text-xs text-faint">{charger.offlineReason}</p>}

      {/* Actions */}
      <div className="mt-auto flex gap-2 pt-1">
        {available && canStart && (
          <Button size="sm" className="flex-1" onClick={() => onStart?.(charger)}>
            Start charging
          </Button>
        )}
        {s && isMine && (
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => onEndMine?.(charger)}>
            End session
          </Button>
        )}
        {s && !isMine && (
          <Button size="sm" variant="ghost" className="flex-1" onClick={() => onNudge?.(charger)}>
            <Hand className="h-4 w-4" />
            Nudge
          </Button>
        )}
      </div>
    </div>
  );
}
