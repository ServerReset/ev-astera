import { useState } from 'react';
import { createScheduleSchema } from '@shared/validation.js';
import { Modal } from '@/components/common/Modal.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input, Select } from '@/components/common/Input.jsx';
import { GeoPointField } from './GeoPointField.jsx';
import { carpoolApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { CARPOOL_DIRECTION, CARPOOL_ROLE, DIRECTION_LABEL, WEEKDAYS } from '@/utils/constants.js';
import { cn } from '@/utils/cn.js';

/**
 * Create a recurring commute schedule (Feature 2). The server materializes rides/requests
 * from active schedules a couple of days ahead. Body matches createScheduleSchema.
 */
export function ScheduleFormModal({ open, onClose, onCreated, groups = [] }) {
  const [role, setRole] = useState(CARPOOL_ROLE.DRIVER);
  const [direction, setDirection] = useState(CARPOOL_DIRECTION.TO_SITE);
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [departTime, setDepartTime] = useState('08:00');
  const [origin, setOrigin] = useState(null);
  const [seats, setSeats] = useState(3);
  const [groupId, setGroupId] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleDay = (d) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

  const submit = async () => {
    setErrors({});
    setFormError(null);
    const body = {
      role,
      direction,
      daysOfWeek: days,
      departTime,
      origin: origin || {},
      seats: Number(seats),
      groupId: groupId || undefined,
    };
    const parsed = createScheduleSchema.safeParse(body);
    if (!parsed.success) {
      const fe = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] === 'origin' ? 'origin' : issue.path[0] ?? '_form';
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setSubmitting(true);
    try {
      await carpoolApi.createSchedule(parsed.data);
      toast.success('Recurring commute saved.');
      setOrigin(null);
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
      title="Recurring commute"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting}>
            Save schedule
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="I'm a"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={[
              { value: CARPOOL_ROLE.DRIVER, label: 'Driver' },
              { value: CARPOOL_ROLE.RIDER, label: 'Rider' },
            ]}
          />
          <Select
            label="Direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            options={Object.values(CARPOOL_DIRECTION).map((d) => ({ value: d, label: DIRECTION_LABEL[d] }))}
          />
        </div>

        <div>
          <span className="label">Days</span>
          <div className="flex gap-1.5">
            {WEEKDAYS.map((w, i) => {
              const on = days.includes(i);
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    'h-9 flex-1 rounded-lg border text-xs font-medium transition-colors',
                    on ? 'border-brand bg-brand/15 text-brand-strong' : 'border-border bg-bg-elevated text-muted hover:text-content'
                  )}
                >
                  {w}
                </button>
              );
            })}
          </div>
          {errors.daysOfWeek && <p className="field-error">{errors.daysOfWeek}</p>}
        </div>

        <Input
          label="Departure time"
          type="time"
          value={departTime}
          onChange={(e) => setDepartTime(e.target.value)}
          error={errors.departTime}
        />
        <GeoPointField label="Starting from" value={origin} onChange={setOrigin} error={errors.origin} />
        {role === CARPOOL_ROLE.DRIVER && (
          <Input label="Seats" type="number" min={1} max={7} value={seats} onChange={(e) => setSeats(e.target.value)} error={errors.seats} />
        )}
        {groups.length > 0 && (
          <Select label="Group (optional)" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Anyone at the site</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        )}
        {formError && <p className="field-error">{formError}</p>}
      </div>
    </Modal>
  );
}
