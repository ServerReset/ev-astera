import { useCallback, useMemo, useState } from 'react';
import { Zap, Siren, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Spinner, EmptyState, ErrorState } from '@/components/common/States.jsx';
import { ChargerCard } from '@/components/session/ChargerCard.jsx';
import { ActiveSessionCard } from '@/components/session/ActiveSessionCard.jsx';
import { StartSessionModal } from '@/components/session/StartSessionModal.jsx';
import { EndSessionModal } from '@/components/session/EndSessionModal.jsx';
import { EtaModal } from '@/components/session/EtaModal.jsx';
import { NudgeModal } from '@/components/session/NudgeModal.jsx';
import { EmergencyModal } from '@/components/session/EmergencyModal.jsx';
import { EmergencyBanner } from '@/components/session/EmergencyBanner.jsx';
import { NudgeInboxWidget } from '@/components/dashboard/NudgeInboxWidget.jsx';
import { QueuePanel } from '@/components/queue/QueuePanel.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useRealtime } from '@/hooks/useRealtime.js';
import { useAuthStore } from '@/stores/authStore.js';
import { chargerApi, sessionApi, queueApi } from '@/services/endpoints.js';
import { ENV, CHARGER_STATUS } from '@/utils/constants.js';

/** Normalize the raw active-session row (snake_case + nested chargers) for ActiveSessionCard. */
function normalizeActive(row) {
  if (!row) return null;
  return {
    id: row.id,
    chargerId: row.charger_id,
    chargerName: row.chargers?.name,
    status: row.status,
    startedAt: row.started_at,
    etaAt: row.eta_at,
  };
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const chargers = useApi(() => chargerApi.list(), []);
  const active = useApi(() => sessionApi.active(), []);
  const queue = useApi(() => queueApi.list(), []);
  const mine = useApi(() => queueApi.mine(), []);

  const [startFor, setStartFor] = useState(null);
  const [nudgeFor, setNudgeFor] = useState(null);
  const [endOpen, setEndOpen] = useState(false);
  const [etaOpen, setEtaOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  const mySession = normalizeActive(active.data);

  const refreshAll = useCallback(() => {
    chargers.refetch();
    active.refetch();
    queue.refetch();
    mine.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any change to chargers/sessions/queue at this location refreshes the board.
  useRealtime('dashboard', ['chargers', 'sessions', 'queue_entries'], refreshAll, {
    filter: ENV.locationId ? `location_id=eq.${ENV.locationId}` : undefined,
  });

  const canStart = !mySession; // one active session per user
  const canJoinQueue = !mySession;

  const list = chargers.data || [];
  const sortedQueue = useMemo(() => queue.data || [], [queue.data]);

  const availableCount = list.filter((c) => c.status === CHARGER_STATUS.AVAILABLE).length;

  return (
    <div>
      <PageHeader
        title="Chargers"
        description={
          list.length
            ? `${availableCount} of ${list.length} available right now.`
            : 'Live status of every charger at your site.'
        }
        icon={Zap}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={refreshAll} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEmergencyOpen(true)}>
              <Siren className="h-4 w-4" />
              <span className="hidden sm:inline">Emergency</span>
            </Button>
          </div>
        }
      />

      <EmergencyBanner />

      {mySession && (
        <div className="mb-6 animate-slide-up">
          <ActiveSessionCard
            session={mySession}
            onExtend={() => setEtaOpen(true)}
            onEnd={() => setEndOpen(true)}
          />
        </div>
      )}

      {/*
        Adaptive layout: single column up through medium/expanded; the list-detail split turns
        on at `xl` (1280px+). The threshold is deliberately above the `expanded` (840) drawer
        breakpoint — the 288px permanent drawer eats width, so a side rail only has room once
        the viewport is genuinely laptop-wide (1280 − drawer − padding ≈ 940px content → ~600px
        charger pane = two comfortable columns). Below xl, chargers stay full-width and the
        alerts/queue rail stacks beneath them.
      */}
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-6">
        {/* Primary pane — chargers */}
        <section aria-label="Chargers">
          {chargers.loading && !list.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-40 rounded-2xl" />
              ))}
            </div>
          ) : chargers.error ? (
            <ErrorState error={chargers.error} onRetry={chargers.refetch} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No chargers here yet"
              description="Chargers configured for your site will show up here."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {list.map((charger, i) => (
                <div
                  key={charger.id}
                  className="animate-slide-up [animation-fill-mode:backwards]"
                  style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                >
                  <ChargerCard
                    charger={charger}
                    isMine={mySession?.chargerId === charger.id}
                    canStart={canStart}
                    onStart={(c) => setStartFor(c)}
                    onNudge={(c) => setNudgeFor(c)}
                    onEndMine={() => setEndOpen(true)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Secondary rail — alerts + queue (sticky on xl, stacked below on smaller) */}
        <aside className="mt-6 space-y-6 xl:mt-0 xl:sticky xl:top-20">
          <NudgeInboxWidget />
          <QueuePanel
            entries={sortedQueue}
            mine={mine.data}
            canJoin={canJoinQueue}
            onChanged={() => {
              queue.refetch();
              mine.refetch();
            }}
          />
        </aside>
      </div>

      {/* Modals */}
      <StartSessionModal
        open={Boolean(startFor)}
        charger={startFor}
        user={user}
        onClose={() => setStartFor(null)}
        onStarted={refreshAll}
      />
      {mySession && (
        <>
          <EndSessionModal open={endOpen} session={mySession} onClose={() => setEndOpen(false)} onEnded={refreshAll} />
          <EtaModal open={etaOpen} session={mySession} onClose={() => setEtaOpen(false)} onUpdated={refreshAll} />
        </>
      )}
      <NudgeModal open={Boolean(nudgeFor)} charger={nudgeFor} onClose={() => setNudgeFor(null)} />
      <EmergencyModal open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
    </div>
  );
}
