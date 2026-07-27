import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, Plus, Search, CalendarClock, RefreshCw, Sprout, MapPin, Clock, X, Route, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { Tabs } from '@/components/common/Tabs.jsx';
import { Spinner, EmptyState, ErrorState } from '@/components/common/States.jsx';
import { useConfirm } from '@/components/common/ConfirmDialog.jsx';
import { RideCard } from '@/components/carpool/RideCard.jsx';
import { RideFormModal } from '@/components/carpool/RideFormModal.jsx';
import { RequestFormModal } from '@/components/carpool/RequestFormModal.jsx';
import { ScheduleFormModal } from '@/components/carpool/ScheduleFormModal.jsx';
import { BookRideModal } from '@/components/carpool/BookRideModal.jsx';
import { RideBookingsModal } from '@/components/carpool/RideBookingsModal.jsx';
import { GroupsPanel } from '@/components/carpool/GroupsPanel.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useRealtime } from '@/hooks/useRealtime.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { carpoolApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { useAuthStore } from '@/stores/authStore.js';
import { toast } from '@/stores/toastStore.js';
import { burstConfetti } from '@/utils/confetti.js';
import { DIRECTION_LABEL } from '@/utils/constants.js';
import { formatDateTime } from '@/utils/time.js';

const TABS = [
  { key: 'find', label: 'Find a ride', icon: Search },
  { key: 'mine', label: 'My rides', icon: Car },
  { key: 'requests', label: 'Requests', icon: Route },
  { key: 'groups', label: 'Groups', icon: Users },
];

export default function CarpoolPage() {
  const [tab, setTab] = useState('find');
  const [confirm, confirmDialog] = useConfirm();
  const ripple = useRipple();
  const userId = useAuthStore((s) => s.user?.id);

  // Data — one hook per tab's primary source.
  const rides = useApi(() => carpoolApi.listRides(), []);
  const mine = useApi(() => carpoolApi.myRides(), []);
  const requests = useApi(() => carpoolApi.listRequests(), []);
  const matches = useApi(() => carpoolApi.matches(), []);

  // Modals
  const [rideFormOpen, setRideFormOpen] = useState(false);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [bookFor, setBookFor] = useState(null);
  const [manageFor, setManageFor] = useState(null);

  // Full refresh — used after an action the user just took (post/cancel/book), where refetching
  // everything is worth it. NOT used for the background poll.
  const refreshAll = useCallback(() => {
    rides.refetch();
    mine.refetch();
    requests.refetch();
    matches.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background poll refetches ONLY the dataset for the tab the user is actually looking at — the
  // other three were being fetched every tick and thrown away. `matches()` (an expensive matching
  // computation) is deliberately NOT polled; it's fetched on mount and refreshed via refreshAll
  // after the user posts/cancels a request. Poll pauses when the tab is hidden (useRealtime).
  const refreshActiveTab = useCallback(() => {
    if (tab === 'find') rides.refetch();
    else if (tab === 'mine') mine.refetch();
    else if (tab === 'requests') requests.refetch();
    // 'groups' data lives in GroupsPanel and refreshes itself; nothing to poll here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useRealtime('carpool', ['carpool_rides', 'carpool_bookings', 'carpool_requests'], refreshActiveTab);

  const driving = mine.data?.driving || [];
  const riding = mine.data?.riding || [];
  const rideList = rides.data || [];
  const requestList = requests.data || [];

  const openCount = useMemo(() => rideList.length, [rideList]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const completeRide = async (ride) => {
    const ok = await confirm({
      title: 'Complete this ride?',
      message: 'Mark the ride as done. Confirmed riders will earn their credits and CO₂ impact is logged.',
      confirmLabel: 'Complete ride',
    });
    if (!ok) return;
    try {
      const res = await carpoolApi.completeRide(ride.id);
      if (res?.co2Grams > 0 || res?.riders > 0) {
        burstConfetti({ colors: ['#4ade80', '#3c79bc', '#5a96d6', '#ffffff'] });
      }
      toast.success('Ride completed 🌱');
      refreshAll();
    } catch (err) {
      toast.error(normalizeError(err).message);
    }
  };

  const cancelRide = async (ride) => {
    const ok = await confirm({
      title: 'Cancel this ride?',
      message: 'Riders who booked will be notified their seat is cancelled. This cannot be undone.',
      confirmLabel: 'Cancel ride',
      danger: true,
    });
    if (!ok) return;
    try {
      await carpoolApi.cancelRide(ride.id);
      toast.info('Ride cancelled');
      refreshAll();
    } catch (err) {
      toast.error(normalizeError(err).message);
    }
  };

  const cancelSeat = async (ride) => {
    const ok = await confirm({
      title: 'Cancel your seat?',
      message: `Give up your seat on ${ride.driverName || 'this'}'s ride?`,
      confirmLabel: 'Cancel seat',
      danger: true,
    });
    if (!ok) return;
    try {
      // The "riding" DTO doesn't carry the booking id, so resolve it from the ride detail —
      // my own still-active booking on this ride.
      const detail = await carpoolApi.getRide(ride.id);
      const mineBooking = (detail.bookings || []).find((b) => b.riderId === userId);
      if (!mineBooking) throw new Error('Could not find your booking on this ride.');
      await carpoolApi.cancelBooking(mineBooking.id);
      toast.info('Seat cancelled');
      refreshAll();
    } catch (err) {
      toast.error(normalizeError(err).message);
    }
  };

  const cancelRequest = async (req) => {
    const ok = await confirm({
      title: 'Cancel this request?',
      message: 'Stop looking for a ride in this time window.',
      confirmLabel: 'Cancel request',
      danger: true,
    });
    if (!ok) return;
    try {
      await carpoolApi.cancelRequest(req.id);
      toast.info('Request cancelled');
      refreshAll();
    } catch (err) {
      toast.error(normalizeError(err).message);
    }
  };

  // Header action changes per tab so the primary CTA is always relevant.
  const headerAction = (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={refreshAll} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
      <Link to="/carpool/impact" className="btn-secondary btn-sm flex items-center gap-1.5">
        <Sprout className="h-4 w-4" />
        <span className="hidden sm:inline">Impact</span>
      </Link>
      {tab === 'requests' ? (
        <Button size="sm" className="press ripple" onPointerDown={ripple} onClick={() => setRequestFormOpen(true)}>
          <Plus className="h-4 w-4" /><span className="hidden sm:inline">Request a ride</span>
        </Button>
      ) : tab === 'groups' ? null : (
        <Button size="sm" className="press ripple" onPointerDown={ripple} onClick={() => setRideFormOpen(true)}>
          <Plus className="h-4 w-4" /><span className="hidden sm:inline">Offer a ride</span>
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Carpool"
        description={tab === 'find' && openCount ? `${openCount} open ride${openCount === 1 ? '' : 's'} right now.` : 'Share the drive, split the carbon.'}
        icon={Car}
        action={headerAction}
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {/* ── Find a ride ─────────────────────────────────────────────────────── */}
      {tab === 'find' && (
        <section aria-label="Open rides">
          {rides.loading && !rideList.length ? (
            <RideGridSkeleton />
          ) : rides.error ? (
            <ErrorState error={rides.error} onRetry={rides.refetch} title="Could not load rides" />
          ) : rideList.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No open rides right now"
              description="Be the one to offer a ride — or post a request and we'll match you when a driver shows up."
              action={
                <div className="flex gap-2">
                  <Button size="sm" className="press ripple" onPointerDown={ripple} onClick={() => setRideFormOpen(true)}>
                    <Plus className="h-4 w-4" /> Offer a ride
                  </Button>
                  <Button size="sm" variant="secondary" className="press ripple" onPointerDown={ripple} onClick={() => setRequestFormOpen(true)}>
                    <Search className="h-4 w-4" /> Request one
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rideList.map((ride) => (
                <RideCard key={ride.id} ride={ride} variant="browse" onBook={setBookFor} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── My rides ────────────────────────────────────────────────────────── */}
      {tab === 'mine' && (
        <section aria-label="My rides" className="space-y-8">
          {mine.loading && !mine.data ? (
            <Spinner label="Loading your rides…" />
          ) : mine.error ? (
            <ErrorState error={mine.error} onRetry={mine.refetch} title="Could not load your rides" />
          ) : driving.length === 0 && riding.length === 0 ? (
            <EmptyState
              icon={Car}
              title="You're not carpooling yet"
              description="Offer a ride to share your commute, or set up a recurring commute that posts itself."
              action={
                <div className="flex gap-2">
                  <Button size="sm" className="press ripple" onPointerDown={ripple} onClick={() => setRideFormOpen(true)}>
                    <Plus className="h-4 w-4" /> Offer a ride
                  </Button>
                  <Button size="sm" variant="secondary" className="press ripple" onPointerDown={ripple} onClick={() => setScheduleFormOpen(true)}>
                    <CalendarClock className="h-4 w-4" /> Recurring commute
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-title-md text-content">
                    <Car className="h-5 w-5 text-brand-strong" /> Driving
                    {driving.length > 0 && <Badge tone="brand">{driving.length}</Badge>}
                  </h2>
                  <Button size="sm" variant="secondary" className="press ripple" onPointerDown={ripple} onClick={() => setScheduleFormOpen(true)}>
                    <CalendarClock className="h-4 w-4" /><span className="hidden sm:inline">Recurring</span>
                  </Button>
                </div>
                {driving.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">No rides in your name yet — offer one above and be someone's easy commute.</p>
                ) : (
                  <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {driving.map((ride) => (
                      <RideCard
                        key={ride.id}
                        ride={ride}
                        variant="driving"
                        onManage={setManageFor}
                        onComplete={completeRide}
                        onCancelRide={cancelRide}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h2 className="mb-3 flex items-center gap-2 text-title-md text-content">
                  <MapPin className="h-5 w-5 text-brand-strong" /> Riding
                  {riding.length > 0 && <Badge tone="brand">{riding.length}</Badge>}
                </h2>
                {riding.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">No seats booked yet — hop into the first tab and let someone else do the driving.</p>
                ) : (
                  <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {riding.map((ride) => (
                      <RideCard key={ride.id} ride={ride} variant="riding" onCancelSeat={cancelSeat} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Requests + matches ──────────────────────────────────────────────── */}
      {tab === 'requests' && (
        <section aria-label="My ride requests" className="space-y-8">
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-title-md text-content">
              <Route className="h-5 w-5 text-brand-strong" /> My requests
            </h2>
            {requests.loading && !requests.data ? (
              <Spinner label="Loading requests…" />
            ) : requests.error ? (
              <ErrorState error={requests.error} onRetry={requests.refetch} title="Could not load requests" />
            ) : requestList.length === 0 ? (
              <EmptyState
                icon={Route}
                title="No active requests"
                description="Post a request with your pickup point and time window — we'll suggest matching rides below."
                action={
                  <Button size="sm" className="press ripple" onPointerDown={ripple} onClick={() => setRequestFormOpen(true)}>
                    <Plus className="h-4 w-4" /> Request a ride
                  </Button>
                }
              />
            ) : (
              <ul className="stagger space-y-3">
                {requestList.map((req) => (
                  <li key={req.id} className="card group flex flex-wrap items-center justify-between gap-3 rounded-xl-increased p-4 transition-all duration-medium ease-emphasized">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-content">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong ring-1 ring-brand/15 transition-transform duration-medium ease-spring group-hover:scale-105">
                          <MapPin className="h-4 w-4" />
                        </span>
                        <span className="truncate font-medium">{req.origin?.label}</span>
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span>{DIRECTION_LABEL[req.direction]}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDateTime(req.windowStart)} – {formatDateTime(req.windowEnd)}</span>
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="press ripple" onPointerDown={ripple} onClick={() => cancelRequest(req)}>
                      <X className="h-4 w-4" /> Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Suggested matches */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-title-md text-content">
              <Search className="h-5 w-5 text-brand-strong" /> Suggested matches
            </h2>
            {matches.loading && !matches.data ? (
              <Spinner label="Finding matches…" />
            ) : matches.error ? (
              <ErrorState error={matches.error} onRetry={matches.refetch} title="Could not load matches" />
            ) : (matches.data || []).length === 0 || (matches.data || []).every((m) => m.matches.length === 0) ? (
              <EmptyState
                icon={Sprout}
                title="No matches yet"
                description="When a driver posts a ride that fits one of your requests, it'll appear here."
              />
            ) : (
              <div className="space-y-6">
                {(matches.data || []).filter((m) => m.matches.length > 0).map((m) => (
                  <div key={m.requestId}>
                    <p className="mb-2 text-sm text-muted">
                      For your <span className="font-medium text-content">{DIRECTION_LABEL[m.direction]}</span> request:
                    </p>
                    <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {m.matches.map((ride) => (
                        <RideCard key={ride.id} ride={ride} variant="browse" onBook={setBookFor} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Groups ──────────────────────────────────────────────────────────── */}
      {tab === 'groups' && <GroupsPanel />}

      {/* Modals */}
      <RideFormModal open={rideFormOpen} onClose={() => setRideFormOpen(false)} onSaved={refreshAll} />
      <RequestFormModal open={requestFormOpen} onClose={() => setRequestFormOpen(false)} onSaved={refreshAll} />
      <ScheduleFormModal open={scheduleFormOpen} onClose={() => setScheduleFormOpen(false)} onSaved={refreshAll} />
      <BookRideModal open={Boolean(bookFor)} ride={bookFor} onClose={() => setBookFor(null)} onBooked={refreshAll} />
      <RideBookingsModal open={Boolean(manageFor)} ride={manageFor} onClose={() => setManageFor(null)} onChanged={refreshAll} />
      {confirmDialog}
    </div>
  );
}

function RideGridSkeleton() {
  // Glass shells that fade in one after another, so the wait reads as "rides arriving"
  // rather than a wall of gray blocks.
  return (
    <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        // No animate-pop-in here: the .stagger container already supplies the staggered slide-up
        // entrance (its `.stagger > *` rule would override animate-pop-in anyway).
        <div key={i} className="card flex h-56 flex-col gap-3 rounded-xl-increased p-4">
          <div className="flex items-center gap-2.5">
            <div className="skeleton h-11 w-11 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-2/3 rounded-full" />
              <div className="skeleton h-3 w-1/3 rounded-full" />
            </div>
          </div>
          <div className="skeleton h-16 rounded-2xl" />
          <div className="mt-auto skeleton h-9 rounded-full" />
        </div>
      ))}
    </div>
  );
}
