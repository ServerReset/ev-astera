import { Car, Search, CalendarClock, Users2, Trash2, MapPin } from 'lucide-react';
import { Badge } from '@/components/common/Badge.jsx';
import { Tabs } from '@/components/common/Tabs.jsx';
import { Spinner, ErrorState, EmptyState } from '@/components/common/States.jsx';
import { AdminTable, AdminRow, Td } from './adminShared.jsx';
import { useConfirm } from '@/components/common/ConfirmDialog.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useState } from 'react';
import { adminApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { RIDE_STATUS_META, DIRECTION_LABEL, WEEKDAYS } from '@/utils/constants.js';
import { formatDateTime } from '@/utils/time.js';

/** Carpool admin: rides / requests / schedules / groups, each with a force-cancel or delete.
 *  `refreshSignal` (header Refresh) re-runs the active sub-list's fetch without remounting the tab,
 *  so the chosen sub-tab (Rides/Requests/Schedules/Groups) survives a refresh. */
export function CarpoolTab({ refreshSignal = 0 }) {
  const [sub, setSub] = useState('rides');
  const [confirm, dialog] = useConfirm();

  const tabs = [
    { key: 'rides', label: 'Rides', icon: Car },
    { key: 'requests', label: 'Requests', icon: Search },
    { key: 'schedules', label: 'Schedules', icon: CalendarClock },
    { key: 'groups', label: 'Groups', icon: Users2 },
  ];

  return (
    <div>
      <Tabs tabs={tabs} value={sub} onChange={setSub} />
      <div className="animate-fade-in">
        {sub === 'rides' && <RidesList confirm={confirm} refreshSignal={refreshSignal} />}
        {sub === 'requests' && <RequestsList confirm={confirm} refreshSignal={refreshSignal} />}
        {sub === 'schedules' && <SchedulesList confirm={confirm} refreshSignal={refreshSignal} />}
        {sub === 'groups' && <GroupsList confirm={confirm} refreshSignal={refreshSignal} />}
      </div>
      {dialog}
    </div>
  );
}

function useList(fn, deps = []) {
  return useApi(fn, deps);
}

function ListShell({ query, empty, children }) {
  if (query.loading && !query.data) return <Spinner label="Loading…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} title="Could not load" />;
  const items = query.data || [];
  if (!items.length) return <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />;
  return <div className="card-solid rounded-xl-increased p-2">{children(items)}</div>;
}

function DeleteBtn({ onClick, label = 'Cancel' }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-danger/10 hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-danger/70 active:scale-90"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function RidesList({ confirm, refreshSignal = 0 }) {
  const q = useList(() => adminApi.listCarpoolRides(), [refreshSignal]);
  const cancel = async (r) => {
    if (await confirm({ title: 'Cancel ride?', message: `Cancel ${r.driverName ? `${r.driverName}'s` : 'this'} ride departing ${formatDateTime(r.departAt)}? Riders will be notified.`, danger: true, confirmLabel: 'Cancel ride' })) {
      try { await adminApi.cancelCarpoolRide(r.id); toast.success('Ride cancelled'); q.refetch(); }
      catch (err) { toast.error(normalizeError(err).message); }
    }
  };
  return (
    <ListShell query={q} empty={{ icon: Car, title: 'No open rides', description: 'Active carpool rides show up here.' }}>
      {(items) => (
        <AdminTable head={['Driver', 'Direction', 'Departs', 'Seats', 'Status', { label: '', right: true }]}>
          {items.map((r) => (
            <AdminRow key={r.id}>
              <Td><span className="font-medium text-content">{r.driverName || '—'}</span></Td>
              <Td><span className="text-muted">{DIRECTION_LABEL[r.direction]}</span></Td>
              <Td><span className="text-content">{formatDateTime(r.departAt)}</span></Td>
              <Td><span className="tabular-nums text-content">{r.seatsAvailable}/{r.seatsTotal}</span></Td>
              <Td><Badge tone={RIDE_STATUS_META[r.status]?.tone}>{RIDE_STATUS_META[r.status]?.label || r.status}</Badge></Td>
              <Td right><DeleteBtn label="Cancel ride" onClick={() => cancel(r)} /></Td>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </ListShell>
  );
}

function RequestsList({ confirm, refreshSignal = 0 }) {
  const q = useList(() => adminApi.listCarpoolRequests(), [refreshSignal]);
  const cancel = async (r) => {
    if (await confirm({ title: 'Cancel request?', message: `Cancel ${r.riderName ? `${r.riderName}'s` : 'this'} ride request?`, danger: true, confirmLabel: 'Cancel request' })) {
      try { await adminApi.cancelCarpoolRequest(r.id); toast.success('Request cancelled'); q.refetch(); }
      catch (err) { toast.error(normalizeError(err).message); }
    }
  };
  return (
    <ListShell query={q} empty={{ icon: Search, title: 'No open requests', description: 'Riders looking for a match appear here.' }}>
      {(items) => (
        <AdminTable head={['Rider', 'Direction', 'From', 'Window', { label: '', right: true }]}>
          {items.map((r) => (
            <AdminRow key={r.id}>
              <Td><span className="font-medium text-content">{r.riderName || '—'}</span></Td>
              <Td><span className="text-muted">{DIRECTION_LABEL[r.direction]}</span></Td>
              <Td><span className="inline-flex items-center gap-1 text-muted"><MapPin className="h-3.5 w-3.5" />{r.origin?.label}</span></Td>
              <Td><span className="text-content">{formatDateTime(r.windowStart)} – {formatDateTime(r.windowEnd)}</span></Td>
              <Td right><DeleteBtn label="Cancel request" onClick={() => cancel(r)} /></Td>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </ListShell>
  );
}

function SchedulesList({ confirm, refreshSignal = 0 }) {
  const q = useList(() => adminApi.listCarpoolSchedules(), [refreshSignal]);
  const del = async (s) => {
    if (await confirm({ title: 'Delete schedule?', message: `Delete ${s.userName ? `${s.userName}'s` : 'this'} recurring ${s.role} schedule?`, danger: true, confirmLabel: 'Delete' })) {
      try { await adminApi.deleteCarpoolSchedule(s.id); toast.success('Schedule deleted'); q.refetch(); }
      catch (err) { toast.error(normalizeError(err).message); }
    }
  };
  return (
    <ListShell query={q} empty={{ icon: CalendarClock, title: 'No schedules', description: 'Recurring carpool schedules appear here.' }}>
      {(items) => (
        <AdminTable head={['Member', 'Role', 'Days', 'Departs', 'Active', { label: '', right: true }]}>
          {items.map((s) => (
            <AdminRow key={s.id}>
              <Td><span className="font-medium text-content">{s.userName || '—'}</span></Td>
              <Td><span className="capitalize text-muted">{s.role}</span></Td>
              <Td><span className="text-content">{(s.daysOfWeek || []).map((d) => WEEKDAYS[d]).join(', ')}</span></Td>
              <Td><span className="tabular-nums text-content">{s.departTime}</span></Td>
              <Td>{s.active ? <Badge tone="success" dot>Active</Badge> : <Badge tone="muted">Paused</Badge>}</Td>
              <Td right><DeleteBtn label="Delete schedule" onClick={() => del(s)} /></Td>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </ListShell>
  );
}

function GroupsList({ confirm, refreshSignal = 0 }) {
  const q = useList(() => adminApi.listCarpoolGroups(), [refreshSignal]);
  const del = async (g) => {
    if (await confirm({ title: 'Delete group?', message: `Delete "${g.name}" and remove all ${g.memberCount} member(s)?`, danger: true, confirmLabel: 'Delete' })) {
      try { await adminApi.deleteCarpoolGroup(g.id); toast.success('Group deleted'); q.refetch(); }
      catch (err) { toast.error(normalizeError(err).message); }
    }
  };
  return (
    <ListShell query={q} empty={{ icon: Users2, title: 'No groups', description: 'Carpool groups appear here.' }}>
      {(items) => (
        <AdminTable head={['Group', 'Members', { label: '', right: true }]}>
          {items.map((g) => (
            <AdminRow key={g.id}>
              <Td>
                <p className="font-medium text-content">{g.name}</p>
                {g.description && <p className="text-xs text-faint">{g.description}</p>}
              </Td>
              <Td><span className="tabular-nums text-content">{g.memberCount}</span></Td>
              <Td right><DeleteBtn label="Delete group" onClick={() => del(g)} /></Td>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </ListShell>
  );
}
