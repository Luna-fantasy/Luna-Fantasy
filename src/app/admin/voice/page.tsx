import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireMastermindApi } from '@/lib/admin/auth';
import PageHeader from '../_components/PageHeader';
import VoiceClient from './VoiceClient';
import type { VoiceSnapshot } from './types';

export const dynamic = 'force-dynamic';

async function fetchOracleConfig(cookieHeader: string): Promise<Record<string, any>> {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  try {
    const res = await fetch(`${base}/api/admin/config/oracle`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return {};
    return await res.json();
  } catch { return {}; }
}

export default async function VoicePage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  const cookieStore = cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
  const raw = await fetchOracleConfig(cookieHeader);

  const sections = raw.sections ?? raw;

  const initial: VoiceSnapshot = {
    setup: sections.setup ?? {
      hubChannels: [], vipCategoryId: '', logChannelId: '', staffRoleIds: [],
      maxTempRoomsPerUser: 1, maxVipRoomsPerUser: 1, gracePeriodMs: 10000,
      welcomeCooldownMs: 60000, challengesEnabled: true, challengeIntervalMs: 1800000,
      challengeMinMembers: 3, auraUpdateIntervalMs: 60000, panelAutoRefreshMs: 30000,
    },
    gamesTrivia: Array.isArray(sections.games_trivia) ? sections.games_trivia : [],
    gamesSowalef: Array.isArray(sections.games_sowalef) ? sections.games_sowalef : [],
    gamesSettings: sections.games_settings ?? {},
    content: {
      // All array fields coerced with Array.isArray so a legacy / malformed
      // Mongo value (object, string, number) doesn't slip past `?? []` and
      // blow up later when ContentPanel calls `.join('\n')`.
      welcomeGreetings: Array.isArray(sections.content_welcome) ? sections.content_welcome : [],
      panelText: Array.isArray(sections.content_panel) ? sections.content_panel : [],
      buttonLabels: sections.content_buttons && typeof sections.content_buttons === 'object' ? sections.content_buttons : {},
      auraTiers: sections.content_aura?.auraTiers,
      auraThresholds: sections.content_aura?.auraThresholds,
      auraWeights: sections.content_aura?.auraWeights,
      whisper: sections.content_whisper,
      expiryTitles: Array.isArray(sections.content_expiry) ? sections.content_expiry : [],
    },
    assets: sections.assets ?? {},
    music: {
      enabled: Boolean(sections.music?.enabled),
      tracks: Array.isArray(sections.music?.tracks) ? sections.music.tracks : [],
    },
  };

  return (
    <>
      <PageHeader
        title="Oracle"
        subtitle="Here you control the Oracle bot — hub channels, room games, aura tiers, content, live room management, and the MP3 music library."
      />
      <VoiceClient initial={initial} />
    </>
  );
}
