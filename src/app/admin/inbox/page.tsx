import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import { GUILD_ID } from '@/lib/bank/bank-config';
import { getInbox, getInboxCategories, getVotesRequired } from '@/lib/admin/inbox';
import PageHeader from '../_components/PageHeader';
import InboxClient from './InboxClient';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) {
    redirect('/admin');
  }
  const adminId = auth.session.user?.discordId ?? '';

  const [initial, categories, votesRequired] = await Promise.all([
    getInbox({ limit: 50 }),
    getInboxCategories(),
    getVotesRequired(),
  ]);

  return (
    <>
      <PageHeader
        title="Staff Inbox"
        subtitle="Here you manage tickets and applications — read transcripts, vote, and accept or reject with one click."
      />
      <InboxClient
        initial={initial}
        categories={categories}
        adminId={adminId}
        guildId={GUILD_ID}
        votesRequired={votesRequired}
      />
    </>
  );
}
