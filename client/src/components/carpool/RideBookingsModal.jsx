import { useState } from 'react';
import { UserCheck, MapPin } from 'lucide-react';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { Spinner, EmptyState, ErrorState } from '@/components/common/States.jsx';
import { useApi } from '@/hooks/useApi.js';
import { carpoolApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { BOOKING_STATUS, BOOKING_STATUS_LABEL } from '@/utils/constants.js';

/**
 * Driver's view of the seat requests on one of their rides. Loads the full ride (which
 * includes requested/confirmed bookings) and lets the driver confirm or decline each.
 */
export function RideBookingsModal({ open, onClose, rideId, onChanged }) {
  const ride = useApi(() => carpoolApi.getRide(rideId), [rideId], { immediate: Boolean(rideId) });
  const [busyId, setBusyId] = useState(null);

  const act = async (fn, booking) => {
    setBusyId(booking.id);
    try {
      await fn();
      await ride.refetch();
      onChanged?.();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const bookings = ride.data?.bookings || [];

  return (
    <Modal open={open} onClose={onClose} title="Seat requests">
      {ride.loading ? (
        <Spinner />
      ) : ride.error ? (
        <ErrorState error={ride.error} onRetry={ride.refetch} />
      ) : bookings.length === 0 ? (
        <EmptyState icon={UserCheck} title="No requests yet" description="Riders who request a seat will show up here for you to confirm." />
      ) : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li key={b.id} className="rounded-xl bg-bg-elevated p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-content">{b.riderName}</p>
                  <p className="flex items-center gap-1 text-xs text-muted">
                    <MapPin className="h-3.5 w-3.5" />
                    {b.pickup?.label} · {b.seats} seat{b.seats > 1 ? 's' : ''}
                  </p>
                </div>
                <Badge tone={b.status === BOOKING_STATUS.CONFIRMED ? 'success' : 'info'}>
                  {BOOKING_STATUS_LABEL[b.status]}
                </Badge>
              </div>
              {b.status === BOOKING_STATUS.REQUESTED && (
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => act(() => carpoolApi.declineBooking(b.id), b)}
                    loading={busyId === b.id}
                  >
                    Decline
                  </Button>
                  <Button size="sm" onClick={() => act(() => carpoolApi.confirmBooking(b.id), b)} loading={busyId === b.id}>
                    Confirm
                  </Button>
                </div>
              )}
              {b.status === BOOKING_STATUS.CONFIRMED && (
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => act(() => carpoolApi.cancelBooking(b.id), b)}
                    loading={busyId === b.id}
                  >
                    Remove rider
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
