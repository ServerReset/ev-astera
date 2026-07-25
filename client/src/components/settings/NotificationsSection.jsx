import { useState } from 'react';
import { BellRing, Clock, Car, Search, Megaphone } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Switch } from '@/components/common/Switch.jsx';
import { useRipple } from '@/hooks/useInteractions.js';
import { useAuthStore } from '@/stores/authStore.js';
import { userApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { usePushNotifications } from '@/hooks/usePushNotifications.js';
import { NOTIFICATION_TYPES } from '@/utils/constants.js';
import { Button } from '@/components/common/Button.jsx';

// Static list (no dynamic class interpolation) of the user-facing preference toggles.
const PREF_ROWS = [
  { key: NOTIFICATION_TYPES.QUEUE_TURN, icon: BellRing, label: "It's your turn", desc: 'When a charger frees up and the queue reaches you.' },
  { key: NOTIFICATION_TYPES.SESSION_OVERTIME, icon: Clock, label: 'Session overtime', desc: 'When your charging session runs past its ETA.' },
  { key: NOTIFICATION_TYPES.CARPOOL_BOOKING, icon: Car, label: 'Carpool bookings', desc: 'Seat requests, confirmations and cancellations.' },
  { key: NOTIFICATION_TYPES.CARPOOL_MATCH, icon: Search, label: 'Carpool matches', desc: 'When a ride matches one of your requests.' },
  { key: NOTIFICATION_TYPES.ANNOUNCEMENT, icon: Megaphone, label: 'Announcements', desc: 'Site-wide notices from your admins.' },
];

export function NotificationsSection() {
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);
  const ripple = useRipple();
  const push = usePushNotifications();
  const [prefs, setPrefs] = useState(() => user?.notificationPrefs || {});
  const [saving, setSaving] = useState(null);

  // Default opted-in: a key is ON unless explicitly stored as false.
  const isOn = (key) => prefs[key] !== false;

  const toggle = async (key) => {
    const next = { ...prefs, [key]: !isOn(key) };
    const prev = prefs;
    setPrefs(next); // optimistic
    setSaving(key);
    try {
      const updated = await userApi.updateMe({ notificationPrefs: next });
      patchUser(updated);
    } catch (err) {
      setPrefs(prev); // revert
      toast.error(normalizeError(err).message || 'Could not update preferences');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="What you hear about" subtitle="Choose which alerts reach you. On by default." icon={BellRing} />
        <ul className="stagger flex flex-col divide-y divide-border/60">
          {PREF_ROWS.map(({ key, icon: Icon, label, desc }) => (
            <li key={key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-content">{label}</p>
                <p className="text-sm text-muted">{desc}</p>
              </div>
              <Switch checked={isOn(key)} onChange={() => toggle(key)} disabled={saving === key} label={label} />
            </li>
          ))}
        </ul>
      </Card>

      {/* Push delivery — optional device-level opt-in on top of the per-type prefs above. */}
      {push?.supported && (
        <Card>
          <CardHeader title="Push to this device" subtitle="Get alerts even when the tab is closed." icon={BellRing} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {push.subscribed ? 'Push notifications are on for this device.' : 'Push notifications are off for this device.'}
            </p>
            <Button
              size="sm"
              variant={push.subscribed ? 'secondary' : 'primary'}
              className="press ripple shrink-0"
              onPointerDown={ripple}
              loading={push.busy}
              onClick={() => (push.subscribed ? push.disable?.() : push.enable?.())}
            >
              {push.subscribed ? 'Turn off' : 'Enable'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
