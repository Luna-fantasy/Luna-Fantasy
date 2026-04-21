import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import PageHeader from '../_components/PageHeader';
import AnalyticsClient from './AnalyticsClient';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Deep insights into your economy, games, community activity, collections, and shop performance — all in one place."
      />
      <AnalyticsClient />
    </>
  );
}
