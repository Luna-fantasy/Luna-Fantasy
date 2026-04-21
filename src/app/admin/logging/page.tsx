import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import { getBotConfigDoc } from '@/lib/admin/bot-configs';
import PageHeader from '../_components/PageHeader';
import LoggingClient, { type DocSnapshot } from './LoggingClient';

export const dynamic = 'force-dynamic';

const REQUIRED_DOCS = [
  'butler_channels',
  'butler_tickets',
  'butler_applications',
  'jester_channels',
  'oracle_vc_setup',
] as const;

export default async function LoggingPage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  const raw = await Promise.all(REQUIRED_DOCS.map((id) => getBotConfigDoc(id)));
  const docs: DocSnapshot[] = REQUIRED_DOCS.map((id, i) => ({
    id,
    data: raw[i]?.data ?? {},
  }));

  return (
    <>
      <PageHeader
        title="Logging"
        subtitle="Here you control where every bot event gets logged — pick the channel for each log type across all bots."
      />
      <LoggingClient docs={docs} />
    </>
  );
}
