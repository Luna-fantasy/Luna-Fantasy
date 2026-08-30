import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import PageHeader from '../_components/PageHeader';
import ApplicationPanelsClient from './ApplicationPanelsClient';

export const dynamic = 'force-dynamic';

export default async function ApplicationsPage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  return (
    <>
      <PageHeader
        title="Applications"
        subtitle="Control the Knight and Wizard recruitment panels Butler posts in Discord — swap the artwork, edit the text, and open or close submissions. Saved changes update the posted panel within ~20 seconds."
      />
      <ApplicationPanelsClient />
    </>
  );
}
