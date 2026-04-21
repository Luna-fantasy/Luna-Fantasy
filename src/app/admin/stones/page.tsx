import { getStonesSnapshot } from '@/lib/admin/stones-v2';
import PageHeader from '../_components/PageHeader';
import StatCard from '../_components/StatCard';
import StonesClient from './StonesClient';

export const dynamic = 'force-dynamic';

export default async function StonesPage() {
  const snap = await getStonesSnapshot();
  return (
    <>
      <PageHeader
        title="Stones"
        subtitle="Here you control stones — drop weights, sell prices, images, and who holds each relic."
      />

      <div className="av-stat-grid">
        <StatCard
          label="Stones Defined"
          icon="gem"
          tone="cyan"
          value={snap.totals.defined}
          hint="Distinct stones across regular + forbidden tiers."
        />
        <StatCard
          label="In Circulation"
          icon="trending"
          tone="purple"
          value={snap.totals.owned}
          copyable
          hint="Total stones owned across players."
        />
        <StatCard
          label="Active Holders"
          icon="users"
          tone="green"
          value={snap.totals.holders}
        />
        <StatCard
          label="Forbidden"
          icon="shield"
          tone="red"
          value={snap.totals.tierCounts.forbidden ?? 0}
          meta="Rarest of rare"
        />
      </div>

      <StonesClient snapshot={snap} />
    </>
  );
}
