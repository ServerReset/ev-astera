import { useState } from 'react';
import { CalendarClock, Plus, Trash2, CalendarDays } from 'lucide-react';
import { createReservationSchema } from '@shared/validation.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { Input, Select } from '@/components/common/Input.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { Spinner, EmptyState, ErrorState } from '@/components/common/States.jsx';
import { useConfirm } from '@/components/common/ConfirmDialog.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useRealtime } from '@/hooks/useRealtime.js';
import { reservationApi, chargerApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { formatDateTime, toLocalInputValue, localInputToISO } from '@/utils/time.js';
import { ENV, RESERVATION_STATUS } from '@/utils/constants.js';

export default function ReservationsPage() {
  const mine = useApi(() => reservationApi.mine(), []);
  const upcoming = useApi(() => reservationApi.upcoming(), []);
  const chargers = useApi(() => chargerApi.list(), []);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const refresh = () => {
    mine.refetch();
    upcoming.refetch();
  };

  useRealtime('reservations', ['reservations'], refresh, {
    filter: ENV.locationId ? `location_id=eq.${ENV.locationId}` : undefined,
  });

  const cancel = async (r) => {
    if (!(await confirm({ title: 'Cancel reservation?', message: `Release your ${formatDateTime(r.startAt)} slot on ${r.chargerName}?`, danger: true, confirmLabel: 'Cancel it' }))) return;
    try {
      await reservationApi.cancel(r.id);
      toast.success('Reservation cancelled.');
      refresh();
    } catch (err) {
      toast.error(normalizeError(err).message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Reservations"
        description="Book a charger for a future window during work hours."
        icon={CalendarClock}
        action={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Reserve
          </Button>
        }
      />

      <Card className="mb-5">
        <CardHeader title="Your reservations" icon={CalendarDays} />
        {mine.loading ? (
          <Spinner />
        ) : mine.error ? (
          <ErrorState error={mine.error} onRetry={mine.refetch} />
        ) : (mine.data || []).length === 0 ? (
          <EmptyState icon={CalendarClock} title="No reservations yet" description="Reserve a charger so it's ready when you arrive." />
        ) : (
          <ul className="space-y-2">
            {mine.data.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-bg-elevated p-3">
                <div className="min-w-0">
                  <p className="font-medium text-content">{r.chargerName}</p>
                  <p className="text-sm text-muted">
                    {formatDateTime(r.startAt)} – {formatDateTime(r.endAt).split('· ')[1] || ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={r.status === RESERVATION_STATUS.ACTIVE ? 'success' : 'info'}>
                    {r.status === RESERVATION_STATUS.ACTIVE ? 'Active' : 'Upcoming'}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => cancel(r)} aria-label="Cancel">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Everyone's upcoming slots" subtitle="So you can plan around busy times" />
        {upcoming.loading ? (
          <Spinner />
        ) : (upcoming.data || []).length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nothing booked" description="No upcoming reservations at your site." />
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.data.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-content">{r.chargerName}</span>
                <span className="text-muted">{formatDateTime(r.startAt)}</span>
                <span className="text-faint">{r.userDisplayName}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ReservationFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        chargers={chargers.data || []}
        onCreated={() => {
          setFormOpen(false);
          refresh();
        }}
      />
      {confirmDialog}
    </div>
  );
}

function ReservationFormModal({ open, onClose, chargers, onCreated }) {
  const [chargerId, setChargerId] = useState('');
  const [startLocal, setStartLocal] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [endLocal, setEndLocal] = useState(() => toLocalInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const chargerOptions = chargers.map((c) => ({ value: c.id, label: c.name }));

  const submit = async () => {
    setErrors({});
    setFormError(null);
    const body = {
      chargerId: chargerId || chargers[0]?.id,
      startAt: localInputToISO(startLocal),
      endAt: localInputToISO(endLocal),
    };
    const parsed = createReservationSchema.safeParse(body);
    if (!parsed.success) {
      const fe = {};
      for (const issue of parsed.error.issues) fe[issue.path[0] ?? '_form'] = issue.message;
      setErrors(fe);
      return;
    }
    setSubmitting(true);
    try {
      await reservationApi.create(parsed.data);
      toast.success('Reservation booked.');
      onCreated?.();
    } catch (err) {
      setFormError(normalizeError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reserve a charger"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting}>
            Book
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Select
          label="Charger"
          value={chargerId || chargerOptions[0]?.value || ''}
          onChange={(e) => setChargerId(e.target.value)}
          options={chargerOptions}
          error={errors.chargerId}
        />
        <Input
          label="Start"
          type="datetime-local"
          value={startLocal}
          onChange={(e) => setStartLocal(e.target.value)}
          error={errors.startAt}
        />
        <Input
          label="End"
          type="datetime-local"
          value={endLocal}
          onChange={(e) => setEndLocal(e.target.value)}
          error={errors.endAt}
          hint="Site hours are 8:00 AM – 6:00 PM"
        />
        {formError && <p className="field-error">{formError}</p>}
      </div>
    </Modal>
  );
}
