import { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import ProfileContent from './ProfileContent';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Profile — Luna',
};

export default async function ProfilePage() {
  const session = await auth();

  if (!session) {
    redirect('/auth/signin');
  }

  return <ProfileContent />;
}
