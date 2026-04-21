import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import PageHeader from '../_components/PageHeader';
import ChallengesClient from './ChallengesClient';
import type { ChallengeConfig, ChannelOption, ChallengeTemplate, ListResponse } from './types';

export const dynamic = 'force-dynamic';

async function fetchJson<T>(path: string, cookieHeader: string): Promise<T | null> {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const res = await fetch(`${base}${path}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function ChallengesPage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  const cookieStore = cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');

  const [list, configWrap, channelsWrap, templatesWrap] = await Promise.all([
    fetchJson<ListResponse>('/api/admin/challenges?page=1&limit=20', cookieHeader),
    fetchJson<{ config: ChallengeConfig }>('/api/admin/challenges/config', cookieHeader),
    fetchJson<{ channels: ChannelOption[] }>('/api/admin/challenges/channels', cookieHeader),
    fetchJson<{ templates: ChallengeTemplate[] }>('/api/admin/challenges/templates', cookieHeader),
  ]);

  const fallbackList: ListResponse = {
    activeChallenge: null,
    challenges: [],
    total: 0,
    page: 1,
    limit: 20,
    stats: { total: 0, active: 0, closed: 0, cancelled: 0, totalEntries: 0, totalVotes: 0 },
    hallOfFame: [],
  };

  const fallbackConfig: ChallengeConfig = {
    hallOfFameChannelId: null,
    minJoinAgeMs: 3600_000,
    minAccountAgeMs: 604800_000,
    suspiciousVoteThreshold: 3,
    maxGuildVotesPerSec: 10,
    cmdCooldownMs: 5000,
    voteChangeWindowMs: 120_000,
    updateIntervalMs: 30_000,
    maxTopEntriesShown: 5,
  };

  return (
    <>
      <PageHeader
        title="Challenges"
        subtitle="Here you run community challenges — create competitions, track votes, close with rewards, and tune anti-alt rules."
      />
      <ChallengesClient
        initial={list ?? fallbackList}
        config={configWrap?.config ?? fallbackConfig}
        channels={channelsWrap?.channels ?? []}
        templates={templatesWrap?.templates ?? []}
      />
    </>
  );
}
