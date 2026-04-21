import Link from 'next/link';
import PageHeader from '../../_components/PageHeader';
import UserDetailClient from './UserDetailClient';

export const dynamic = 'force-dynamic';

export default function UserDetailPage({ params }: { params: { discordId: string } }) {
  const discordId = String(params.discordId).replace(/[^0-9]/g, '').slice(0, 32);
  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Here you see their full profile, recent activity, and every admin action you can take on this player."
        actions={
          <Link href="/admin/users" className="av-btn av-btn-ghost">← All residents</Link>
        }
      />
      <UserDetailClient discordId={discordId} />
    </>
  );
}
