import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import PageHeader from '../_components/PageHeader';
import DmClient from './DmClient';

export const dynamic = 'force-dynamic';

export default async function DmPage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  return (
    <>
      <PageHeader
        title="Direct Messages"
        subtitle="Here you send DMs to any user through Butler — plain text or rich embeds. Butler delivers queued messages within 30 seconds."
      />
      <DmClient />
    </>
  );
}
