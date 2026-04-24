import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import PageHeader from '../_components/PageHeader';
import WebsiteClient from './WebsiteClient';
import factionsJson from '../../../../data/factions.json';

export const dynamic = 'force-dynamic';

interface LocalizedString { en: string; ar: string }
interface FactionMeta { id: string; name: LocalizedString }

export default async function WebsitePage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  const factions = factionsJson as FactionMeta[];

  return (
    <>
      <PageHeader
        title="Website"
        subtitle="Open the live public site in edit mode, or edit character profiles directly — changes publish straight to lunarian.app."
      />
      <WebsiteClient factions={factions} />
    </>
  );
}
