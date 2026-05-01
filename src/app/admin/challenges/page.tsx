import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import PageHeader from '../_components/PageHeader';
import ChallengesClient from './ChallengesClient';
import type { ChallengeConfig, ChannelOption, ChallengeTemplate, ListResponse } from './types';

export const dynamic = 'force-dynamic';

// Derive the absolute base URL from the incoming request's host header so
// SSR fetches always hit the same origin, regardless of NEXTAUTH_URL config.
// Falls back to NEXTAUTH_URL → localhost only when no Host is present (rare).
function buildBase(): string {
  try {
    const h = headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    const proto = h.get('x-forwarded-proto') ?? 'https';
    if (host) return `${proto}://${host}`;
  } catch { /* not in a request scope */ }
  return process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
}

// Network or parse errors should never crash the Server Component — return
// null so the page falls back to the hard-coded defaults below.
async function fetchJson<T>(base: string, path: string, cookieHeader: string): Promise<T | null> {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[ChallengesPage] fetch ${path} failed:`, (err as Error).message);
    return null;
  }
}

export default async function ChallengesPage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  const cookieStore = cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
  const base = buildBase();

  const [list, configWrap, channelsWrap, templatesWrap] = await Promise.all([
    fetchJson<ListResponse>(base, '/api/admin/challenges?page=1&limit=20', cookieHeader),
    fetchJson<{ config: ChallengeConfig }>(base, '/api/admin/challenges/config', cookieHeader),
    fetchJson<{ channels: ChannelOption[] }>(base, '/api/admin/challenges/channels', cookieHeader),
    fetchJson<{ templates: ChallengeTemplate[] }>(base, '/api/admin/challenges/templates', cookieHeader),
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
