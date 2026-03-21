'use client';

import { useState, useEffect, useCallback } from 'react';

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
}

// Module-level cache — shared across all components on the same page
let cached: GuildData | null = null;
let inflight: Promise<GuildData> | null = null;

async function doFetch(): Promise<GuildData> {
  const res = await fetch('/api/admin/discord/guild');
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function useGuildData() {
  const [data, setData] = useState<GuildData | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    if (!inflight) {
      inflight = doFetch();
    }

    let cancelled = false;
    inflight
      .then((result) => {
        cached = result;
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      })
      .finally(() => {
        inflight = null;
      });

    return () => { cancelled = true; };
  }, [retryKey]);

  const retry = useCallback(() => {
    cached = null;
    inflight = null;
    setRetryKey((k) => k + 1);
  }, []);

  return {
    roles: data?.roles ?? [],
    channels: data?.channels ?? [],
    emojis: data?.emojis ?? [],
    loading,
    error,
    retry,
  };
}
