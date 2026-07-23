import { useEffect } from 'react';
import { Siren } from 'lucide-react';
import { Card } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { messageApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { useApi } from '@/hooks/useApi.js';
import { useAuthStore } from '@/stores/authStore.js';
import { useNotificationStore } from '@/stores/notificationStore.js';
import { relativeTime } from '@/utils/time.js';

/**
 * Shows open "I need a charger now" requests to everyone else, with one-tap accept/decline
 * (messageApi.emergencies / respondEmergency — see EmergencyModal for how these get raised).
 *
 * Rather than polling this list on its own timer, it piggybacks on the notification stream:
 * an incoming EMERGENCY notification — already polled by useNotificationSync — is the signal
 * to refetch the open-requests list. That's also why the
 * EMERGENCY_REQUESTED/EMERGENCY_RESPONDED notifications' actionUrl is '/': this banner lives
 * on the dashboard, so tapping the notification lands exactly where you can act on it.
 */
export function EmergencyBanner() {
  const userId = useAuthStore((s) => s.user?.id);
  const list = useApi(() => messageApi.emergencies(), []);
  const lastNotifiedId = useNotificationStore((s) => s.items[0]?.id);

  useEffect(() => {
    list.refetch().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastNotifiedId]);

  const open = (list.data || []).filter((r) => r.userId !== userId);
  if (!open.length) return null;

  const respond = async (requestId, accept) => {
    try {
      await messageApi.respondEmergency({ requestId, accept });
      toast.success(accept ? "Thanks — they've been told you're wrapping up." : 'Noted, thanks for letting them know.');
      list.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    }
  };

  return (
    <div className="mb-4 space-y-2">
      {open.map((r) => (
        <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-danger/40 bg-danger/5">
          <div className="flex items-start gap-2.5">
            <Siren className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <div>
              <p className="font-medium text-content">
                {r.userDisplayName || 'Someone'} needs a charger — {r.reason}
              </p>
              {r.explanation && <p className="text-sm text-muted">{r.explanation}</p>}
              <p className="text-xs text-faint">Requested {relativeTime(r.createdAt)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => respond(r.id, false)}>
              Can't help
            </Button>
            <Button variant="danger" size="sm" onClick={() => respond(r.id, true)}>
              I'll wrap up
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
