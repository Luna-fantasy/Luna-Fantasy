'use client';

import { useState, useEffect } from 'react';
import type { GameDataResponse } from '@/types/gameData';

export function useGameData() {
  const [data, setData] = useState<GameDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchGameData() {
      try {
        const res = await fetch('/api/profile/game-data');
        if (!res.ok) throw new Error('Failed to load game data');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchGameData();
    return () => { cancelled = true; };
  }, []);

  return { data, isLoading, error };
}
