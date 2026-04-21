import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import PageHeader from '../_components/PageHeader';
import ScheduleClient from './ScheduleClient';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle="Upcoming challenges, Seluna rotations, and chat events in one timeline. Next 30 days at a glance."
      />
      <ScheduleClient />
    </>
  );
}
