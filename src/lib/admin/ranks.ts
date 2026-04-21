/**
 * Luna ecosystem rank system — maps Discord guild role IDs to the citizen/
 * staff tier hierarchy (lowest → highest):
 *
 *   Lunarian → La Luna → Luna Chosen → Trickster → Healer → Wizard →
 *   Knight → Guardian → Sentinel → Mastermind
 *
 * Each rank has a tone for UI accents. "Lunarian" is the implicit default
 * (no rank role assigned). "La Luna" role ID is not yet wired — set
 * LA_LUNA_ROLE_ID below when that role is created in Discord, and it lights up.
 */

import { getUserGuildRoles } from '@/lib/bank/discord-roles';

export type RankId =
  | 'lunarian' | 'la-luna' | 'luna-chosen' | 'trickster'
  | 'healer' | 'wizard' | 'knight' | 'guardian'
  | 'sentinel' | 'mastermind';

export interface Rank {
  id: RankId;
  title: string;
  /** Tier ordering — higher = more senior. Used for picking the user's highest. */
  tier: number;
  /** Primary accent color for cards/borders. */
  tone: string;
  /** Secondary accent for dual-color ranks (Luna Chosen, Mastermind). null = use tone only. */
  tone2: string | null;
  /** Short glyph for use in compact badges. */
  glyph: string;
}

export const RANKS: Record<RankId, Rank> = {
  lunarian:    { id: 'lunarian',    title: 'Lunarian',    tier: 1,  tone: '#3b82f6', tone2: null,      glyph: '☾' },
  'la-luna':   { id: 'la-luna',     title: 'La Luna',     tier: 2,  tone: '#06b6d4', tone2: null,      glyph: '◐' },
  'luna-chosen': { id: 'luna-chosen', title: 'Luna Chosen', tier: 3,  tone: '#3b82f6', tone2: '#22c55e', glyph: '✵' },
  trickster:   { id: 'trickster',   title: 'Trickster',   tier: 4,  tone: '#ec4899', tone2: null,      glyph: '✦' },
  healer:      { id: 'healer',      title: 'Healer',      tier: 5,  tone: '#22c55e', tone2: null,      glyph: '✚' },
  wizard:      { id: 'wizard',      title: 'Wizard',      tier: 6,  tone: '#7c3aed', tone2: null,      glyph: '✧' },
  knight:      { id: 'knight',      title: 'Knight',      tier: 7,  tone: '#1e3a8a', tone2: null,      glyph: '▲' },
  guardian:    { id: 'guardian',    title: 'Guardian',    tier: 8,  tone: '#60a5fa', tone2: null,      glyph: '■' },
  sentinel:    { id: 'sentinel',    title: 'Sentinel',    tier: 9,  tone: '#fbbf24', tone2: null,      glyph: '⚔' },
  mastermind:  { id: 'mastermind',  title: 'Mastermind',  tier: 10, tone: '#a855f7', tone2: '#fbbf24', glyph: '◈' },
};

// Role IDs already registered in Luna guild.
// (Lunarian is implicit — anyone without a recognized role role.)
const ROLE_TO_RANK: Record<string, RankId> = {
  '1416510580038041621': 'mastermind',
  '1416555884141613126': 'sentinel',
  '1416556873758277826': 'guardian',
  '1416546769474682951': 'knight',
  '1417164354058719303': 'wizard',
  '1418318823592820836': 'healer',
  '1427759046697422859': 'trickster',
  '1458898769343942798': 'luna-chosen',
};

/** Placeholder — fill in when La Luna role exists in Discord. */
// export const LA_LUNA_ROLE_ID = 'XXXXXXXXXXXXXXXXXX';
// if (LA_LUNA_ROLE_ID) ROLE_TO_RANK[LA_LUNA_ROLE_ID] = 'la-luna';

/**
 * Fetch user's Discord roles and return their highest-tier rank.
 * Returns the Lunarian rank by default (never null).
 * Uses the existing 5-min getUserGuildRoles cache.
 */
export async function getUserRank(discordId: string): Promise<Rank> {
  try {
    const roleIds = await getUserGuildRoles(discordId);
    let best: Rank = RANKS.lunarian;
    for (const id of roleIds) {
      const rankId = ROLE_TO_RANK[id];
      if (!rankId) continue;
      const rank = RANKS[rankId];
      if (rank.tier > best.tier) best = rank;
    }
    return best;
  } catch {
    return RANKS.lunarian;
  }
}

/**
 * Resolve ranks for many users in parallel.
 * Each still hits the getUserGuildRoles cache, so hot users are instant.
 */
export async function getUserRanksBulk(discordIds: string[]): Promise<Map<string, Rank>> {
  const results = await Promise.all(discordIds.map(async (id) => [id, await getUserRank(id)] as const));
  return new Map(results);
}
