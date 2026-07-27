import { useCallback, useMemo, useState } from 'react';
import { Zap, Siren, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/common/Button.jsx';
import { EmptyState, ErrorState } from '@/components/common/States.jsx';
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
import { sessionApi } from '@/services/endpoints.js';
import { CHARGER_STATUS } from '@/utils/constants.js';
import { cn } from '@/utils/cn.js';

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

  // ONE request for the whole dashboard (chargers + active session + queue + my entry +
  // emergencies) instead of 5 separate polled fetches. `snap` holds it all; the individual
  // datasets are derived below.
  const snapshot = useApi(() => sessionApi.dashboard(), []);
  const snap = snapshot.data;

  const [startFor, setStartFor] = useState(null);
  const [nudgeFor, setNudgeFor] = useState(null);
  const [endOpen, setEndOpen] = useState(false);
  const [etaOpen, setEtaOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  const mySession = normalizeActive(snap?.active);

  // One refetch drives the whole page.
  const refreshAll = useCallback(() => {
    snapshot.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshing = snapshot.loading;

  // Single poll tick = single request (was 4). Pauses when the tab is hidden (useRealtime).
  useRealtime('dashboard', ['chargers', 'sessions', 'queue_entries'], refreshAll);

  const canStart = !mySession;
  const canJoinQueue = !mySession;
  const list = useMemo(() => snap?.chargers || [], [snap]);
  const queueEntries = snap?.queue || [];
  const myQueueEntry = snap?.mine || null;
  const emergencies = snap?.emergencies || [];
  // A charger counts as "free to take" only if it's available AND not reserved for a queue turn
  // in flight — the same gate ChargerCard uses to decide whether to offer "Start".
  const availableCount = useMemo(
    () => list.filter((c) => c.status === CHARGER_STATUS.AVAILABLE && !c.reserved).length,
    [list]
  );

  // Warm, state-aware subtitle — celebrates when everything's free, nudges toward the queue when it's not.
  const headerDescription = !list.length
    ? 'Live status of every charger at your site.'
    : availableCount === 0
      ? "Every charger's busy — hop in the queue and we'll ping you the moment one frees up."
      : availableCount === list.length
        ? (list.length === 1 ? 'Your charger is free and waiting.' : `All ${list.length} chargers are free — take your pick.`)
        : `${availableCount} of ${list.length} free right now — grab one before they're gone.`;

  return (
    <div>
      <PageHeader
        title="Chargers"
        description={headerDescription}
        icon={Zap}
        action={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshAll}
              disabled={refreshing}
              aria-label={refreshing ? 'Refreshing' : 'Refresh'}
            >
              {/* Honest feedback: the icon spins only while a refetch is actually in flight. */}
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEmergencyOpen(true)}>
              <Siren className="h-4 w-4" />
              <span className="hidden sm:inline">Emergency</span>
            </Button>
          </div>
        }
      />

      <EmergencyBanner emergencies={emergencies} hasActiveSession={Boolean(mySession)} onChanged={refreshAll} />

      {mySession && (
        <div className="mb-6">
          <ActiveSessionCard session={mySession} onExtend={() => setEtaOpen(true)} onEnd={() => setEndOpen(true)} />
        </div>
      )}

      {/* Adaptive: chargers grid grows columns with width; queue + notifications sit beside it,
          becoming a sticky rail on very wide monitors. */}
      <div className="2xl:grid 2xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:items-start 2xl:gap-6">
        <section aria-label="Chargers">
          {snapshot.loading && !list.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-44 rounded-xl-increased" />)}
            </div>
          ) : snapshot.error ? (
            <ErrorState error={snapshot.error} onRetry={snapshot.refetch} title="Could not load the dashboard" />
          ) : list.length === 0 ? (
            <EmptyState icon={Zap} title="No chargers here yet" description="Chargers configured for your site will show up here." />
          ) : (
            <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-2 3xl:grid-cols-3">
              {list.map((charger) => (
                <ChargerCard
                  key={charger.id}
                  charger={charger}
                  isMine={mySession?.chargerId === charger.id}
                  canStart={canStart}
                  onStart={(c) => setStartFor(c)}
                  onNudge={(c) => setNudgeFor(c)}
                  onEndMine={() => setEndOpen(true)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="mt-6 grid gap-4 sm:grid-cols-2 2xl:mt-0 2xl:sticky 2xl:top-6 2xl:grid-cols-1 2xl:gap-6">
          <QueuePanel entries={queueEntries} mine={myQueueEntry} canJoin={canJoinQueue} onChanged={refreshAll} />
          <NudgeInboxWidget />
        </aside>
      </div>

      {/* Modals — mounted ONLY when open, so their config-fetch hooks (useSessionConfig /
          useMessageConfig) don't fire a request on every dashboard load. Previously all four were
          always mounted with open=false, firing 3 config calls per visit (one a duplicate). */}
      {startFor && (
        <StartSessionModal open charger={startFor} user={user} onClose={() => setStartFor(null)} onStarted={refreshAll} />
      )}
      {mySession && endOpen && (
        <EndSessionModal open session={mySession} onClose={() => setEndOpen(false)} onEnded={refreshAll} />
      )}
      {mySession && etaOpen && (
        <EtaModal open session={mySession} onClose={() => setEtaOpen(false)} onUpdated={refreshAll} />
      )}
      {nudgeFor && <NudgeModal open charger={nudgeFor} onClose={() => setNudgeFor(null)} />}
      {emergencyOpen && <EmergencyModal open onClose={() => setEmergencyOpen(false)} />}
    </div>
  );
}
