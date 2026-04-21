import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import PageHeader from '../_components/PageHeader';
import WatchlistClient from './WatchlistClient';

export const dynamic = 'force-dynamic';

export default async function WatchlistPage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  return (
    <>
      <PageHeader
        title="User Watchlist"
        subtitle="Flag users for moderation — suspicious Lunari patterns, alt accounts, trade abuse, or any concern worth a second look. Notes and flags are audit-logged."
      />
      <WatchlistClient />
    </>
  );
}
