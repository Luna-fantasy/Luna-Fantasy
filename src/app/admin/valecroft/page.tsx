import { Suspense } from 'react';
import { getValecroftStats } from '@/lib/admin/valecroft';
import PageHeader from '../_components/PageHeader';
import Skeleton from '../_components/Skeleton';
import ValecroftClient from './ValecroftClient';
import ValecroftStatsCard from './ValecroftStatsCard';

export const dynamic = 'force-dynamic';

async function StatsSection() {
  const stats = await getValecroftStats();
  return <ValecroftStatsCard stats={stats} />;
}

export default function ValecroftPage() {
  return (
    <>
      <div className="av-maintenance-banner" role="status" aria-label="Under maintenance">
        <span className="av-maintenance-banner-icon" aria-hidden="true">⚠</span>
        <div>
          <strong>MAINTENANCE</strong>
          <span> — Valecroft is not fully done. Properties, items, and ownership controls below are wired but the in-game flows around them are still in progress. Expect rough edges.</span>
        </div>
      </div>
      <PageHeader
        title="Valecroft Family"
        subtitle="Manage properties, artifacts, horses, swords — and the users who own them."
      />
      <Suspense fallback={<Skeleton variant="card" height={120} />}>
        <StatsSection />
      </Suspense>
      <ValecroftClient />
    </>
  );
}
