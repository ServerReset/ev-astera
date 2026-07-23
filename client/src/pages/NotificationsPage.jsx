import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, BellOff, CheckCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Icon } from '@/components/common/Icon.jsx';
import { EmptyState, ErrorState } from '@/components/common/States.jsx';
import { NudgeReactionButtons } from '@/components/notifications/NudgeReactionButtons.jsx';
import { useNotificationStore } from '@/stores/notificationStore.js';
import { usePushNotifications } from '@/hooks/usePushNotifications.js';
import { useRealtime } from '@/hooks/useRealtime.js';
import { NOTIFICATION_META, NOTIFICATION_TYPES } from '@/utils/constants.js';
import { relativeTime } from '@/utils/time.js';
import { cn } from '@/utils/cn.js';

// Static tone → class map (Tailwind's JIT only sees literal class strings, so these can't
// be built by interpolation). Each pairs a tonal container with its on-container text role.
const TONE_CLASS = {
  brand: 'bg-brand/15 text-brand-strong',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  muted: 'bg-surface-2 text-muted',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { items, unread, loading, error, refresh, markRead, markAllRead } = useNotificationStore();
  const push = usePushNotifications();
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    refresh();
  }, [refresh]);

  useRealtime('notifications', ['notifications'], refresh);

  const open = (n) => {
    if (!n.readAt) markRead(n.id);
    if (n.actionUrl) navigate(n.actionUrl);
  };

  // Filter is applied over the loaded page only (the list is paginated at the API — page 1).
  // "Unread" therefore means "unread among what's loaded", which is honest for a recent feed.
  const shown = useMemo(
    () => (filter === 'unread' ? items.filter((n) => !n.readAt) : items),
    [items, filter]
  );

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
              <span className="hidden sm:inline">Mark all read</span>
            </Button>
          ) : null
        }
      />

      {/* Push subscription toggle — an elevated tonal card, its own concern above the feed. */}
      <div className="card mb-5 flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition-colors duration-medium ease-standard',
              push.subscribed ? 'bg-brand/15 text-brand-strong' : 'bg-surface-2 text-faint'
            )}
          >
            {push.subscribed ? <BellRing className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
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
      </div>

      {/* Filter chips — only meaningful once there's something loaded to filter. */}
      {items.length > 0 && (
        <div className="mb-4 flex items-center gap-2" role="tablist" aria-label="Filter notifications">
          {FILTERS.map((f) => {
            const activeChip = filter === f.key;
            const count = f.key === 'unread' ? unread : items.length;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={activeChip}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium',
                  'transition-colors duration-medium ease-standard',
                  activeChip
                    ? 'bg-brand/15 text-brand-strong'
                    : 'bg-surface-2 text-muted hover:text-content'
                )}
              >
                {f.label}
                {count > 0 && (
                  <span className={cn('text-xs', activeChip ? 'text-brand-strong' : 'text-faint')}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {loading && items.length === 0 ? (
        <ul className="space-y-2" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="skeleton h-[68px] rounded-2xl" />
          ))}
        </ul>
      ) : error && items.length === 0 ? (
        <ErrorState error={error} onRetry={refresh} title="Could not load notifications" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="Alerts about your sessions, queue, and carpools will show up here."
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title="You’re all caught up"
          description="No unread alerts right now."
        />
      ) : (
        <ul className="space-y-2">
          {shown.map((n, i) => {
            const meta = NOTIFICATION_META[n.type] || NOTIFICATION_META[NOTIFICATION_TYPES.SYSTEM];
            const clickable = Boolean(n.actionUrl);
            const isUnread = !n.readAt;
            return (
              <li
                key={n.id}
                className="animate-slide-up [animation-fill-mode:backwards]"
                style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
              >
                <button
                  type="button"
                  onClick={() => open(n)}
                  disabled={!clickable && !isUnread}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-2xl border p-3 text-left',
                    'transition-[background-color,border-color] duration-medium ease-standard',
                    isUnread ? 'border-transparent bg-surface-2' : 'border-border bg-surface',
                    (clickable || isUnread) && 'hover:border-border-strong',
                    !clickable && !isUnread && 'cursor-default'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                      TONE_CLASS[meta.tone] || TONE_CLASS.muted
                    )}
                  >
                    <Icon name={meta.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('truncate', isUnread ? 'font-semibold text-content' : 'font-medium text-muted')}>
                        {n.title}
                      </p>
                      <span className="shrink-0 text-xs text-faint">{relativeTime(n.createdAt)}</span>
                    </div>
                    {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                    {n.type === NOTIFICATION_TYPES.NUDGE && (
                      <div className="mt-2">
                        <NudgeReactionButtons
                          messageId={n.metadata?.messageId}
                          initialReaction={n.metadata?.reaction}
                        />
                      </div>
                    )}
                  </div>
                  {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
