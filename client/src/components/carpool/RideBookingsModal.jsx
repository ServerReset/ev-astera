import { Check, X, MapPin, UserRound, Users } from 'lucide-react';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { Spinner, EmptyState, ErrorState } from '@/components/common/States.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { carpoolApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { burstConfetti } from '@/utils/confetti.js';
import { BOOKING_STATUS, BOOKING_STATUS_LABEL } from '@/utils/constants.js';

const STATUS_TONE = {
  [BOOKING_STATUS.REQUESTED]: 'warning',
  [BOOKING_STATUS.CONFIRMED]: 'success',
  [BOOKING_STATUS.DECLINED]: 'danger',
  [BOOKING_STATUS.CANCELLED]: 'faint',
  [BOOKING_STATUS.COMPLETED]: 'info',
};

/**
 * Driver's view of who wants a seat on their ride. Fetches the ride (which carries its bookings)
 * and lets the driver confirm or decline each pending request. Actions re-fetch in place so the
 * list stays live; a confirm fires a small celebration.
 */
export function RideBookingsModal({ open, ride, onClose, onChanged }) {
  const rideId = ride?.id;
  const detail = useApi(() => (rideId ? carpoolApi.getRide(rideId) : Promise.resolve(null)), [rideId, open]);
  const ripple = useRipple();

  const bookings = detail.data?.bookings || [];

  const act = async (fn, bookingId, celebrate) => {
    try {
      await fn(bookingId);
      if (celebrate) burstConfetti({ colors: ['#4ade80', '#3c79bc', '#ffffff'] });
      toast.success(celebrate ? 'Rider confirmed 🎉' : 'Request declined');
      detail.refetch();
      onChanged?.();
    } catch (err) {
      toast.error(normalizeError(err).message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Seat requests">
      {detail.loading && !detail.data ? (
        <Spinner label="Loading requests…" />
      ) : detail.error ? (
        <ErrorState error={detail.error} onRetry={detail.refetch} title="Could not load requests" />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No seat requests yet"
          description="When someone requests a seat on this ride, they'll show up here to confirm."
        />
      ) : (
        <ul className="stagger space-y-3">
          {bookings.map((b) => {
            const pending = b.status === BOOKING_STATUS.REQUESTED;
            return (
              <li key={b.id} className="card-solid rounded-2xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-content">{b.riderName || 'Rider'}</p>
                      <p className="text-xs text-muted">{b.seats} seat{b.seats > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[b.status] || 'muted'}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                </div>
                {b.pickup?.label && (
                  <p className="mt-2 flex items-start gap-2 text-sm text-muted">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    {b.pickup.label}
                  </p>
                )}
                {pending && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="press ripple flex-1" onPointerDown={ripple} onClick={() => act(carpoolApi.confirmBooking, b.id, true)}>
                      <Check className="h-4 w-4" /> Confirm
                    </Button>
                    <Button size="sm" variant="ghost" className="press ripple flex-1" onPointerDown={ripple} onClick={() => act(carpoolApi.declineBooking, b.id, false)}>
                      <X className="h-4 w-4" /> Decline
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
