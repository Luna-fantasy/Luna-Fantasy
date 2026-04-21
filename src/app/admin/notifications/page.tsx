import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import PageHeader from '../_components/PageHeader';
import NotificationsClient from './NotificationsClient';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Here you edit every message Butler sends to users — application acceptance DMs, passport issue, rejection, and more. Changes go live within ~30 seconds."
      />
      <NotificationsClient />
    </>
  );
}
