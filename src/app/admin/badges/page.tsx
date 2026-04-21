import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import PageHeader from '../_components/PageHeader';
import BadgesClient from './BadgesClient';

export const dynamic = 'force-dynamic';

export default async function BadgesPage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  return (
    <>
      <PageHeader
        title="Badges"
        subtitle="Here you control the 10 achievement badges — adjust the thresholds for auto-awarded badges (Lunari, messages, voice hours, game wins, La Luna level) and see how many users have earned each one."
      />
      <BadgesClient />
    </>
  );
}
