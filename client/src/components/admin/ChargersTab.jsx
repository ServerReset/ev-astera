import { useEffect, useState } from 'react';
import { Zap, Plus, Pencil, Power, PowerOff, Trash2, Square } from 'lucide-react';
import { Button } from '@/components/common/Button.jsx';
import { Input } from '@/components/common/Input.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { Spinner, ErrorState, EmptyState } from '@/components/common/States.jsx';
import { AdminTable, AdminRow, Td } from './adminShared.jsx';
import { useConfirm } from '@/components/common/ConfirmDialog.jsx';
import { useRipple } from '@/hooks/useInteractions.js';
import { adminApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { CHARGER_STATUS, CHARGER_STATUS_META } from '@/utils/constants.js';
import { formatTime } from '@/utils/time.js';

/** Chargers admin: create / rename / offline+online / delete / force-end an in-progress session. */
export function ChargersTab({ chargers }) {
  const [confirm, dialog] = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [renameFor, setRenameFor] = useState(null);
  const [offlineFor, setOfflineFor] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const ripple = useRipple();

  const list = chargers.data || [];

  const run = async (id, fn, ok) => {
    setBusyId(id);
    try {
      await fn();
      if (ok) toast.success(ok);
      chargers.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (c) => {
    if (await confirm({ title: 'Delete charger?', message: `"${c.name}" will be removed permanently. This cannot be undone.`, danger: true, confirmLabel: 'Delete' })) {
      run(c.id, () => adminApi.deleteCharger(c.id), 'Charger deleted');
    }
  };
  const onForceEnd = async (c) => {
    if (await confirm({ title: 'Force-end session?', message: `End ${c.session?.userDisplayName || 'the current'}'s session on "${c.name}" now?`, danger: true, confirmLabel: 'Force end' })) {
      run(c.id, () => adminApi.forceEndSession(c.session.id), 'Session force-ended');
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{list.length} charger{list.length === 1 ? '' : 's'} configured</p>
        <Button size="sm" className="ripple press hover-sheen" onPointerDown={ripple} onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add charger
        </Button>
      </div>

      {chargers.loading && !list.length ? (
        <Spinner label="Loading chargers…" />
      ) : chargers.error ? (
        <ErrorState error={chargers.error} onRetry={chargers.refetch} title="Could not load chargers" />
      ) : list.length === 0 ? (
        <EmptyState icon={Zap} title="No chargers yet" description="Add your first charger to get the board running." action={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add charger</Button>} />
      ) : (
        <div className="card-solid rounded-xl-increased p-2">
          <AdminTable head={['Charger', 'Status', 'Occupant', { label: 'Actions', right: true }]}>
            {list.map((c) => {
              const meta = CHARGER_STATUS_META[c.status] || CHARGER_STATUS_META.available;
              const offline = c.status === CHARGER_STATUS.OFFLINE;
              const busy = busyId === c.id;
              return (
                <AdminRow key={c.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand/12 text-brand-strong"><Zap className="h-4 w-4" /></span>
                      <span className="font-medium text-content">{c.name}</span>
                    </div>
                  </Td>
                  <Td><Badge tone={meta.tone} dot>{meta.label}</Badge></Td>
                  <Td>
                    {c.session ? (
                      <span className="text-content">{c.session.userDisplayName}<span className="ml-1.5 text-xs text-faint">· est. {formatTime(c.session.etaAt)}</span></span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                  <Td right>
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="Rename" onClick={() => setRenameFor(c)} disabled={busy}><Pencil className="h-4 w-4" /></IconBtn>
                      {c.session && (
                        <IconBtn title="Force-end session" tone="danger" onClick={() => onForceEnd(c)} disabled={busy}><Square className="h-4 w-4" /></IconBtn>
                      )}
                      {offline ? (
                        <IconBtn title="Bring online" tone="success" onClick={() => run(c.id, () => adminApi.setChargerOnline(c.id), 'Charger back online')} disabled={busy}><Power className="h-4 w-4" /></IconBtn>
                      ) : (
                        <IconBtn title="Take offline" tone="warning" onClick={() => setOfflineFor(c)} disabled={busy}><PowerOff className="h-4 w-4" /></IconBtn>
                      )}
                      <IconBtn title="Delete" tone="danger" onClick={() => onDelete(c)} disabled={busy}><Trash2 className="h-4 w-4" /></IconBtn>
                    </div>
                  </Td>
                </AdminRow>
              );
            })}
          </AdminTable>
        </div>
      )}

      <CreateChargerModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); chargers.refetch(); }} />
      <RenameChargerModal charger={renameFor} onClose={() => setRenameFor(null)} onDone={() => { setRenameFor(null); chargers.refetch(); }} />
      <OfflineChargerModal charger={offlineFor} onClose={() => setOfflineFor(null)} onDone={() => { setOfflineFor(null); chargers.refetch(); }} />
      {dialog}
    </div>
  );
}

function IconBtn({ title, tone, onClick, disabled, children }) {
  const TONES = {
    danger: 'text-muted hover:bg-danger/10 hover:text-danger',
    warning: 'text-muted hover:bg-warning/10 hover:text-warning',
    success: 'text-muted hover:bg-success/10 hover:text-success',
  };
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-9 w-9 place-items-center rounded-full transition-colors duration-short active:scale-90 disabled:opacity-40 ${TONES[tone] || 'text-muted hover:bg-surface-2 hover:text-content'}`}
    >
      {children}
    </button>
  );
}

function CreateChargerModal({ open, onClose, onDone }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const ripple = useRipple();
  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await adminApi.createCharger({ name: name.trim() });
      toast.success('Charger added');
      setName('');
      onDone();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add charger"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="ripple press" onPointerDown={ripple} loading={saving} onClick={submit}>Add charger</Button>
        </div>
      }
    >
      <Input label="Charger name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Garage B2" autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()} />
    </Modal>
  );
}

function RenameChargerModal({ charger, onClose, onDone }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const ripple = useRipple();
  // Seed the field from the target charger each time a new one is opened.
  useEffect(() => {
    if (charger) setName(charger.name);
  }, [charger]);
  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await adminApi.renameCharger(charger.id, name.trim());
      toast.success('Charger renamed');
      setName('');
      onDone();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={Boolean(charger)}
      onClose={() => { setName(''); onClose(); }}
      title="Rename charger"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { setName(''); onClose(); }}>Cancel</Button>
          <Button className="ripple press" onPointerDown={ripple} loading={saving} onClick={submit}>Save</Button>
        </div>
      }
    >
      <Input label="Charger name" value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()} />
    </Modal>
  );
}

function OfflineChargerModal({ charger, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const ripple = useRipple();
  const submit = async () => {
    setSaving(true);
    try {
      await adminApi.setChargerOffline(charger.id, reason.trim() || undefined);
      toast.success('Charger taken offline');
      setReason('');
      onDone();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={Boolean(charger)}
      onClose={() => { setReason(''); onClose(); }}
      title={`Take "${charger?.name}" offline`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { setReason(''); onClose(); }}>Cancel</Button>
          <Button variant="danger" className="ripple press" onPointerDown={ripple} loading={saving} onClick={submit}>Take offline</Button>
        </div>
      }
    >
      <Input label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Faulty connector — awaiting repair" hint="Shown to members on the charger board." />
    </Modal>
  );
}
