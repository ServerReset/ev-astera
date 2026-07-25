import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Icon } from '@/components/common/Icon.jsx';
import { NudgeReactionButtons } from '@/components/notifications/NudgeReactionButtons.jsx';
import { useNotificationStore } from '@/stores/notificationStore.js';
import { usePushNotifications } from '@/hooks/usePushNotifications.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { NOTIFICATION_META } from '@/utils/constants.js';
import { relativeTime } from '@/utils/time.js';
import { cn } from '@/utils/cn.js';

const TONE_CLASS = {
  brand: 'bg-brand/15 text-brand-strong',
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
  const ripple = useRipple();

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
        {visible.map((n, i) => {
          const meta = NOTIFICATION_META[n.type] || NOTIFICATION_META.system;
          const isUnread = !n.readAt;
          return (
            <li
              key={n.id}
              className="animate-slide-up [animation-fill-mode:backwards]"
              style={{ animationDelay: `${Math.min(i, 5) * 45}ms` }}
            >
              {/* A real nudge row nests NudgeReactionButtons' own <button>s — a <button> wrapper
                  here would be invalid HTML (nested interactive elements break focus/AT
                  semantics), so this is a div with button semantics instead. */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => open(n)}
                onPointerDown={ripple}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open(n))}
                className={cn(
                  'group ripple relative flex w-full items-start gap-2.5 overflow-hidden rounded-2xl p-2 text-left cursor-pointer',
                  'transition-[background-color,box-shadow] duration-medium ease-standard hover:bg-surface-2',
                  isUnread && 'bg-brand/[0.06] ring-1 ring-inset ring-brand/30'
                )}
              >
                <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-transform duration-medium ease-spring group-hover:scale-110', TONE_CLASS[meta.tone] || TONE_CLASS.muted)}>
                  <Icon name={meta.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('flex min-w-0 items-center gap-1.5 truncate text-sm', isUnread ? 'font-semibold text-content' : 'font-medium text-muted')}>
                      {isUnread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                      <span className="truncate">{n.title}</span>
                    </p>
                    <span className="shrink-0 text-xs text-faint">{relativeTime(n.createdAt)}</span>
                  </div>
                  {!subscribed && n.body && <p className="mt-0.5 truncate text-sm text-muted">{n.body}</p>}
                  {!subscribed && n.type === 'nudge' && (
                    <div className="mt-1">
                      <NudgeReactionButtons messageId={n.metadata?.messageId} initialReaction={n.metadata?.reaction} />
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
