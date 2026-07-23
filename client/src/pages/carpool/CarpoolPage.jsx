import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, Search, CalendarRange, Repeat, UsersRound, Plus, Leaf, MapPin, Clock, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Tabs } from '@/components/common/Tabs.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { Spinner, EmptyState, ErrorState } from '@/components/common/States.jsx';
import { useConfirm } from '@/components/common/ConfirmDialog.jsx';
import { RideCard } from '@/components/carpool/RideCard.jsx';
import { RideFormModal } from '@/components/carpool/RideFormModal.jsx';
import { BookRideModal } from '@/components/carpool/BookRideModal.jsx';
import { RideBookingsModal } from '@/components/carpool/RideBookingsModal.jsx';
import { RequestFormModal } from '@/components/carpool/RequestFormModal.jsx';
import { ScheduleFormModal } from '@/components/carpool/ScheduleFormModal.jsx';
import { GroupsPanel } from '@/components/carpool/GroupsPanel.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useRealtime } from '@/hooks/useRealtime.js';
import { useAuthStore } from '@/stores/authStore.js';
import { carpoolApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { formatDateTime } from '@/utils/time.js';
import { ENV, DIRECTION_LABEL, WEEKDAYS, CARPOOL_ROLE } from '@/utils/constants.js';

const TABS = [
  { key: 'find', label: 'Find a ride', icon: Search },
  { key: 'mine', label: 'My rides', icon: Car },
  { key: 'requests', label: 'Requests', icon: CalendarRange },
  { key: 'schedules', label: 'Recurring', icon: Repeat },
  { key: 'groups', label: 'Groups', icon: UsersRound },
];

export default function CarpoolPage() {
  const [tab, setTab] = useState('find');
  // Groups feed the "post to a group" dropdowns; load once and share.
  const groups = useApi(() => carpoolApi.listGroups(), []);
  const groupOptions = (groups.data || []).filter((g) => g.isMember);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Carpool"
        description="Share the drive — match up, commute together, cut emissions."
        icon={Car}
        action={
          <Link to="/carpool/impact" className="btn-secondary btn-sm">
            <Leaf className="h-4 w-4" />
            Impact
          </Link>
        }
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'find' && <FindTab groups={groupOptions} />}
      {tab === 'mine' && <MyRidesTab groups={groupOptions} />}
      {tab === 'requests' && <RequestsTab groups={groupOptions} />}
      {tab === 'schedules' && <SchedulesTab groups={groupOptions} />}
      {tab === 'groups' && <GroupsPanel onGroupsChanged={groups.refetch} />}
    </div>
  );
}

// ── Find a ride (Feature 1) ─────────────────────────────────────────────────────
function FindTab({ groups }) {
  const rides = useApi(() => carpoolApi.listRides(), []);
  const [offerOpen, setOfferOpen] = useState(false);
  const [bookRide, setBookRide] = useState(null);

  useRealtime('carpool-rides', ['carpool_rides', 'carpool_bookings'], rides.refetch, {
    filter: ENV.locationId ? `location_id=eq.${ENV.locationId}` : undefined,
  });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setOfferOpen(true)}>
          <Plus className="h-4 w-4" />
          Offer a ride
        </Button>
      </div>

      {rides.loading && !rides.data ? (
        <Spinner label="Finding rides…" />
      ) : rides.error ? (
        <ErrorState error={rides.error} onRetry={rides.refetch} />
      ) : (rides.data || []).length === 0 ? (
        <EmptyState
          icon={Search}
          title="No open rides right now"
          description="Offer one yourself, or post a request and we'll match you with a driver."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rides.data.map((ride) => (
            <RideCard key={ride.id} ride={ride} variant="browse" onBook={setBookRide} />
          ))}
        </div>
      )}

      <RideFormModal open={offerOpen} onClose={() => setOfferOpen(false)} groups={groups} onCreated={() => { setOfferOpen(false); rides.refetch(); }} />
      <BookRideModal open={Boolean(bookRide)} ride={bookRide} onClose={() => setBookRide(null)} onBooked={() => { setBookRide(null); rides.refetch(); }} />
    </>
  );
}

// ── My rides ─────────────────────────────────────────────────────────────────────
function MyRidesTab({ groups }) {
  const userId = useAuthStore((s) => s.user?.id);
  const mine = useApi(() => carpoolApi.myRides(), []);
  const [offerOpen, setOfferOpen] = useState(false);
  const [manageRideId, setManageRideId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirm, confirmDialog] = useConfirm();

  useRealtime('carpool-myrides', ['carpool_rides', 'carpool_bookings'], mine.refetch, {
    filter: ENV.locationId ? `location_id=eq.${ENV.locationId}` : undefined,
  });

  const driving = mine.data?.driving || [];
  const riding = mine.data?.riding || [];

  const complete = async (ride) => {
    if (!(await confirm({ title: 'Complete ride?', message: 'Mark this ride as done and log the CO₂ savings for everyone aboard?', confirmLabel: 'Complete' }))) return;
    setBusyId(ride.id);
    try {
      await carpoolApi.completeRide(ride.id);
      toast.success('Ride completed — impact logged.');
      mine.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (ride) => {
    if (!(await confirm({ title: 'Cancel ride?', message: 'Riders who booked will be notified.', danger: true, confirmLabel: 'Cancel ride' }))) return;
    setBusyId(ride.id);
    try {
      await carpoolApi.cancelRide(ride.id);
      toast.success('Ride cancelled.');
      mine.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const cancelSeat = async (ride) => {
    if (!(await confirm({ title: 'Cancel your seat?', message: 'Give up your seat on this ride?', danger: true, confirmLabel: 'Cancel seat' }))) return;
    setBusyId(ride.id);
    try {
      const full = await carpoolApi.getRide(ride.id);
      const myBooking = (full.bookings || []).find((b) => b.riderId === userId);
      if (!myBooking) throw new Error('Your booking could not be found.');
      await carpoolApi.cancelBooking(myBooking.id);
      toast.success('Seat cancelled.');
      mine.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  if (mine.loading && !mine.data) return <Spinner />;
  if (mine.error) return <ErrorState error={mine.error} onRetry={mine.refetch} />;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setOfferOpen(true)}>
          <Plus className="h-4 w-4" />
          Offer a ride
        </Button>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">You're driving</h2>
        {driving.length === 0 ? (
          <EmptyState icon={Car} title="No rides offered" description="Offer a ride to start sharing your commute." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {driving.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                variant="driving"
                busy={busyId === ride.id}
                onManageBookings={(r) => setManageRideId(r.id)}
                onComplete={complete}
                onCancel={cancel}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">You're riding</h2>
        {riding.length === 0 ? (
          <EmptyState icon={UsersRound} title="No booked rides" description="Request a seat from the Find a ride tab." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {riding.map((ride) => (
              <RideCard key={ride.id} ride={ride} variant="riding" busy={busyId === ride.id} onCancelSeat={cancelSeat} />
            ))}
          </div>
        )}
      </section>

      <RideFormModal open={offerOpen} onClose={() => setOfferOpen(false)} groups={groups} onCreated={() => { setOfferOpen(false); mine.refetch(); }} />
      <RideBookingsModal
        open={Boolean(manageRideId)}
        rideId={manageRideId}
        onClose={() => setManageRideId(null)}
        onChanged={mine.refetch}
      />
      {confirmDialog}
    </>
  );
}

// ── Requests (Feature 1b) ─────────────────────────────────────────────────────────
function RequestsTab({ groups }) {
  const requests = useApi(() => carpoolApi.listRequests(), []);
  const matches = useApi(() => carpoolApi.matches(), []);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const cancel = async (req) => {
    if (!(await confirm({ title: 'Cancel request?', message: 'Remove your ride request?', danger: true, confirmLabel: 'Cancel it' }))) return;
    try {
      await carpoolApi.cancelRequest(req.id);
      toast.success('Request cancelled.');
      requests.refetch();
      matches.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    }
  };

  const refresh = () => {
    requests.refetch();
    matches.refetch();
  };

  const matchesByReq = new Map((matches.data || []).map((m) => [m.requestId, m.matches]));

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Request a ride
        </Button>
      </div>

      {requests.loading && !requests.data ? (
        <Spinner />
      ) : requests.error ? (
        <ErrorState error={requests.error} onRetry={requests.refetch} />
      ) : (requests.data || []).length === 0 ? (
        <EmptyState icon={CalendarRange} title="No open requests" description="Post a request with your time window and we'll surface matching drivers." />
      ) : (
        <ul className="space-y-3">
          {requests.data.map((req) => {
            const m = matchesByReq.get(req.id) || [];
            return (
              <Card key={req.id} as="li">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-content">
                      {DIRECTION_LABEL[req.direction]}
                      <Badge tone="info">{m.length} match{m.length === 1 ? '' : 'es'}</Badge>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <MapPin className="h-4 w-4" /> {req.origin?.label}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                      <Clock className="h-4 w-4" /> {formatDateTime(req.windowStart)} – {formatDateTime(req.windowEnd).split('· ')[1] || ''}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => cancel(req)} aria-label="Cancel request">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {m.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">Suggested drivers</p>
                    <ul className="space-y-1.5">
                      {m.map((ride) => (
                        <li key={ride.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate text-content">{ride.driverName} · {formatDateTime(ride.departAt)}</span>
                          <span className="shrink-0 text-xs font-medium text-success">{Math.round(ride.matchScore)}% match</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            );
          })}
        </ul>
      )}

      <RequestFormModal open={formOpen} onClose={() => setFormOpen(false)} groups={groups} onCreated={() => { setFormOpen(false); refresh(); }} />
      {confirmDialog}
    </>
  );
}

// ── Recurring schedules (Feature 2) ───────────────────────────────────────────────
function SchedulesTab({ groups }) {
  const schedules = useApi(() => carpoolApi.listSchedules(), []);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirm, confirmDialog] = useConfirm();

  const toggleActive = async (s) => {
    setBusyId(s.id);
    try {
      await carpoolApi.updateSchedule(s.id, { active: !s.active });
      schedules.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (s) => {
    if (!(await confirm({ title: 'Delete schedule?', message: 'Stop generating rides/requests from this recurring commute?', danger: true, confirmLabel: 'Delete' }))) return;
    setBusyId(s.id);
    try {
      await carpoolApi.deleteSchedule(s.id);
      toast.success('Schedule deleted.');
      schedules.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          New schedule
        </Button>
      </div>

      {schedules.loading && !schedules.data ? (
        <Spinner />
      ) : schedules.error ? (
        <ErrorState error={schedules.error} onRetry={schedules.refetch} />
      ) : (schedules.data || []).length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring commutes"
          description="Set up a repeating schedule and we'll auto-post your rides or requests a couple of days ahead."
        />
      ) : (
        <ul className="space-y-2">
          {schedules.data.map((s) => (
            <Card key={s.id} as="li" className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-content">
                  {s.role === CARPOOL_ROLE.DRIVER ? 'Driving' : 'Riding'} · {DIRECTION_LABEL[s.direction]}
                  {!s.active && <Badge tone="faint">Paused</Badge>}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {s.daysOfWeek.map((d) => WEEKDAYS[d]).join(', ')} at {s.departTime}
                </p>
                <p className="text-xs text-faint">{s.origin?.label}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => toggleActive(s)} loading={busyId === s.id}>
                  {s.active ? 'Pause' : 'Resume'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(s)} aria-label="Delete schedule">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </ul>
      )}

      <ScheduleFormModal open={formOpen} onClose={() => setFormOpen(false)} groups={groups} onCreated={() => { setFormOpen(false); schedules.refetch(); }} />
      {confirmDialog}
    </>
  );
}
