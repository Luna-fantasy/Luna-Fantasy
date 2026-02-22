/**
 * Discord role checking via bot token.
 * Server-side only — fetches guild member roles from Discord API.
 */

import {
  STAFF_ROLES,
  SPECIAL_ROLES,
  BOOSTER_ROLE_ID,
  VIP_DEPOSIT_ROLE_ID,
  GUILD_ID,
} from './bank-config';
import type { RoleClassification } from '@/types/bank';

// In-memory cache: discordId → { roles, expiresAt }
const roleCache = new Map<string, { roles: string[]; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch a user's guild roles from the Discord API.
 * Results are cached for 5 minutes per user.
 */
export async function getUserGuildRoles(discordId: string): Promise<string[]> {
  const cached = roleCache.get(discordId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.roles;
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.warn('[discord-roles] DISCORD_BOT_TOKEN not set, returning empty roles');
    return [];
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}`,
      {
        headers: { Authorization: `Bot ${token}` },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) {
      if (res.status === 404) {
        // User not in guild
        roleCache.set(discordId, { roles: [], expiresAt: Date.now() + CACHE_TTL_MS });
        return [];
      }
      console.error(`[discord-roles] Discord API ${res.status}: ${await res.text()}`);
      return [];
    }

    const member = await res.json();
    const roles: string[] = member.roles ?? [];

    roleCache.set(discordId, { roles, expiresAt: Date.now() + CACHE_TTL_MS });
    return roles;
  } catch (err) {
    console.error('[discord-roles] Failed to fetch guild member:', err);
    return [];
  }
}

/**
 * Classify a set of role IDs into staff/special/booster/VIP categories.
 */
export function classifyUserRoles(roleIds: string[]): RoleClassification {
  const roleSet = new Set(roleIds);

  let isStaff = false;
  let staffRoleName: string | undefined;
  for (const [id, name] of Object.entries(STAFF_ROLES)) {
    if (roleSet.has(id)) {
      isStaff = true;
      staffRoleName = name;
      break;
    }
  }

  let isSpecial = false;
  let specialRoleName: string | undefined;
  for (const [id, name] of Object.entries(SPECIAL_ROLES)) {
    if (roleSet.has(id)) {
      isSpecial = true;
      specialRoleName = name;
      break;
    }
  }

  return {
    isStaff,
    isSpecial,
    isBooster: roleSet.has(BOOSTER_ROLE_ID),
    isVip: roleSet.has(VIP_DEPOSIT_ROLE_ID),
    staffRoleName,
    specialRoleName,
    roleIds,
  };
}
