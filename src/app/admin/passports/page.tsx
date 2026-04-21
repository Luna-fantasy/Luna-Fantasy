import { Suspense } from 'react';
import { getPassportStats } from '@/lib/admin/passports';
import PageHeader from '../_components/PageHeader';
import Skeleton from '../_components/Skeleton';
import PassportsClient from './PassportsClient';
import PassportStatsCard from './PassportStatsCard';
import CosmeticsPanel from './CosmeticsPanel';

export const dynamic = 'force-dynamic';

async function StatsSection() {
  const stats = await getPassportStats();
  return <PassportStatsCard stats={stats} />;
}

export default function PassportsPage() {
  return (
    <>
      <PageHeader
        title="Passport Registry"
        subtitle="Here you browse every minted passport — filter by faction, by staff role, by status."
      />
      <Suspense fallback={<Skeleton variant="card" height={140} />}>
        <StatsSection />
      </Suspense>
      <CosmeticsPanel />
      <PassportsClient />
    </>
  );
}
