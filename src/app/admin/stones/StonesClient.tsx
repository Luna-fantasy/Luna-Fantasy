'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '../_components/Icon';
import ContextMenu from '../_components/ContextMenu';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import {
  STONE_TIERS, TIER_TONES,
  type StonesSnapshot, type StoneDef, type StoneTier,
} from '@/lib/admin/stones-v2-types';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  const data = await res.json();
  return data.token;
}

async function postStoneAction(body: Record<string, unknown>): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/stones/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

type Sort = 'owned' | 'name' | 'weight' | 'price';

export default function StonesClient({ snapshot }: { snapshot: StonesSnapshot }) {
  const router = useRouter();
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();

  const firstWithContent = STONE_TIERS.find((t) => (snapshot.byTier[t]?.length ?? 0) > 0) ?? 'regular';
  const [activeTier, setActiveTier] = useState<StoneTier>(firstWithContent);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('owned');
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; stone?: StoneDef } | null>(null);
  const [selected, setSelected] = useState<StoneDef | null>(null);

  const stones = useMemo(() => {
    const rows = [...(snapshot.byTier[activeTier] ?? [])];
    const query = q.trim().toLowerCase();
    let filtered = query ? rows.filter((s) => s.name.toLowerCase().includes(query)) : rows;
    return filtered.sort((a, b) => {
      if (sort === 'name')   return a.name.localeCompare(b.name);
      if (sort === 'weight') return b.weight - a.weight;
      if (sort === 'price')  return b.sellPrice - a.sellPrice;
      return b.copiesOwned - a.copiesOwned || a.name.localeCompare(b.name);
    });
  }, [snapshot, activeTier, q, sort]);

  const tone = TIER_TONES[activeTier];

  const requestDelete = async (stone: StoneDef) => {
    await pending.queue({
      label: `Delete ${stone.tier} stone: ${stone.name}`,
      detail: `${stone.copiesOwned.toLocaleString()} copies in player hands will remain.`,
      delayMs: 6000,
      tone: 'danger',
      run: async () => {
        try {
          await postStoneAction({ action: 'delete_stone', name: stone.name });
          undo.push({
            label: `Restore: ${stone.name}`,
            detail: stone.tier,
            revert: async () => {
              const restoreBody: Record<string, unknown> = {
                name: stone.name,
                weight: stone.weight,
                sell_price: stone.sellPrice,
                emoji_id: stone.emojiId ?? '',
                type: stone.tier,
              };
              if (stone.tier === 'forbidden') {
                // Cannot fully restore forbidden stones (need hint, gift_role, giver_title)
                toast.show({ tone: 'error', title: 'Cannot fully restore', message: 'Forbidden stones need hint+gift_role+giver_title — recreate manually.' });
                return;
              }
              await postStoneAction({ action: 'add_stone', stone: restoreBody });
              router.refresh();
              toast.show({ tone: 'success', title: 'Restored', message: stone.name });
            },
          });
          toast.show({ tone: 'success', title: 'Deleted', message: stone.name });
          router.refresh();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Delete failed', message: (e as Error).message });
        }
      },
    });
  };

  return (
    <div className="av-cards">
      {/* TIER TABS */}
      <nav className="av-cards-tabs" role="tablist">
        {STONE_TIERS.map((t) => {
          const count = snapshot.byTier[t]?.length ?? 0;
          const active = t === activeTier;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={count === 0}
              onClick={() => setActiveTier(t)}
              className={`av-cards-tab${active ? ' av-cards-tab--active' : ''}`}
              style={{ ['--rarity-tone' as any]: TIER_TONES[t] }}
            >
              <span className="av-cards-tab-dot" />
              <span className="av-cards-tab-name">{t}</span>
              <span className="av-cards-tab-count">{count}</span>
            </button>
          );
        })}
      </nav>

      <section className="av-surface av-cards-filters">
        <div className="av-users-filter-row">
          <div className="av-audit-search" style={{ flex: '1 1 240px' }}>
            <Icon name="search" size={14} />
            <input
              className="av-audit-input"
              placeholder={`Search ${activeTier} stones…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && <button type="button" className="av-audit-clear" onClick={() => setQ('')}>×</button>}
          </div>
          <select
            className="av-audit-input av-audit-input--sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            style={{ width: 200 }}
          >
            <option value="owned">Sort: Most owned</option>
            <option value="name">Sort: Name (A→Z)</option>
            <option value="weight">Sort: Drop weight</option>
            <option value="price">Sort: Sell price</option>
          </select>
          <span className="av-cards-count" style={{ ['--rarity-tone' as any]: tone }}>
            {stones.length} {stones.length === 1 ? 'stone' : 'stones'}
          </span>
          <button
            type="button"
            className="av-btn av-btn-primary av-cards-add"
            onClick={() => setEditor({ mode: 'create' })}
            style={{ ['--rarity-tone' as any]: tone }}
          >
            + New {activeTier} stone
          </button>
        </div>
      </section>

      <div className="av-cards-grid" style={{ ['--rarity-tone' as any]: tone }}>
        {stones.length === 0 && (
          <div className="av-flows-empty" style={{ gridColumn: '1 / -1' }}>
            {q ? 'No stones match this search.' : `No ${activeTier} stones yet.`}
          </div>
        )}
        {stones.map((s) => (
          <ContextMenu
            key={s.name}
            items={[
              { label: 'View holders', icon: '👥', run: () => setSelected(s) },
              { label: 'Edit', icon: '✎', run: () => setEditor({ mode: 'edit', stone: s }) },
              { label: 'Delete', icon: '×', tone: 'danger', run: () => requestDelete(s) },
              'separator' as const,
              { label: 'Copy name', icon: '⧉', run: () => navigator.clipboard?.writeText(s.name) },
              ...(s.imageUrl ? [{ label: 'Copy image URL', icon: '⧉', run: () => navigator.clipboard?.writeText(s.imageUrl!) }] : []),
            ]}
          >
            <button
              type="button"
              className="av-card-tile"
              onClick={() => setSelected(s)}
              style={{ ['--rarity-tone' as any]: TIER_TONES[s.tier] }}
            >
              <div className="av-card-tile-img">
                {s.imageUrl ? (
                  <img
                    src={s.imageUrl}
                    alt={s.name}
                    loading="lazy"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = 'none';
                      const parent = img.parentElement;
                      if (parent && !parent.querySelector('.av-card-tile-placeholder')) {
                        const ph = document.createElement('div');
                        ph.className = 'av-card-tile-placeholder';
                        ph.textContent = s.name.slice(0, 1);
                        parent.insertBefore(ph, img);
                      }
                    }}
                  />
                ) : (
                  <div className="av-card-tile-placeholder">{s.name.slice(0, 1)}</div>
                )}
                <span className="av-card-tile-rarity">{s.tier.toUpperCase()}</span>
              </div>
              <div className="av-card-tile-body">
                <div className="av-card-tile-name">{s.name}</div>
                <div className="av-card-tile-stats">
                  <span title="Drop weight">{s.dropPct.toFixed(s.dropPct < 1 ? 2 : 1)}%</span>
                  <span title="Sell price">{fmt(s.sellPrice)}</span>
                </div>
                <div className="av-card-tile-owned">
                  <span>{fmt(s.copiesOwned)} held</span>
                  <span>{fmt(s.ownerCount)} holders</span>
                </div>
              </div>
            </button>
          </ContextMenu>
        ))}
      </div>

      {selected && (
        <StoneDetailDrawer
          stone={selected}
          onClose={() => setSelected(null)}
          onEdit={(s) => { setSelected(null); setEditor({ mode: 'edit', stone: s }); }}
          onDelete={async (s) => { setSelected(null); await requestDelete(s); }}
        />
      )}

      {editor && (
        <StoneEditDialog
          mode={editor.mode}
          initialTier={activeTier}
          stone={editor.stone}
          onClose={() => setEditor(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

import StoneEditDialog from './StoneEditDialog';
import StoneDetailDrawer from './StoneDetailDrawer';
