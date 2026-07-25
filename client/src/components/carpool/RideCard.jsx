import { Car, MapPin, Users, Clock, Leaf } from 'lucide-react';
import { Badge } from '@/components/common/Badge.jsx';
import { Button } from '@/components/common/Button.jsx';
import { RIDE_STATUS, RIDE_STATUS_META, DIRECTION_LABEL } from '@/utils/constants.js';
import { formatDateTime } from '@/utils/time.js';
import { cn } from '@/utils/cn.js';

/**
 * A carpool ride tile. Used in the "find a ride" list (with a match score + Book action) and
 * in "my rides" (with manage actions). `variant` toggles which affordances show.
 */
export function RideCard({ ride, variant = 'browse', onBook, onCancel, onComplete, onManageBookings, onCancelSeat, busy }) {
  const meta = RIDE_STATUS_META[ride.status] || RIDE_STATUS_META.open;
  const score = ride.matchScore;
  // A completed/cancelled ride still shows in "my rides" for history, but its manage/cancel
  // actions no longer apply — hiding them avoids a dead "Cancel seat" that errors with
  // "Your booking could not be found" (the booking is no longer in the ride's active bookings).
  const isActive = ride.status !== RIDE_STATUS.COMPLETED && ride.status !== RIDE_STATUS.CANCELLED;

  return (
    <div className="group card card-interactive hover-sheen rounded-xl-increased flex h-full flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand/15 text-brand-strong transition-transform duration-medium ease-spring group-hover:scale-110 group-hover:-rotate-6">
            <Car className="h-5 w-5" />
          </span>
          <div>
            <p className="text-title-md text-content">{ride.driverName || 'You'}</p>
            <span className="text-xs text-muted">{DIRECTION_LABEL[ride.direction]}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {typeof score === 'number' && (
            <span className="text-xs font-medium text-success">{Math.round(score)}% match</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-1.5 text-muted">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="truncate">{ride.origin?.label}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted">
          <Clock className="h-4 w-4 shrink-0" />
          {formatDateTime(ride.departAt)}
        </div>
        <div className="flex items-center gap-1.5 text-muted">
          <Users className="h-4 w-4 shrink-0" />
          {ride.seatsAvailable} of {ride.seatsTotal} seats
        </div>
        {ride.co2GramsSaved > 0 && (
          <div className="flex items-center gap-1.5 font-medium text-success">
            <Leaf className="h-4 w-4 shrink-0 transition-transform duration-medium ease-spring group-hover:scale-110 group-hover:-rotate-6" />
            {Math.round((ride.co2GramsSaved / 1000) * 10) / 10} kg CO₂ saved
          </div>
        )}
      </div>

      {ride.notes && <p className="card-solid rounded-xl px-3 py-2 text-sm text-muted">{ride.notes}</p>}

      <div className={cn('mt-auto flex gap-2 pt-1', variant !== 'driving' && 'justify-end')}>
        {variant === 'browse' && (
          <Button size="sm" onClick={() => onBook?.(ride)} disabled={ride.seatsAvailable < 1}>
            Request a seat
          </Button>
        )}
        {variant === 'riding' && onCancelSeat && isActive && (
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => onCancelSeat(ride)} loading={busy}>
            Cancel seat
          </Button>
        )}
        {variant === 'driving' && isActive && (
          <>
            {onManageBookings && (
              <Button size="sm" variant="secondary" onClick={() => onManageBookings(ride)}>
                Riders
              </Button>
            )}
            {onComplete && (
              <Button size="sm" variant="ghost" onClick={() => onComplete(ride)} loading={busy}>
                Complete
              </Button>
            )}
            {onCancel && (
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => onCancel(ride)} loading={busy}>
                Cancel
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
