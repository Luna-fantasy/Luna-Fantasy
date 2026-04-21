import { getBotConfigDoc } from '@/lib/admin/bot-configs';
import PageHeader from '../_components/PageHeader';
import GamesClient, { type DocSnapshot } from './GamesClient';

export const dynamic = 'force-dynamic';

const REQUIRED_DOCS = [
  'butler_games',
  'butler_baloot',
  'jester_game_settings',
  'jester_points_settings',
  'jester_commands',
] as const;

export default async function GamesPage() {
  const docs = await Promise.all(REQUIRED_DOCS.map((id) => getBotConfigDoc(id)));

  const snapshots: DocSnapshot[] = REQUIRED_DOCS.map((id, i) => {
    const doc = docs[i];
    return {
      id,
      data: doc?.data ?? {},
      updatedAt: doc?.updatedAt?.toISOString() ?? null,
      updatedBy: doc?.updatedBy ?? null,
    };
  });

  return (
    <>
      <PageHeader
        title="Games"
        subtitle="Here you tune every game — rewards, cooldowns, channels, and who can play. Every value is a button, no JSON."
      />
      <GamesClient docs={snapshots} />
    </>
  );
}
