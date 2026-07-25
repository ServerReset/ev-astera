import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input, Select } from '@/components/common/Input.jsx';
import { GeoPointField } from './GeoPointField.jsx';
import { carpoolApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { useHqAddress } from '@/hooks/useHqAddress.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { CARPOOL_DIRECTION, CARPOOL_ROLE, DIRECTION_LABEL, WEEKDAYS } from '@/utils/constants.js';
import { createScheduleSchema } from '@shared/validation.js';
import { cn } from '@/utils/cn.js';

const DIRECTION_OPTIONS = [
  { value: CARPOOL_DIRECTION.TO_SITE, label: DIRECTION_LABEL[CARPOOL_DIRECTION.TO_SITE] },
  { value: CARPOOL_DIRECTION.FROM_SITE, label: DIRECTION_LABEL[CARPOOL_DIRECTION.FROM_SITE] },
];
const ROLE_OPTIONS = [
  { value: CARPOOL_ROLE.DRIVER, label: 'I can drive' },
  { value: CARPOOL_ROLE.RIDER, label: 'I need a ride' },
];

/**
 * A recurring commute: role (drive/ride), direction, the weekdays it repeats on, a departure
 * clock time, origin, and (for drivers) seats. Materialized into real rides/requests daily by
 * the carpool cron. Validated against createScheduleSchema.
 */
export function ScheduleFormModal({ open, onClose, onSaved }) {
  const hqAddress = useHqAddress();
  const ripple = useRipple();
  const [role, setRole] = useState(CARPOOL_ROLE.DRIVER);
  const [direction, setDirection] = useState(CARPOOL_DIRECTION.TO_SITE);
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [departTime, setDepartTime] = useState('08:30');
  const [origin, setOrigin] = useState({ label: '' });
  const [seats, setSeats] = useState(3);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRole(CARPOOL_ROLE.DRIVER);
    setDirection(CARPOOL_DIRECTION.TO_SITE);
    setDays([1, 2, 3, 4, 5]);
    setDepartTime('08:30');
    setOrigin({ label: '' });
    setSeats(3);
    setErrors({});
  }, [open]);

  useEffect(() => {
    if (direction === CARPOOL_DIRECTION.FROM_SITE && hqAddress && !origin.label) {
      setOrigin({ label: hqAddress });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, hqAddress]);

  const toggleDay = (i) =>
    setDays((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort((a, b) => a - b)));

  const isDriver = role === CARPOOL_ROLE.DRIVER;

  const submit = async () => {
    const payload = {
      role,
      direction,
      daysOfWeek: days,
      departTime,
      origin: { label: origin.label?.trim() || '' },
      seats: isDriver ? Number(seats) : 1,
    };
    const parsed = createScheduleSchema.safeParse(payload);
    if (!parsed.success) {
      const fe = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'origin' ? 'origin' : issue.path[0] ?? '_form';
        if (!fe[key]) fe[key] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setSubmitting(true);
    try {
      await carpoolApi.createSchedule(parsed.data);
      toast.success('Recurring commute saved 📅');
      onSaved?.();
      onClose?.();
    } catch (err) {
      const e = normalizeError(err);
      setErrors((prev) => ({ ...prev, _form: e.message }));
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Recurring commute"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="press ripple" onPointerDown={ripple} onClick={submit} loading={submitting}>
            <CalendarClock className="h-4 w-4" /> Save commute
          </Button>
        </div>
      }
    >
      <div className="stagger space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Your role" options={ROLE_OPTIONS} value={role} onChange={(e) => setRole(e.target.value)} />
          <Select label="Direction" options={DIRECTION_OPTIONS} value={direction} onChange={(e) => setDirection(e.target.value)} />
        </div>

        <div>
          <span className="label">Repeats on</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => {
              const active = days.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleDay(i)}
                  className={cn(
                    'press h-10 w-10 rounded-full border text-sm font-medium transition-colors duration-medium ease-emphasized',
                    active
                      ? 'border-brand bg-brand text-brand-content shadow-elevation-1'
                      : 'border-border bg-bg-elevated text-muted hover:border-brand/40'
                  )}
                >
                  {d[0]}
                </button>
              );
            })}
          </div>
          {errors.daysOfWeek && <p className="field-error">{errors.daysOfWeek}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            type="time"
            label="Departure time"
            value={departTime}
            onChange={(e) => setDepartTime(e.target.value)}
            error={errors.departTime}
          />
          {isDriver && (
            <Input
              type="number"
              label="Seats offered"
              min={1}
              max={7}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              error={errors.seats}
            />
          )}
        </div>

        <GeoPointField
          label={isDriver ? 'Where you leave from' : 'Pickup point'}
          value={origin}
          onChange={setOrigin}
          error={errors.origin}
          placeholder="Address"
        />
        {errors._form && <p className="field-error">{errors._form}</p>}
      </div>
    </Modal>
  );
}
