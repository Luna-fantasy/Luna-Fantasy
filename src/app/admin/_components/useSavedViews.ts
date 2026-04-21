'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Saved views — generic localStorage-backed store of named filter snapshots
 * per page. Lightweight, synchronous, no server round-trip.
 */

export interface SavedView<T> {
  id: string;
  name: string;
  state: T;
  pinned: boolean;
  createdAt: number;
}

const STORAGE_PREFIX = 'av-saved-views:';

function load<T>(key: string): SavedView<T>[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function save<T>(key: string, views: SavedView<T>[]): void {
  try { window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(views)); } catch { /* ignore */ }
}

export function useSavedViews<T>(scope: string) {
  const [views, setViews] = useState<SavedView<T>[]>([]);

  useEffect(() => { setViews(load<T>(scope)); }, [scope]);

  const persist = useCallback((next: SavedView<T>[]) => {
    setViews(next);
    save(scope, next);
  }, [scope]);

  const add = useCallback((name: string, state: T) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const next = [...views, { id, name, state, pinned: false, createdAt: Date.now() }];
    persist(next);
    return id;
  }, [views, persist]);

  const remove = useCallback((id: string) => {
    persist(views.filter((v) => v.id !== id));
  }, [views, persist]);

  const rename = useCallback((id: string, name: string) => {
    persist(views.map((v) => v.id === id ? { ...v, name } : v));
  }, [views, persist]);

  const togglePinned = useCallback((id: string) => {
    persist(views.map((v) => v.id === id ? { ...v, pinned: !v.pinned } : v));
  }, [views, persist]);

  return { views, add, remove, rename, togglePinned };
}
