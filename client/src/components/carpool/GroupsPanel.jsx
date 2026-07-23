import { useState } from 'react';
import { UsersRound, Plus } from 'lucide-react';
import { createGroupSchema } from '@shared/validation.js';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { Input, Textarea } from '@/components/common/Input.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { Spinner, EmptyState, ErrorState } from '@/components/common/States.jsx';
import { useApi } from '@/hooks/useApi.js';
import { carpoolApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';

/** Carpool groups: create, join, leave. Groups scope rides/requests/schedules and can be
 *  a leaderboard scope. `onGroupsChanged` lets the parent refresh its group dropdowns. */
export function GroupsPanel({ onGroupsChanged }) {
  const groups = useApi(() => carpoolApi.listGroups(), []);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const refresh = () => {
    groups.refetch();
    onGroupsChanged?.();
  };

  const toggle = async (g) => {
    setBusyId(g.id);
    try {
      await (g.isMember ? carpoolApi.leaveGroup(g.id) : carpoolApi.joinGroup(g.id));
      toast.success(g.isMember ? `Left ${g.name}.` : `Joined ${g.name}.`);
      refresh();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Groups"
        subtitle="Carpool with a team, floor, or neighborhood"
        icon={UsersRound}
        action={
          <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        }
      />
      {groups.loading ? (
        <Spinner />
      ) : groups.error ? (
        <ErrorState error={groups.error} onRetry={groups.refetch} title="Could not load carpool groups" />
      ) : (groups.data || []).length === 0 ? (
        <EmptyState icon={UsersRound} title="No groups yet" description="Create one to carpool within a smaller circle." />
      ) : (
        <ul className="space-y-2">
          {groups.data.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 rounded-xl bg-bg-elevated p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-content">
                  {g.name}
                  {g.isMember && <Badge tone="brand">Member</Badge>}
                </p>
                {g.description && <p className="truncate text-sm text-muted">{g.description}</p>}
                <p className="text-xs text-faint">{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</p>
              </div>
              <Button
                size="sm"
                variant={g.isMember ? 'ghost' : 'secondary'}
                onClick={() => toggle(g)}
                loading={busyId === g.id}
              >
                {g.isMember ? 'Leave' : 'Join'}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); refresh(); }} />
    </Card>
  );
}

function CreateGroupModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setErrors({});
    setFormError(null);
    const parsed = createGroupSchema.safeParse({ name: name.trim(), description: description.trim() || undefined });
    if (!parsed.success) {
      const fe = {};
      for (const issue of parsed.error.issues) fe[issue.path[0] ?? '_form'] = issue.message;
      setErrors(fe);
      return;
    }
    setSubmitting(true);
    try {
      await carpoolApi.createGroup(parsed.data);
      toast.success('Group created.');
      setName('');
      setDescription('');
      onCreated?.();
    } catch (err) {
      setFormError(normalizeError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New group"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting}>
            Create
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="3rd floor commuters" />
        <Textarea label="Description (optional)" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        {formError && <p className="field-error">{formError}</p>}
      </div>
    </Modal>
  );
}
