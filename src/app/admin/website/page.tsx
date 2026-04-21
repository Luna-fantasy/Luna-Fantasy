import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import PageHeader from '../_components/PageHeader';
import WebsiteClient from './WebsiteClient';

export const dynamic = 'force-dynamic';

export default async function WebsitePage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  return (
    <>
      <PageHeader
        title="Website"
        subtitle="Open the live public site in edit mode. Click any text to rewrite it inline, click any image to replace it, then save — changes publish straight to lunarian.app."
      />
      <WebsiteClient />
    </>
  );
}
