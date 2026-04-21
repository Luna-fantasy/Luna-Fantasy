import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import PageHeader from '../_components/PageHeader';
import ActivityClient from './ActivityClient';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Here you observe every action across Luna — filter by user, kind, or action, scroll back as far as you want, auto-refresh every 30s."
      />
      <ActivityClient />
    </>
  );
}
