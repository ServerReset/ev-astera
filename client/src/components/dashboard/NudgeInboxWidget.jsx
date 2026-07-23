import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Icon } from '@/components/common/Icon.jsx';
import { NudgeReactionButtons } from '@/components/notifications/NudgeReactionButtons.jsx';
import { useNotificationStore } from '@/stores/notificationStore.js';
import { usePushNotifications } from '@/hooks/usePushNotifications.js';
import { NOTIFICATION_META } from '@/utils/constants.js';
import { relativeTime } from '@/utils/time.js';
import { cn } from '@/utils/cn.js';

const TONE_CLASS = {
  brand: 'bg-brand/15 text-brand',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  muted: 'bg-surface-2 text-muted',
};

/**
 * Dashboard notification widget. Reads the already-polled notificationStore (no new requests).
 * Push disabled: richer inbox with inline nudge reactions. Push enabled: one compact row —
 * the OS push already delivered the "you were just notified" signal.
 */
export function NudgeInboxWidget() {
  const navigate = useNavigate();
  const { items, markRead } = useNotificationStore();
  const { subscribed } = usePushNotifications();

  if (!items.length) return null;

  const open = (n) => {
    if (!n.readAt) markRead(n.id);
    navigate(n.actionUrl || '/notifications');
  };

  const visible = subscribed ? items.slice(0, 1) : items.slice(0, 5);

  return (
    <Card className="mb-5">
      <CardHeader title="Notifications" icon={Bell} />
      <ul className="space-y-1.5">
        {visible.map((n) => {
          const meta = NOTIFICATION_META[n.type] || NOTIFICATION_META.system;
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-surface-2',
                  !n.readAt && 'ring-1 ring-brand/30'
                )}
              >
                <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', TONE_CLASS[meta.tone] || TONE_CLASS.muted)}>
                  <Icon name={meta.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('truncate text-sm font-medium', n.readAt ? 'text-muted' : 'text-content')}>{n.title}</p>
                    <span className="shrink-0 text-xs text-faint">{relativeTime(n.createdAt)}</span>
                  </div>
                  {!subscribed && n.body && <p className="mt-0.5 truncate text-sm text-muted">{n.body}</p>}
                  {!subscribed && n.type === 'nudge' && (
                    <div className="mt-1">
                      <NudgeReactionButtons messageId={n.metadata?.messageId} initialReaction={n.metadata?.reaction} />
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
