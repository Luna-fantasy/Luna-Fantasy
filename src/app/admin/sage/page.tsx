import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import { getBotConfigDoc } from '@/lib/admin/bot-configs';
import PageHeader from '../_components/PageHeader';
import SageClient from './SageClient';
import type { SageSnapshot } from './types';

export const dynamic = 'force-dynamic';

const LIVE_CHAT_DEFAULTS = {
  autoJoinEnabled: true,
  reactionsEnabled: true,
  periodicCheckIn: true,
  mastermindOnly: false,
  liveChatChannels: [] as string[],
  reactionProbability: 0.3,
  autoJoinCooldownMinutes: 1,
  checkInInterval: 20,
  aiCooldownSeconds: 8,
  reactionCooldownSeconds: 30,
  userReactionLimit: 3,
  userReactionWindowMinutes: 5,
  userHelpOfferCooldownMinutes: 2,
  userGreetingCooldownMinutes: 5,
  greetingCooldownSeconds: 60,
  helpOfferCooldownSeconds: 30,
  unansweredQuestionDelaySeconds: 60,
  lunaKeywords: [],
  helpOfferTemplates: { mastermind: [], privileged: [], lunarian: [], default: [] },
  greetingTemplates: { arabic: [], english: [] },
  reactionEmojis: { luna: '🌙', question: '🤔', greeting: '👋', excitement: '🔥' },
  channelReferences: [],
};

export default async function SagePage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  const [settings, promptDoc, loreDoc, privileges, liveChat] = await Promise.all([
    getBotConfigDoc('sage_settings'),
    getBotConfigDoc('sage_system_prompt'),
    getBotConfigDoc('sage_lore'),
    getBotConfigDoc('sage_privileges'),
    getBotConfigDoc('sage_live_chat'),
  ]);

  const initial: SageSnapshot = {
    settings: (settings?.data ?? {}),
    systemPrompt: (promptDoc?.data?.prompt ?? '') as string,
    lore: (loreDoc?.data?.text ?? '') as string,
    privileges: {
      lunarianAccess: Boolean(privileges?.data?.lunarianAccess),
      lunarianRoleId: String(privileges?.data?.lunarianRoleId ?? ''),
      privilegedRoles: Array.isArray(privileges?.data?.privilegedRoles) ? privileges!.data.privilegedRoles : [],
      allKnownRoles:   Array.isArray(privileges?.data?.allKnownRoles)   ? privileges!.data.allKnownRoles   : [],
    },
    liveChat: { ...LIVE_CHAT_DEFAULTS, ...(liveChat?.data ?? {}) } as SageSnapshot['liveChat'],
  };

  return (
    <>
      <PageHeader
        title="Sage"
        subtitle="Here you control Sage — its AI provider, persona, knowledge, who can use it, and how it behaves in live chat."
      />
      <SageClient initial={initial} />
    </>
  );
}
