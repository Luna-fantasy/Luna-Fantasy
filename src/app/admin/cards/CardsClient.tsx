'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '../_components/Icon';
import ContextMenu from '../_components/ContextMenu';
import {
  BulkSelectProvider,
  BulkCheckbox,
  BulkSelectAll,
  BulkActionBar,
  useBulkSelect,
  type BulkAction,
} from '../_components/BulkSelect';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import type { CardsSnapshot, CardDef, Rarity } from '@/lib/admin/cards-v2-types';
import { RARITY_ORDER, RARITY_TONES } from '@/lib/admin/cards-v2-types';
import CardDetailDrawer from './CardDetailDrawer';
import CardEditDialog, { deleteCard, reAddCard } from './CardEditDialog';
import FactionWarView from './FactionWarView';

const TAB_FACTION_WAR = 'FACTION_WAR' as const;
type TabKey = Rarity | typeof TAB_FACTION_WAR;

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

type Sort = 'owned' | 'name' | 'weight' | 'attack';

export default function CardsClient({ snapshot }: { snapshot: CardsSnapshot }) {
  const firstWithContent = RARITY_ORDER.find((r) => (snapshot.byRarity[r]?.length ?? 0) > 0) ?? 'COMMON';
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>(firstWithContent);
  const isFactionWar = activeTab === TAB_FACTION_WAR;
  const activeRarity = isFactionWar ? firstWithContent : (activeTab as Rarity);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('attack');
  const [selected, setSelected] = useState<CardDef | null>(null);
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; card?: CardDef } | null>(null);

  const refreshSnapshot = () => router.refresh();

  const cards = useMemo<CardDef[]>(() => {
    const rows = [...(snapshot.byRarity[activeRarity] ?? [])];
    const query = q.trim().toLowerCase();
    let filtered = query
      ? rows.filter((c) => c.name.toLowerCase().includes(query))
      : rows;
    filtered = filtered.sort((a, b) => {
      if (sort === 'name')   return a.name.localeCompare(b.name);
      if (sort === 'weight') return b.weight - a.weight;
      if (sort === 'attack') return b.attack - a.attack;
      return b.copiesOwned - a.copiesOwned || a.name.localeCompare(b.name);
    });
    return filtered;
  }, [snapshot, activeRarity, q, sort]);

  const tone = RARITY_TONES[activeRarity];

  const lunaFantasyTotal = RARITY_ORDER.reduce((s, r) => s + (snapshot.byRarity[r]?.length ?? 0), 0);

  const bulkIds = useMemo(() => cards.map((c) => c.name), [cards]);

  return (
    <BulkSelectProvider ids={bulkIds}>
    <div className="av-cards">
      {/* TOP-LEVEL CATALOG SWITCH — two distinct card decks */}
      <nav className="av-cards-catalog" role="tablist" aria-label="Card catalog">
        <button
          type="button"
          role="tab"
          aria-selected={!isFactionWar}
          onClick={() => setActiveTab(firstWithContent)}
          className={`av-cards-catalog-tab${!isFactionWar ? ' av-cards-catalog-tab--active' : ''}`}
        >
          <div className="av-cards-catalog-glyph">🃏</div>
          <div className="av-cards-catalog-text">
            <strong>Luna Fantasy</strong>
            <span>Gacha deck · 7 rarities · {lunaFantasyTotal} cards</span>
          </div>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isFactionWar}
          onClick={() => setActiveTab(TAB_FACTION_WAR)}
          className={`av-cards-catalog-tab av-cards-catalog-tab--faction${isFactionWar ? ' av-cards-catalog-tab--active' : ''}`}
        >
          <div className="av-cards-catalog-glyph">⚔</div>
          <div className="av-cards-catalog-text">
            <strong>Faction War</strong>
            <span>Team deck · 11 factions · used by Jester's Faction War game</span>
          </div>
        </button>
      </nav>

      {isFactionWar && <FactionWarView />}

      {!isFactionWar && (<>
      {/* RARITY TABS (only shown for Luna Fantasy deck) */}
      <nav className="av-cards-tabs" role="tablist">
        {RARITY_ORDER.map((r) => {
          const count = snapshot.byRarity[r]?.length ?? 0;
          const active = activeTab === r;
          return (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={count === 0}
              onClick={() => setActiveTab(r)}
              className={`av-cards-tab${active ? ' av-cards-tab--active' : ''}`}
              style={{ ['--rarity-tone' as any]: RARITY_TONES[r] }}
            >
              <span className="av-cards-tab-dot" />
              <span className="av-cards-tab-name">{r}</span>
              <span className="av-cards-tab-count">{count}</span>
            </button>
          );
        })}
      </nav>

      {/* FILTER ROW */}
      <section className="av-surface av-cards-filters">
        <div className="av-users-filter-row">
          <div className="av-audit-search" style={{ flex: '1 1 240px' }}>
            <Icon name="search" size={14} />
            <input
              className="av-audit-input"
              placeholder={`Search ${activeRarity.toLowerCase()} cards…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && <button type="button" className="av-audit-clear" onClick={() => setQ('')}>×</button>}
          </div>
          <select
            className="av-audit-input av-audit-input--sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            style={{ width: 180 }}
          >
            <option value="owned">Sort: Most owned</option>
            <option value="name">Sort: Name (A→Z)</option>
            <option value="weight">Sort: Drop weight</option>
            <option value="attack">Sort: Attack</option>
          </select>
          <span className="av-cards-count" style={{ ['--rarity-tone' as any]: tone }}>
            {cards.length} {cards.length === 1 ? 'card' : 'cards'}
          </span>
          <span className="av-cards-meta-select">
            <BulkSelectAll />
            <span>Select</span>
          </span>
          <button
            type="button"
            className="av-btn av-btn-primary av-cards-add"
            onClick={() => setEditor({ mode: 'create' })}
            style={{ ['--rarity-tone' as any]: tone }}
          >
            + New {activeRarity.toLowerCase()} card
          </button>
        </div>
      </section>

      {/* CARD GRID */}
      <div className="av-cards-grid" style={{ ['--rarity-tone' as any]: tone }}>
        {cards.length === 0 && (
          <div className="av-flows-empty" style={{ gridColumn: '1 / -1' }}>
            {q ? 'No cards match this search.' : `No ${activeRarity.toLowerCase()} cards defined yet.`}
          </div>
        )}
        {cards.map((c) => (
          <ContextMenu
            key={c.name}
            items={[
              { label: 'View holders', icon: '◇', run: () => setSelected(c) },
              { label: 'Edit card', icon: '✎', run: () => setEditor({ mode: 'edit', card: c }) },
              'separator' as const,
              { label: 'Copy card name', icon: '⧉', run: () => navigator.clipboard?.writeText(c.name) },
              ...(c.imageUrl ? [{ label: 'Copy image URL', icon: '⧉', run: () => navigator.clipboard?.writeText(c.imageUrl!) }] : []),
            ]}
          >
            <button
              type="button"
              className="av-card-tile"
              onClick={() => setSelected(c)}
              style={{
                ['--rarity-tone' as any]: RARITY_TONES[c.rarity],
              }}
            >
              <span className="av-card-tile-bulk" onClick={(e) => e.stopPropagation()}>
                <BulkCheckbox id={c.name} aria-label={`Select ${c.name}`} />
              </span>
              <div className="av-card-tile-img">
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    loading="lazy"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = 'none';
                      const parent = img.parentElement;
                      if (parent && !parent.querySelector('.av-card-tile-placeholder')) {
                        const ph = document.createElement('div');
                        ph.className = 'av-card-tile-placeholder';
                        ph.textContent = c.name.slice(0, 1);
                        parent.insertBefore(ph, img);
                      }
                    }}
                  />
                ) : (
                  <div className="av-card-tile-placeholder">{c.name.slice(0, 1)}</div>
                )}
                <span className="av-card-tile-rarity">{c.rarity}</span>
              </div>
              <div className="av-card-tile-body">
                <div className="av-card-tile-name">{c.name}</div>
                <div className="av-card-tile-stats">
                  <span title="Attack power">⚔ {c.attack}</span>
                  <span title="Drop weight">{c.dropPct.toFixed(c.dropPct < 1 ? 2 : 1)}%</span>
                </div>
                <div className="av-card-tile-owned">
                  <span>{fmt(c.copiesOwned)} copies</span>
                  <span>{fmt(c.ownerCount)} holders</span>
                </div>
              </div>
            </button>
          </ContextMenu>
        ))}
      </div>

      </>)}

      {selected && (
        <CardDetailDrawer
          card={selected}
          onClose={() => setSelected(null)}
          onEdit={(c) => { setSelected(null); setEditor({ mode: 'edit', card: c }); }}
          onDeleted={async () => { setSelected(null); refreshSnapshot(); }}
        />
      )}

      {editor && (
        <CardEditDialog
          mode={editor.mode}
          initialRarity={activeRarity}
          card={editor.card}
          onClose={() => setEditor(null)}
          onSaved={refreshSnapshot}
        />
      )}

      <CardsBulkBar cards={cards} activeRarity={activeRarity} onDone={refreshSnapshot} />
    </div>
    </BulkSelectProvider>
  );
}

function CardsBulkBar({ cards, activeRarity, onDone }: { cards: CardDef[]; activeRarity: Rarity; onDone: () => void }) {
  const { selected, clear } = useBulkSelect();
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();

  // Clear selection when rarity changes (stale IDs from a different tab)
  useEffect(() => { clear(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeRarity]);

  const selectedIds = Array.from(selected);
  if (selectedIds.length === 0) return null;

  const selectedCards = cards.filter((c) => selectedIds.includes(c.name));

  const bulkDelete = async () => {
    const ok = await pending.queue({
      label: `Delete ${selectedCards.length} ${selectedCards.length === 1 ? 'card' : 'cards'}`,
      detail: `All copies already owned by players will remain, but the card can no longer be rolled.`,
      delayMs: 6000,
      tone: 'danger',
      run: async () => {
        const deleted: CardDef[] = [];
        let failed = 0;
        for (const c of selectedCards) {
          try {
            await deleteCard(c);
            deleted.push(c);
          } catch { failed++; }
        }
        clear();

        if (deleted.length > 0) {
          undo.push({
            label: `${deleted.length} ${deleted.length === 1 ? 'card' : 'cards'} restored`,
            detail: activeRarity,
            revert: async () => {
              let restored = 0;
              for (const c of deleted) {
                try { await reAddCard(c); restored++; } catch { /* skip */ }
              }
              toast.show({
                tone: restored === deleted.length ? 'success' : 'warn',
                title: 'Undone',
                message: `${restored}/${deleted.length} cards restored`,
              });
              onDone();
            },
          });
        }

        toast.show({
          tone: failed === 0 ? 'success' : deleted.length === 0 ? 'error' : 'warn',
          title: failed === 0 ? 'Deleted' : 'Partial',
          message: `${deleted.length} deleted, ${failed} failed`,
        });
        onDone();
      },
    });
    if (ok === false) toast.show({ tone: 'warn', title: 'Cancelled', message: 'Bulk delete cancelled' });
  };

  const actions: BulkAction[] = [
    { label: `Delete ${selectedIds.length}`, tone: 'danger', onRun: bulkDelete },
  ];
  return <BulkActionBar actions={actions} />;
}
