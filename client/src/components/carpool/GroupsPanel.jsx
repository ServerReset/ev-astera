import { useState } from 'react';
import { Users, Plus, LogIn, LogOut, UsersRound } from 'lucide-react';
import { Button } from '@/components/common/Button.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { Input, Textarea } from '@/components/common/Input.jsx';
import { Spinner, EmptyState, ErrorState } from '@/components/common/States.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { carpoolApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { burstConfetti } from '@/utils/confetti.js';
import { createGroupSchema } from '@shared/validation.js';
import { cn } from '@/utils/cn.js';

/**
 * Carpool groups — self-organizing pools (a team, a neighborhood) that bias matching toward
 * fellow members. Lists every group with a member count + join/leave, and a create-group modal.
 */
export function GroupsPanel() {
  const groups = useApi(() => carpoolApi.listGroups(), []);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const ripple = useRipple();

  const toggle = async (g, e) => {
    // Capture where the tap happened before the async gap so a join can celebrate from the button.
    const r = e?.currentTarget?.getBoundingClientRect?.();
    setBusyId(g.id);
    try {
      if (g.isMember) {
        await carpoolApi.leaveGroup(g.id);
        toast.info(`Left ${g.name}`);
      } else {
        await carpoolApi.joinGroup(g.id);
        burstConfetti({
          x: r ? r.left + r.width / 2 : undefined,
          y: r ? r.top + r.height / 2 : undefined,
          colors: ['#3c79bc', '#4ade80', '#5a96d6', '#ffffff'],
          count: 60,
        });
        toast.success(`You're in — welcome to ${g.name} 🎉`);
      }
      groups.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const list = groups.data || [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Join a pool to get matched with your people first.</p>
        <Button size="sm" className="press ripple" onPointerDown={ripple} onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New group
        </Button>
      </div>

      {groups.loading && !list.length ? (
        <Spinner label="Loading groups…" />
      ) : groups.error ? (
        <ErrorState error={groups.error} onRetry={groups.refetch} title="Could not load groups" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No groups yet"
          description="Create the first pool — a team, a floor, a neighborhood — and invite people to join."
          action={
            <Button size="sm" className="press ripple" onPointerDown={ripple} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Create a group
            </Button>
          }
        />
      ) : (
        <div className="stagger grid gap-3 sm:grid-cols-2">
          {list.map((g) => (
            <div
              key={g.id}
              className={cn(
                'card group relative flex flex-col gap-3 overflow-hidden rounded-xl-increased p-4 transition-all duration-medium ease-emphasized',
                g.isMember && 'ring-1 ring-brand/30'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong transition-transform duration-medium ease-spring group-hover:scale-105">
                    <Users className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-title-md text-content">{g.name}</p>
                    <p className="text-xs text-muted">{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</p>
                  </div>
                </div>
                {g.isMember && <Badge tone="brand" dot>Joined</Badge>}
              </div>
              {g.description && <p className="text-sm text-muted line-clamp-2">{g.description}</p>}
              <div className="mt-auto">
                <Button
                  size="sm"
                  variant={g.isMember ? 'ghost' : 'secondary'}
                  className="press ripple w-full"
                  onPointerDown={ripple}
                  loading={busyId === g.id}
                  onClick={(e) => toggle(g, e)}
                >
                  {g.isMember ? <><LogOut className="h-4 w-4" /> Leave</> : <><LogIn className="h-4 w-4" /> Join</>}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => groups.refetch()} />
    </div>
  );
}

function CreateGroupModal({ open, onClose, onSaved }) {
  const ripple = useRipple();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const payload = { name: name.trim(), description: description.trim() || undefined };
    const parsed = createGroupSchema.safeParse(payload);
    if (!parsed.success) {
      const fe = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] ?? '_form';
        if (!fe[key]) fe[key] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setSubmitting(true);
    try {
      await carpoolApi.createGroup(parsed.data);
      toast.success('Group created 🎉');
      setName('');
      setDescription('');
      setErrors({});
      onSaved?.();
      onClose?.();
    } catch (err) {
      const e = normalizeError(err);
      setErrors((prev) => ({ ...prev, _form: e.message }));
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a group"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="press ripple" onPointerDown={ripple} onClick={submit} loading={submitting}>
            <Plus className="h-4 w-4" /> Create
          </Button>
        </div>
      }
    >
      <div className="stagger space-y-4">
        <Input
          label="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          placeholder="North Side Crew"
          maxLength={60}
        />
        <Textarea
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          placeholder="Who's this pool for?"
          maxLength={200}
        />
        {errors._form && <p className="field-error">{errors._form}</p>}
      </div>
    </Modal>
  );
}
