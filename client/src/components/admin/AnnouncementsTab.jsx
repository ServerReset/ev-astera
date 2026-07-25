import { useState } from 'react';
import { Megaphone, Plus, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/common/Button.jsx';
import { Input, Textarea } from '@/components/common/Input.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { Spinner, ErrorState, EmptyState } from '@/components/common/States.jsx';
import { useConfirm } from '@/components/common/ConfirmDialog.jsx';
import { useRipple } from '@/hooks/useInteractions.js';
import { adminApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { formatDateTime, relativeTime, localInputToISO } from '@/utils/time.js';

/** Announcements admin: list + create (title/body/optional expiry) + delete. */
export function AnnouncementsTab({ announcements }) {
  const [confirm, dialog] = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const list = announcements.data || [];
  const ripple = useRipple();

  const onDelete = async (a) => {
    if (await confirm({ title: 'Delete announcement?', message: `"${a.title}" will be removed.`, danger: true, confirmLabel: 'Delete' })) {
      try {
        await adminApi.deleteAnnouncement(a.id);
        toast.success('Announcement deleted');
        announcements.refetch();
      } catch (err) {
        toast.error(normalizeError(err).message);
      }
    }
  };

  const isExpired = (a) => a.expires_at && new Date(a.expires_at) < new Date();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{list.length} announcement{list.length === 1 ? '' : 's'}</p>
        <Button size="sm" className="ripple press hover-sheen" onPointerDown={ripple} onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New announcement
        </Button>
      </div>

      {announcements.loading && !list.length ? (
        <Spinner label="Loading announcements…" />
      ) : announcements.error ? (
        <ErrorState error={announcements.error} onRetry={announcements.refetch} title="Could not load announcements" />
      ) : list.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements" description="Broadcast news to everyone at your site." action={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New announcement</Button>} />
      ) : (
        <div className="stagger grid gap-3">
          {list.map((a) => (
            <div key={a.id} className="card hover-sheen group relative overflow-hidden rounded-xl-increased p-4 transition-all duration-medium ease-emphasized">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong"><Megaphone className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-content">{a.title}</p>
                      {isExpired(a) ? <Badge tone="faint">Expired</Badge> : a.active ? <Badge tone="success" dot>Active</Badge> : <Badge tone="muted">Inactive</Badge>}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{a.body}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-faint">
                      <span>Posted {relativeTime(a.created_at)}</span>
                      {a.expires_at && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Expires {formatDateTime(a.expires_at)}</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onDelete(a)}
                  aria-label="Delete announcement"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-danger/10 hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-danger/70 active:scale-90"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateAnnouncementModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); announcements.refetch(); }} />
      {dialog}
    </div>
  );
}

function CreateAnnouncementModal({ open, onClose, onDone }) {
  const [form, setForm] = useState({ title: '', body: '', expiresAt: '' });
  const [saving, setSaving] = useState(false);
  const ripple = useRipple();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.warning('Title and body are required.');
      return;
    }
    setSaving(true);
    try {
      await adminApi.createAnnouncement({
        title: form.title.trim(),
        body: form.body.trim(),
        expiresAt: form.expiresAt ? localInputToISO(form.expiresAt) : null,
      });
      toast.success('Announcement posted');
      setForm({ title: '', body: '', expiresAt: '' });
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
      title="New announcement"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="ripple press" onPointerDown={ripple} loading={saving} onClick={submit}>Post announcement</Button>
        </div>
      }
    >
      <div className="grid gap-3">
        <Input label="Title" value={form.title} onChange={set('title')} placeholder="Charger maintenance this Friday" autoFocus />
        <Textarea label="Body" value={form.body} onChange={set('body')} rows={4} placeholder="What everyone needs to know…" />
        <Input label="Expires (optional)" type="datetime-local" value={form.expiresAt} onChange={set('expiresAt')} />
      </div>
    </Modal>
  );
}
