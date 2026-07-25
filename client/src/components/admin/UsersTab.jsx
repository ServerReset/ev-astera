import { useEffect, useMemo, useState } from 'react';
import { Users, Search, Plus, KeyRound, Copy, Check } from 'lucide-react';
import { Button } from '@/components/common/Button.jsx';
import { Input, Select } from '@/components/common/Input.jsx';
import { Switch } from '@/components/common/Switch.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { Spinner, ErrorState, EmptyState } from '@/components/common/States.jsx';
import { AdminTable, AdminRow, Td, Pager } from './adminShared.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { adminApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { useAuthStore } from '@/stores/authStore.js';
import { ROLES, PAGE_SIZE } from '@/utils/constants.js';
import { formatDate } from '@/utils/time.js';

const ROLE_LABEL = { [ROLES.USER]: 'Member', [ROLES.SITE_ADMIN]: 'Site admin', [ROLES.SUPER_ADMIN]: 'Super admin' };

/** Users admin: paginated + searchable roster, inline role/active edits, reset password, create. */
export function UsersTab() {
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [tempPw, setTempPw] = useState(null);
  const ripple = useRipple();

  // Debounce the search box so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const users = useApi(() => adminApi.listUsers(page, search), [page, search]);
  const items = users.data?.items || [];

  const roleOptions = useMemo(() => {
    const opts = [
      { value: ROLES.USER, label: ROLE_LABEL[ROLES.USER] },
      { value: ROLES.SITE_ADMIN, label: ROLE_LABEL[ROLES.SITE_ADMIN] },
    ];
    if (isSuperAdmin) opts.push({ value: ROLES.SUPER_ADMIN, label: ROLE_LABEL[ROLES.SUPER_ADMIN] });
    return opts;
  }, [isSuperAdmin]);

  const patchUser = async (u, patch) => {
    try {
      await adminApi.updateUser(u.id, patch);
      toast.success('Member updated');
      users.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
      users.refetch();
    }
  };

  const resetPassword = async (u) => {
    try {
      const { tempPassword } = await adminApi.resetUserPassword(u.id);
      setTempPw({ user: u, password: tempPassword });
    } catch (err) {
      toast.error(normalizeError(err).message);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            className="input pl-9"
            placeholder="Search members…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search members"
          />
        </div>
        <Button size="sm" className="ripple press hover-sheen" onPointerDown={ripple} onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add member
        </Button>
      </div>

      {users.loading && !items.length ? (
        <Spinner label="Loading members…" />
      ) : users.error ? (
        <ErrorState error={users.error} onRetry={users.refetch} title="Could not load members" />
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title={search ? 'No members match' : 'No members yet'} description={search ? 'Try a different search.' : 'Members appear here once they sign up.'} />
      ) : (
        <>
          <div className="card-solid rounded-xl-increased p-2">
            <AdminTable head={['Member', 'Role', 'Active', 'Credits', 'Joined', { label: 'Actions', right: true }]}>
              {items.map((u) => (
                <AdminRow key={u.id}>
                  <Td>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-content">{u.displayName}</p>
                      <p className="truncate text-xs text-faint">{u.email}</p>
                    </div>
                  </Td>
                  <Td>
                    <div className="w-36">
                      <Select
                        value={u.role}
                        options={roleOptions}
                        onChange={(e) => patchUser(u, { role: e.target.value })}
                        disabled={u.role === ROLES.SUPER_ADMIN && !isSuperAdmin}
                      />
                    </div>
                  </Td>
                  <Td>
                    <Switch checked={u.active} onChange={(v) => patchUser(u, { active: v })} label={`Toggle active for ${u.displayName}`} />
                  </Td>
                  <Td><span className="tabular-nums text-content">{u.carpoolCredits ?? 0}</span></Td>
                  <Td><span className="text-muted">{formatDate(u.createdAt)}</span></Td>
                  <Td right>
                    <Button size="sm" variant="ghost" className="ripple press" onPointerDown={ripple} onClick={() => resetPassword(u)}>
                      <KeyRound className="h-4 w-4" /> Reset
                    </Button>
                  </Td>
                </AdminRow>
              ))}
            </AdminTable>
          </div>
          <Pager page={users.data?.page || page} total={users.data?.total || 0} pageSize={PAGE_SIZE} onPage={setPage} />
        </>
      )}

      <CreateUserModal open={createOpen} roleOptions={roleOptions} onClose={() => setCreateOpen(false)} onCreated={(pw) => { setCreateOpen(false); users.refetch(); if (pw) setTempPw(pw); }} />
      <TempPasswordModal data={tempPw} onClose={() => setTempPw(null)} />
    </div>
  );
}

function CreateUserModal({ open, roleOptions, onClose, onCreated }) {
  const [form, setForm] = useState({ displayName: '', email: '', password: '', role: ROLES.USER });
  const [saving, setSaving] = useState(false);
  const ripple = useRipple();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setSaving(true);
    try {
      await adminApi.createUser({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      toast.success('Member created');
      // Surface the password the admin just chose so they can hand it over immediately.
      onCreated({ user: { displayName: form.displayName.trim(), email: form.email.trim() }, password: form.password });
      setForm({ displayName: '', email: '', password: '', role: ROLES.USER });
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
      title="Add member"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="ripple press" onPointerDown={ripple} loading={saving} onClick={submit}>Create member</Button>
        </div>
      }
    >
      <div className="grid gap-3">
        <Input label="Display name" value={form.displayName} onChange={set('displayName')} placeholder="Jane Rivera" />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="jane@asteralabs.com" hint="Must be an @asteralabs.com address." />
        <Input label="Temporary password" type="password" value={form.password} onChange={set('password')} hint="8+ chars with upper, lower, number & symbol. Share it with the member." />
        <Select label="Role" value={form.role} options={roleOptions} onChange={set('role')} />
      </div>
    </Modal>
  );
}

/** Shows a freshly-generated / freshly-set temp password once, with a copy button. */
function TempPasswordModal({ data, onClose }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setCopied(false);
  }, [data]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.info('Copy failed — select and copy manually.');
    }
  };
  return (
    <Modal
      open={Boolean(data)}
      onClose={onClose}
      title="Temporary password"
      size="sm"
      footer={<div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>}
    >
      <p className="text-sm text-muted">
        Share this with <span className="font-medium text-content">{data?.user?.displayName}</span>. They'll be prompted to sign in with it — it won't be shown again.
      </p>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-bg-elevated p-3">
        <code className="select-all font-mono text-lg text-content">{data?.password}</code>
        <button
          onClick={copy}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-content active:scale-90"
          aria-label="Copy password"
        >
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </Modal>
  );
}
