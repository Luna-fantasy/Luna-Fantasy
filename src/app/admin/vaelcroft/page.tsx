import { Suspense } from 'react';
import { getVaelcroftStats } from '@/lib/admin/vaelcroft';
import PageHeader from '../_components/PageHeader';
import Skeleton from '../_components/Skeleton';
import VaelcroftClient from './VaelcroftClient';
import VaelcroftStatsCard from './VaelcroftStatsCard';

export const dynamic = 'force-dynamic';

async function StatsSection() {
  const stats = await getVaelcroftStats();
  return <VaelcroftStatsCard stats={stats} />;
}

export default function VaelcroftPage() {
  return (
    <>
      <div className="av-maintenance-banner" role="status" aria-label="Under maintenance">
        <span className="av-maintenance-banner-icon" aria-hidden="true">⚠</span>
        <div>
          <strong>MAINTENANCE</strong>
          <span> — Vaelcroft is not fully done. Properties, items, and ownership controls below are wired but the in-game flows around them are still in progress. Expect rough edges.</span>
        </div>
      </div>
      <PageHeader
        title="Vaelcroft Family"
        subtitle="Manage properties, furniture, horses, swords — and the users who own them."
      />
      <Suspense fallback={<Skeleton variant="card" height={120} />}>
        <StatsSection />
      </Suspense>
      <VaelcroftClient />
    </>
  );
}
