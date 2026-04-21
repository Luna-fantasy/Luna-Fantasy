'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * RecentlyViewed — localStorage-backed recent nav rail.
 * Each page calls trackRecent({ kind, id, label, href }) in an effect
 * to record that the admin visited it.
 */

export interface RecentItem {
  kind: 'user' | 'card' | 'stone' | 'ticket' | 'page';
  id: string;
  label: string;
  href: string;
  at: number;
}

const STORAGE_KEY = 'av-recent';
const MAX = 8;

export function trackRecent(item: Omit<RecentItem, 'at'>): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list: RecentItem[] = raw ? JSON.parse(raw) : [];
    const next = [
      { ...item, at: Date.now() },
      ...list.filter((x) => !(x.kind === item.kind && x.id === item.id)),
    ].slice(0, MAX);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('av-recent-changed'));
  } catch { /* ignore */ }
}

function read(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: RecentItem[] = JSON.parse(raw);
    // Migrate legacy /admin/v2/... paths stored before the v2→/admin promotion.
    let migrated = false;
    const out = parsed.map((item) => {
      if (item.href?.startsWith('/admin/v2/') || item.href === '/admin/v2') {
        migrated = true;
        return { ...item, href: item.href.replace(/^\/admin\/v2/, '/admin') };
      }
      return item;
    });
    if (migrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    }
    return out;
  } catch { return []; }
}

const KIND_GLYPH: Record<RecentItem['kind'], string> = {
  user: '◇',
  card: '◈',
  stone: '◆',
  ticket: '✉',
  page: '›',
};

function clearRecent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('av-recent-changed'));
  } catch { /* ignore */ }
}

export default function RecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    const refresh = () => setItems(read());
    refresh();
    window.addEventListener('av-recent-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('av-recent-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="av-recent">
      <div className="av-recent-label-row">
        <div className="av-cluster-label av-recent-label">Recent</div>
        <button
          type="button"
          className="av-recent-clear"
          onClick={clearRecent}
          title="Clear recently viewed"
          aria-label="Clear recently viewed"
        >
          ×
        </button>
      </div>
      <div className="av-recent-list">
        {items.map((it) => {
          const isActive = pathname === it.href;
          return (
            <Link
              key={`${it.kind}:${it.id}`}
              href={it.href}
              className={`av-recent-item${isActive ? ' av-recent-item--active' : ''}`}
              title={it.label}
            >
              <span className="av-recent-glyph" aria-hidden="true">{KIND_GLYPH[it.kind]}</span>
              <span className="av-recent-name">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
