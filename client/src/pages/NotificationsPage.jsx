import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, BellOff, CheckCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Icon } from '@/components/common/Icon.jsx';
import { Spinner, EmptyState } from '@/components/common/States.jsx';
import { useNotificationStore } from '@/stores/notificationStore.js';
import { usePushNotifications } from '@/hooks/usePushNotifications.js';
import { useRealtime } from '@/hooks/useRealtime.js';
import { NOTIFICATION_META } from '@/utils/constants.js';
import { relativeTime } from '@/utils/time.js';
import { cn } from '@/utils/cn.js';

// Static tone → class map (Tailwind's JIT only sees literal class strings, so these can't
// be built by interpolation).
const TONE_CLASS = {
  brand: 'bg-brand/15 text-brand',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  muted: 'bg-surface-2 text-muted',
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { items, unread, loading, refresh, markRead, markAllRead } = useNotificationStore();
  const push = usePushNotifications();

  useEffect(() => {
    refresh();
  }, [refresh]);

  useRealtime('notifications', ['notifications'], refresh);

  const open = (n) => {
    if (!n.readAt) markRead(n.id);
    if (n.actionUrl) navigate(n.actionUrl);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Alerts"
        description="Your queue turns, session reminders, carpool updates, and announcements."
        icon={Bell}
        action={
          unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : null
        }
      />

      {/* Push toggle */}
      <Card className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn('grid h-10 w-10 place-items-center rounded-2xl', push.subscribed ? 'bg-brand/15 text-brand' : 'bg-surface-2 text-faint')}>
            {push.subscribed ? <BellRing className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </span>
          <div>
            <p className="font-medium text-content">Push notifications</p>
            <p className="text-sm text-muted">
              {!push.supported
                ? 'Not supported on this device.'
                : push.subscribed
                  ? "You'll be alerted even when the app is closed."
                  : 'Get alerted when it’s your turn, even when the app is closed.'}
            </p>
          </div>
        </div>
        {push.supported && (
          <Button
            variant={push.subscribed ? 'ghost' : 'primary'}
            size="sm"
            loading={push.busy}
            onClick={push.subscribed ? push.disable : push.enable}
          >
            {push.subscribed ? 'Disable' : 'Enable'}
          </Button>
        )}
      </Card>

      {loading && items.length === 0 ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="Alerts about your sessions, queue, and carpools will show up here." />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const meta = NOTIFICATION_META[n.type] || NOTIFICATION_META.system;
            const clickable = Boolean(n.actionUrl);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  disabled={!clickable && Boolean(n.readAt)}
                  className={cn(
                    'card flex w-full items-start gap-3 p-3 text-left transition-colors',
                    clickable && 'hover:bg-surface-2',
                    !n.readAt && 'ring-1 ring-brand/30'
                  )}
                >
                  <span className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', TONE_CLASS[meta.tone] || TONE_CLASS.muted)}>
                    <Icon name={meta.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('truncate font-medium', n.readAt ? 'text-muted' : 'text-content')}>{n.title}</p>
                      <span className="shrink-0 text-xs text-faint">{relativeTime(n.createdAt)}</span>
                    </div>
                    {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                  </div>
                  {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
