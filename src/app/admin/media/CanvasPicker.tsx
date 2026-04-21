'use client';

import { useMemo, useState } from 'react';
import type { CanvasTypeDef } from './types';

type Bot = 'butler' | 'jester';

interface Props {
  defs: CanvasTypeDef[];
  bot: Bot;
  canvasId: string;
  butlerCount: number;
  jesterCount: number;
  onBot: (bot: Bot) => void;
  onPick: (canvasId: string) => void;
  dirtyIds?: Set<string>;
}

interface Group {
  id: string;
  label: string;
  match: (def: CanvasTypeDef) => boolean;
}

// Category resolution. Runs against `defs` after bot filter is applied, so
// the same set of groups works for either bot — a group with zero matches
// is simply omitted from the render.
const GROUPS: Group[] = [
  { id: 'leaderboards', label: 'Leaderboards', match: (d) => d.id.includes('leaderboard') },
  { id: 'player_cards', label: 'Player Cards', match: (d) => ['rank_card', 'profile_card', 'level_up_card'].includes(d.id) },
  { id: 'passport_base', label: 'Passports · Base', match: (d) => d.id === 'passport' || d.id === 'passport_web' },
  { id: 'passport_vip', label: 'Passports · VIP', match: (d) => d.id.startsWith('passport_vip') },
  {
    id: 'passport_staff',
    label: 'Passports · Staff',
    match: (d) => /^passport_(guardian|sentinel|mastermind)/.test(d.id),
  },
  { id: 'games', label: 'Games', match: (d) => d.id === 'luna21_card' || d.id === 'winner_image' },
  { id: 'collections', label: 'Collections', match: (d) => d.id === 'book_image' || d.id === 'chest_image' },
];

export default function CanvasPicker({
  defs,
  bot,
  canvasId,
  butlerCount,
  jesterCount,
  onBot,
  onPick,
  dirtyIds,
}: Props) {
  const [filter, setFilter] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return defs;
    return defs.filter((d) => d.label.toLowerCase().includes(q) || d.id.toLowerCase().includes(q));
  }, [defs, filter]);

  const grouped = useMemo(() => {
    const result: { group: Group; items: CanvasTypeDef[] }[] = [];
    const assigned = new Set<string>();
    for (const g of GROUPS) {
      const items = filtered.filter((d) => g.match(d));
      items.forEach((i) => assigned.add(i.id));
      if (items.length > 0) result.push({ group: g, items });
    }
    const leftovers = filtered.filter((d) => !assigned.has(d.id));
    if (leftovers.length > 0) {
      result.push({ group: { id: 'other', label: 'Other', match: () => true }, items: leftovers });
    }
    return result;
  }, [filtered]);

  const isFiltering = filter.trim().length > 0;

  const isOpen = (groupId: string, hasActive: boolean): boolean => {
    if (isFiltering) return true;
    if (hasActive) return true;
    return openGroups[groupId] ?? false;
  };

  const toggleGroup = (groupId: string, currentOpen: boolean) => {
    setOpenGroups((s) => ({ ...s, [groupId]: !currentOpen }));
  };

  return (
    <aside className="av-canvas-picker" aria-label="Canvas picker">
      <div className="av-canvas-picker-botrow" role="tablist" aria-label="Bot">
        {(['butler', 'jester'] as const).map((b) => (
          <button
            key={b}
            type="button"
            role="tab"
            aria-selected={bot === b}
            className={`av-canvas-picker-bot${bot === b ? ' av-canvas-picker-bot--active' : ''}`}
            onClick={() => onBot(b)}
          >
            <span>{b === 'butler' ? '☾ Butler' : '◈ Jester'}</span>
            <span className="av-canvas-picker-count">{b === 'butler' ? butlerCount : jesterCount}</span>
          </button>
        ))}
      </div>

      <div className="av-canvas-picker-filter">
        <input
          type="search"
          placeholder="Filter canvases…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter canvases"
        />
      </div>

      <div className="av-canvas-picker-list">
        {grouped.length === 0 ? (
          <div className="av-canvas-picker-empty">No canvases match.</div>
        ) : grouped.map(({ group, items }) => {
          const hasActive = items.some((i) => i.id === canvasId);
          const open = isOpen(group.id, hasActive);
          return (
            <div key={group.id} className="av-canvas-picker-group" data-open={open}>
              <button
                type="button"
                className="av-canvas-picker-group-head"
                onClick={() => toggleGroup(group.id, open)}
                aria-expanded={open}
              >
                <span>{group.label}</span>
                <span className="av-canvas-picker-group-count">{items.length}</span>
              </button>
              {open && (
                <ul className="av-canvas-picker-items">
                  {items.map((item) => {
                    const active = item.id === canvasId;
                    const dirty = dirtyIds?.has(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-current={active ? 'true' : undefined}
                          className={`av-canvas-picker-item${active ? ' av-canvas-picker-item--active' : ''}`}
                          onClick={() => onPick(item.id)}
                          title={item.label}
                        >
                          <span className="av-canvas-picker-item-label">{item.label}</span>
                          {dirty && <span className="av-canvas-picker-item-dot" aria-label="Unsaved" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
