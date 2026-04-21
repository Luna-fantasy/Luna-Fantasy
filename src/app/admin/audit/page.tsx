import { getDistinctAuditActions, getAuditLog } from '@/lib/admin/audit';
import PageHeader from '../_components/PageHeader';
import AuditClient from './AuditClient';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const [actions, initial] = await Promise.all([
    getDistinctAuditActions(),
    getAuditLog({ page: 1, limit: 50 }),
  ]);

  const serializedInitial = {
    entries: initial.entries.map((e) => ({
      ...e,
      _id: String(e._id ?? ''),
      timestamp: (e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp)).toISOString(),
    })),
    total: initial.total,
  };

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Here you track every admin action — search, filter, and expand any row for the full before/after diff."
      />
      <AuditClient actions={actions} initial={serializedInitial} />
    </>
  );
}
