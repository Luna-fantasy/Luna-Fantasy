import { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import ProfileContent from './ProfileContent';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Profile — Luna',
};

type ProfileProps = { params: Promise<{locale:string}>; searchParams: Promise<{discordId?:string}> };

export default async function ProfilePage({ params, searchParams }: ProfileProps) {
  const { discordId } = await searchParams;

  // Public profile — no auth needed
  if (discordId) {
    return <ProfileContent key={discordId} viewingDiscordId={discordId} />;
  }

  // Own profile — requires auth
  const session = await auth();
  if (!session) {
    const {locale} = await params;
    redirect('/' + locale + '/auth/signin/?' + new URLSearchParams({ callbackUrl: '/' + locale + '/profile/' }));
  }

  return <ProfileContent />;
}
