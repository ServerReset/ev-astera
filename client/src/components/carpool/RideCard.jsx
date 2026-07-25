import { Car, MapPin, Clock, Users, Sprout, ArrowRight, Gauge, UserRound, CheckCircle2, X } from 'lucide-react';
import { Badge } from '@/components/common/Badge.jsx';
import { Button } from '@/components/common/Button.jsx';
import { RIDE_STATUS, RIDE_STATUS_META, DIRECTION_LABEL } from '@/utils/constants.js';
import { formatDateTime } from '@/utils/time.js';
import { useTilt, useRipple } from '@/hooks/useInteractions.js';
import { cn } from '@/utils/cn.js';

/** Match-score → tone + label. High matches earn a celebratory brand read. */
function matchTone(score) {
  if (score >= 80) return { tone: 'success', label: 'Great match' };
  if (score >= 60) return { tone: 'brand', label: 'Good match' };
  return { tone: 'info', label: 'Match' };
}

/**
 * A single carpool ride tile. `variant` picks the action set:
 *   - 'browse'  → Book a seat (open rides to join), shows a match-score badge
 *   - 'riding'  → Cancel seat (a ride you've booked)
 *   - 'driving' → Riders / Complete / Cancel (a ride you're driving)
 * Manage/cancel actions hide once the ride is completed or cancelled. Browse tiles get the full
 * tilt + sheen "tappable" treatment; the others render flat.
 */
export function RideCard({ ride, variant = 'browse', onBook, onCancelSeat, onManage, onComplete, onCancelRide }) {
  const meta = RIDE_STATUS_META[ride.status] || RIDE_STATUS_META.open;
  const closed = ride.status === RIDE_STATUS.COMPLETED || ride.status === RIDE_STATUS.CANCELLED;
  const co2Kg = Math.round(((ride.co2GramsSaved || 0) / 1000) * 10) / 10;
  const interactive = variant === 'browse' && ride.status === RIDE_STATUS.OPEN && ride.seatsAvailable > 0;
  const tiltRef = useTilt(4);
  const ripple = useRipple();
  const mt = matchTone(ride.matchScore || 0);

  const card = (
    <div
      className={cn(
        'card group relative flex h-full flex-col overflow-hidden rounded-xl-increased p-4 transition-all duration-medium ease-emphasized',
        interactive && 'card-interactive hover-sheen',
        closed && 'opacity-75'
      )}
    >
      <div className="relative flex flex-1 flex-col gap-3">
        {/* Header: driver + direction + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-transform duration-medium ease-spring',
                interactive
                  ? 'bg-brand/15 text-brand-strong ring-1 ring-brand/20 group-hover:scale-105 group-hover:ring-brand/40'
                  : 'bg-surface-2 text-muted'
              )}
            >
              <Car className={cn('h-5 w-5 transition-transform duration-medium ease-spring', interactive && 'group-hover:translate-x-0.5')} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-title-md text-content">{ride.driverName || 'Driver'}</p>
              <span className="flex items-center gap-1 text-xs text-muted">
                {DIRECTION_LABEL[ride.direction]}
                <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge tone={meta.tone} dot>{meta.label}</Badge>
            {variant === 'browse' && typeof ride.matchScore === 'number' && (
              <Badge tone={mt.tone} className="tabular-nums">
                <Gauge className="h-3 w-3" />
                {ride.matchScore}% · {mt.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Origin + depart */}
        <div className="rounded-2xl bg-bg-elevated p-3 text-sm">
          <p className="flex items-start gap-2 text-content">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span className="leading-snug">{ride.origin?.label || 'Pickup point'}</span>
          </p>
          <p className="mt-2 flex items-center gap-2 text-muted">
            <Clock className="h-4 w-4 shrink-0" />
            {formatDateTime(ride.departAt)}
          </p>
        </div>

        {ride.notes && <p className="text-xs text-muted line-clamp-2">{ride.notes}</p>}

        {/* Stat chips: seats + CO2 */}
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-content">
            <Users className="h-3.5 w-3.5 text-muted" />
            <span className="font-semibold tabular-nums">{ride.seatsAvailable}</span>
            <span className="text-muted">/ {ride.seatsTotal} seats</span>
          </span>
          {interactive && ride.seatsAvailable === 1 && (
            <span className="flex items-center gap-1 rounded-full bg-warning/20 px-2.5 py-1 text-xs font-semibold text-warning">
              Last seat — grab it
            </span>
          )}
          {co2Kg > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs text-success">
              <Sprout className="h-3.5 w-3.5" />
              <span className="font-semibold tabular-nums">{co2Kg} kg</span>
              CO₂ saved
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {variant === 'browse' && interactive && (
            <Button size="sm" className="press hover-sheen ripple flex-1" onPointerDown={ripple} onClick={() => onBook?.(ride)}>
              <Car className="h-4 w-4" /> Book a seat
            </Button>
          )}

          {variant === 'riding' && !closed && (
            <Button size="sm" variant="ghost" className="press ripple flex-1" onPointerDown={ripple} onClick={() => onCancelSeat?.(ride)}>
              <X className="h-4 w-4" /> Cancel seat
            </Button>
          )}

          {variant === 'driving' && (
            <>
              <Button size="sm" variant="secondary" className="press ripple flex-1" onPointerDown={ripple} onClick={() => onManage?.(ride)}>
                <UserRound className="h-4 w-4" /> Riders
              </Button>
              {!closed && (
                <>
                  <Button size="sm" className="press ripple flex-1" onPointerDown={ripple} onClick={() => onComplete?.(ride)}>
                    <CheckCircle2 className="h-4 w-4" /> Complete
                  </Button>
                  <Button size="sm" variant="ghost" className="press ripple" onPointerDown={ripple} onClick={() => onCancelRide?.(ride)} aria-label="Cancel ride">
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (interactive) {
    return <div ref={tiltRef} className="tilt h-full">{card}</div>;
  }
  return card;
}
