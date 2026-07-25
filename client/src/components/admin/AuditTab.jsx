import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Spinner, ErrorState, EmptyState } from '@/components/common/States.jsx';
import { AdminTable, AdminRow, Td, Pager } from './adminShared.jsx';
import { useApi } from '@/hooks/useApi.js';
import { adminApi } from '@/services/endpoints.js';
import { PAGE_SIZE } from '@/utils/constants.js';
import { formatDateTime, relativeTime } from '@/utils/time.js';

/** Audit log: paginated activity feed of admin/system actions. */
export function AuditTab() {
  const [page, setPage] = useState(1);
  const audit = useApi(() => adminApi.audit(page), [page]);
  const items = audit.data?.items || [];

  if (audit.loading && !items.length) return <Spinner label="Loading audit log…" />;
  if (audit.error) return <ErrorState error={audit.error} onRetry={audit.refetch} title="Could not load audit log" />;
  if (!items.length) return <EmptyState icon={ScrollText} title="No activity yet" description="Admin and system actions will be logged here." />;

  return (
    <div>
      <div className="card-solid rounded-xl-increased p-2">
        <AdminTable head={['Action', 'Details', 'When']}>
          {items.map((row) => (
            <AdminRow key={row.id}>
              <Td>
                <span className="rounded-full bg-surface-2 px-2.5 py-1 font-mono text-xs text-content">{row.action}</span>
              </Td>
              <Td>
                <span className="text-muted">{formatDetails(row.details)}</span>
              </Td>
              <Td>
                <span className="text-content" title={formatDateTime(row.created_at)}>{relativeTime(row.created_at)}</span>
              </Td>
            </AdminRow>
          ))}
        </AdminTable>
      </div>
      <Pager page={audit.data?.page || page} total={audit.data?.total || 0} pageSize={PAGE_SIZE} onPage={setPage} />
    </div>
  );
}

/** Details is a jsonb blob — render it compactly rather than dumping raw JSON. */
function formatDetails(details) {
  if (!details) return '—';
  if (typeof details === 'string') return details;
  try {
    const entries = Object.entries(details);
    if (!entries.length) return '—';
    return entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');
  } catch {
    return '—';
  }
}
