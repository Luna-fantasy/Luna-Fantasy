import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import PageHeader from '../_components/PageHeader';
import AnnounceClient from './AnnounceClient';

export const dynamic = 'force-dynamic';

export default async function AnnouncePage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  // The channels/emojis fetch relies on the Discord bot token server-side.
  // Let the client fetch so the CSP + auth cookie flows cleanly; the page
  // stays Mastermind-gated at the route level.
  return (
    <>
      <PageHeader
        title="Announce"
        subtitle="Choose a bot and channel, then compose your announcement."
      />
      <AnnounceClient />
    </>
  );
}
