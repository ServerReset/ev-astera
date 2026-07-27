import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, CheckCheck, Sparkles, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Switch } from '@/components/common/Switch.jsx';
import { Icon } from '@/components/common/Icon.jsx';
import { Spinner, EmptyState, ErrorState } from '@/components/common/States.jsx';
import { NudgeReactionButtons } from '@/components/notifications/NudgeReactionButtons.jsx';
import { useNotificationStore } from '@/stores/notificationStore.js';
import { usePushNotifications } from '@/hooks/usePushNotifications.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { burstConfetti } from '@/utils/confetti.js';
import { NOTIFICATION_META, NOTIFICATION_TYPES } from '@/utils/constants.js';
import { relativeTime } from '@/utils/time.js';
import { cn } from '@/utils/cn.js';

// Tone → static Tailwind classes for the leading icon chip. Static map (never interpolated) so
// Tailwind's JIT keeps every class; mirrors NudgeInboxWidget's TONE_CLASS so rows read identically
// in the inbox and here.
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

/** One alert row. Unread rows get a brand-tinted wash, a left brand seam, and a single ping dot
 * (no infinite per-row glow). Actionable rows (have an actionUrl, or are simply still unread) are
 * keyboard-operable button-semantic divs — a real <button> would be invalid around the nested
 * reaction <button>s in a nudge row. */
function NotificationRow({ n, onOpen }) {
  const meta = NOTIFICATION_META[n.type] || NOTIFICATION_META.system;
  const unread = !n.readAt;
  const actionable = Boolean(n.actionUrl) || unread;
  const isNudge = n.type === NOTIFICATION_TYPES.NUDGE;
  const ripple = useRipple();

  const interactiveProps = actionable
    ? {
        role: 'button',
        tabIndex: 0,
        onClick: (e) => {
          // Ignore clicks bubbling up from nested controls (the nudge reaction buttons) so
          // reacting doesn't also open/mark-read the row.
          if (e.target !== e.currentTarget && e.currentTarget.contains(e.target) && e.target.closest('button')) return;
          onOpen(n);
        },
        onKeyDown: (e) => {
          // Only handle keys that originate on the row itself — a bubbled Enter/Space from a nested
          // reaction <button> must reach that button (not get preventDefault'd + trigger nav here).
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(n);
          }
        },
        onPointerDown: ripple,
      }
    : {};

  return (
    <li>
      <div
        {...interactiveProps}
        className={cn(
          'card group relative flex items-start gap-3 overflow-hidden rounded-xl-increased p-3.5 transition-all duration-medium ease-emphasized',
          actionable && 'ripple cursor-pointer card-interactive hover-sheen focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/80',
          unread ? 'bg-brand/[0.06] ring-1 ring-brand/25' : 'opacity-95'
        )}
      >
        {/* Unread brand seam down the leading edge. */}
        {unread && <span className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-r bg-brand/70" aria-hidden />}

        <span className={cn('relative mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl', TONE_CLASS[meta.tone] || TONE_CLASS.muted)}>
          <Icon name={meta.icon} className="h-5 w-5" />
          {/* Unread marker: a single solid dot — no infinite ping. Across a list of many unread
              rows, N looping ping animations compete for attention; the brand row wash + left seam
              + this static dot already read as "unread" without per-row motion. */}
          {unread && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-surface" aria-hidden />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-title-md leading-tight', unread ? 'text-content' : 'text-muted')}>{n.title}</p>
            <span className="mt-0.5 shrink-0 text-xs text-faint" title={new Date(n.createdAt).toLocaleString()}>
              {relativeTime(n.createdAt)}
            </span>
          </div>
          {n.body && <p className="mt-1 text-body-md text-muted">{n.body}</p>}
          {isNudge && (
            <div className="mt-2.5">
              <NudgeReactionButtons messageId={n.metadata?.messageId} initialReaction={n.metadata?.reaction} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/** Push-subscription card. A Switch drives enable()/disable(); a hover sheen invites the tap. When
 * the device can't do Web Push at all we say so plainly instead of dangling a dead toggle. */
function PushCard() {
  const { supported, subscribed, busy, enable, disable } = usePushNotifications();

  const onToggle = (next) => {
    if (busy) return;
    if (next) enable();
    else disable();
  };

  return (
    <Card className={cn('group hover-sheen animate-slide-up mb-5 relative overflow-hidden transition-all duration-medium ease-emphasized hover:-translate-y-0.5', subscribed && 'ring-1 ring-brand/25')}>
      {/* Soft brand bloom when push is live — a single focal card, so a gentle glow reads as "on"
          without any looping per-item motion. */}
      {subscribed && <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-brand/15 blur-3xl" aria-hidden />}
      <div className="relative flex items-center gap-3.5">
        <span
          className={cn(
            'grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-colors duration-medium',
            subscribed ? 'bg-brand/15 text-brand-strong ring-1 ring-brand/25' : 'bg-surface-2 text-muted'
          )}
        >
          <BellRing className={cn('h-5 w-5 transition-transform duration-medium ease-spring', subscribed ? 'animate-float' : 'group-hover:-rotate-12 group-hover:scale-110')} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-title-md text-content">Push notifications</p>
          <p className="mt-0.5 text-sm text-muted">
            {!supported
              ? 'This device or browser cannot receive push alerts.'
              : subscribed
                ? "You'll get alerts even when this tab is closed."
                : 'Turn on to get queue turns and nudges on your device.'}
          </p>
        </div>
        {supported ? (
          <div className="flex items-center gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden />}
            <Switch checked={subscribed} onChange={onToggle} disabled={busy} label="Push notifications" />
          </div>
        ) : (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-faint">Unavailable</span>
        )}
      </div>
    </Card>
  );
}

/** Chip toggle for the All / Unread filter. */
function FilterChip({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'press inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-label-lg transition-all duration-medium ease-emphasized',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/80',
        active
          ? 'border-brand bg-brand/15 text-brand-strong shadow-elevation-1'
          : 'border-border bg-surface text-muted hover:border-border-strong hover:text-content'
      )}
    >
      {label}
      {count > 0 && (
        <span
          className={cn(
            'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
            active ? 'bg-brand/25 text-brand-strong' : 'bg-surface-2 text-muted'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { items, unread, loading, error, refresh, markRead, markAllRead } = useNotificationStore();
  const [filter, setFilter] = useState('all');

  // Fresh load on arrival. No page-level poll here: the global useNotificationSync (mounted once in
  // AppLayout) already polls this same store on an interval, and this page renders from that store —
  // a second poller would just double the notification query volume for no benefit.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Count from the loaded list (not the server `unread` badge) so the chip matches exactly what
  // this page can show and re-filter.
  const unreadInList = useMemo(() => items.filter((n) => !n.readAt).length, [items]);
  const shown = useMemo(
    () => (filter === 'unread' ? items.filter((n) => !n.readAt) : items),
    [items, filter]
  );

  const open = (n) => {
    if (!n.readAt) markRead(n.id);
    if (n.actionUrl) navigate(n.actionUrl);
  };

  // Inbox-zero reward: clear everything, then a small confetti puff from the button.
  const clearAll = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    markAllRead();
    burstConfetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 48 });
  };

  const showInitialSpinner = loading && items.length === 0;

  return (
    <div>
      <PageHeader
        title="Alerts"
        description={unreadInList > 0 ? `${unreadInList} unread — tap to catch up.` : 'Queue turns, nudges, and everything in between.'}
        icon={Bell}
        action={
          unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearAll} className="press">
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Mark all read</span>
            </Button>
          ) : null
        }
      />

      <PushCard />

      <div className="mb-4 flex items-center gap-2">
        {FILTERS.map((f) => (
          <FilterChip
            key={f.key}
            active={filter === f.key}
            label={f.label}
            count={f.key === 'unread' ? unreadInList : items.length}
            onClick={() => setFilter(f.key)}
          />
        ))}
      </div>

      {showInitialSpinner ? (
        <Spinner label="Loading your alerts…" />
      ) : error ? (
        <ErrorState error={error} onRetry={refresh} title="Could not load your alerts" />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={filter === 'unread' ? CheckCheck : Sparkles}
          title={filter === 'unread' ? 'Nothing unread' : "You're all caught up"}
          description={
            filter === 'unread'
              ? 'Every alert has been read. Nice work staying on top of it.'
              : 'New queue turns, nudges, and announcements will land right here.'
          }
        />
      ) : (
        <ul className="stagger space-y-2.5">
          {shown.map((n) => (
            <NotificationRow key={n.id} n={n} onOpen={open} />
          ))}
        </ul>
      )}
    </div>
  );
}
