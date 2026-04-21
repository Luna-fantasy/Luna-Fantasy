'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface GuildRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export interface GuildChannel {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
  parentName: string;
  position: number;
}

export interface GuildEmoji {
  id: string;
  name: string;
  animated: boolean;
}

interface GuildData {
  roles: GuildRole[];
  channels: GuildChannel[];
  emojis: GuildEmoji[];
  loading: boolean;
  error: string | null;
}

const GuildDataContext = createContext<GuildData>({
  roles: [], channels: [], emojis: [], loading: true, error: null,
});

type GuildCache = { roles: GuildRole[]; channels: GuildChannel[]; emojis: GuildEmoji[] };

const CACHE_TTL = 5 * 60 * 1000;
let cached: GuildCache | null = null;
let cachedAt = 0;
let inflight: Promise<GuildCache> | null = null;

async function fetchGuild(force = false): Promise<GuildCache | null> {
  if (cached && !force && Date.now() - cachedAt < CACHE_TTL) return cached;
  if (inflight) return inflight;

  inflight = fetch('/api/admin/discord/guild', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      cached = {
        roles: body.roles ?? [],
        channels: body.channels ?? [],
        emojis: body.emojis ?? [],
      };
      cachedAt = Date.now();
      return cached;
    })
    .finally(() => { inflight = null; });

  return inflight;
}

export function GuildDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GuildData>({
    roles: cached?.roles ?? [],
    channels: cached?.channels ?? [],
    emojis: cached?.emojis ?? [],
    loading: !cached,
    error: null,
  });

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    fetchGuild()
      .then((d) => {
        if (!cancelled && d) setData({ ...d, loading: false, error: null });
      })
      .catch((e) => {
        if (!cancelled) setData((prev) => ({ ...prev, loading: false, error: (e as Error).message }));
      });
    return () => { cancelled = true; };
  }, []);

  return <GuildDataContext.Provider value={data}>{children}</GuildDataContext.Provider>;
}

export function useGuild() {
  return useContext(GuildDataContext);
}
