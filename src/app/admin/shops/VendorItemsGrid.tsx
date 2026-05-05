'use client';

import { useMemo, useState } from 'react';
import Icon from '../_components/Icon';
import ContextMenu from '../_components/ContextMenu';
import type { VendorItem } from './VendorItemDialog';

interface Props {
  tone: string;
  items: VendorItem[];
  onAdd: (preset?: { type?: string }) => void;
  onEdit: (item: VendorItem, index: number) => void;
  onDelete: (index: number) => void;
  onReorder: (from: number, to: number) => void;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

type SortMode = 'order' | 'price-asc' | 'price-desc' | 'name';
type CategoryTab = 'items' | 'abilities';

export default function VendorItemsGrid({ tone, items, onAdd, onEdit, onDelete, onReorder }: Props) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortMode>('order');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [category, setCategory] = useState<CategoryTab>('items');
  const [showMirrors, setShowMirrors] = useState(false);

  const isAbility = (it: VendorItem) => (it.type ?? '').toLowerCase() === 'game_ability';
  const isMirror = (it: VendorItem) => it.seluna_locked === true;
  const mirrorCount = items.filter(isMirror).length;
  const abilityCount = items.filter((it) => isAbility(it) && !isMirror(it)).length;
  const regularCount = items.filter((it) => !isAbility(it) && !isMirror(it)).length;

  // Scope items to the active category. Seluna mirrors are hidden by default
  // — they're admin-side only metadata and shouldn't clutter the buy-from-Mells
  // grid. The mirror toggle shows them mixed in, styled distinctly.
  const scoped = useMemo(() => {
    return items
      .map((it, i) => ({ ...it, _index: i }))
      .filter((it) => (category === 'abilities' ? isAbility(it) : !isAbility(it)))
      .filter((it) => showMirrors || !isMirror(it));
  }, [items, category, showMirrors]);

  // Detect distinct item types in the current scope (for the inner type filter)
  const types = useMemo(() => {
    const set = new Set<string>();
    for (const it of scoped) {
      if (it.type) set.add(it.type);
    }
    return Array.from(set);
  }, [scoped]);

  const visible = useMemo(() => {
    let rows = scoped;
    const query = q.trim().toLowerCase();
    if (query) {
      rows = rows.filter((it) =>
        it.name?.toLowerCase().includes(query) ||
        it.id?.toLowerCase().includes(query) ||
        (it.description?.toLowerCase().includes(query) ?? false)
      );
    }
    if (typeFilter) rows = rows.filter((it) => (it.type ?? '') === typeFilter);
    if (sort === 'name') rows = [...rows].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    else if (sort === 'price-asc') rows = [...rows].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    else if (sort === 'price-desc') rows = [...rows].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    return rows;
  }, [scoped, q, sort, typeFilter]);

  const scopedValue = scoped.reduce((a, b) => a + (b.price ?? 0), 0);
  const cheapest = scoped.length > 0 ? scoped.reduce((a, b) => (a.price ?? 0) < (b.price ?? 0) ? a : b) : null;
  const richest = scoped.length > 0 ? scoped.reduce((a, b) => (a.price ?? 0) > (b.price ?? 0) ? a : b) : null;

  return (
    <section className="av-shop-inv" style={{ ['--vendor-tone' as any]: tone }}>
      <nav className="av-shop-category-tabs" role="tablist" aria-label="Shop category">
        <button
          type="button"
          role="tab"
          aria-selected={category === 'items'}
          className={`av-shop-category-tab${category === 'items' ? ' av-shop-category-tab--active' : ''}`}
          onClick={() => setCategory('items')}
        >
          Items <span className="av-shop-category-count">{regularCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={category === 'abilities'}
          className={`av-shop-category-tab${category === 'abilities' ? ' av-shop-category-tab--active' : ''}`}
          onClick={() => setCategory('abilities')}
        >
          Abilities <span className="av-shop-category-count">{abilityCount}</span>
        </button>
      </nav>

      <header className="av-shop-inv-head">
        <div>
          <h3>
            {category === 'abilities' ? 'Game abilities' : 'Inventory'}
            {' · '}
            {scoped.length} {scoped.length === 1 ? (category === 'abilities' ? 'ability' : 'item') : (category === 'abilities' ? 'abilities' : 'items')}
          </h3>
          <p>
            {category === 'abilities'
              ? 'Special game-ability items (buffs, power-ups). Bot-side filter: type === game_ability.'
              : (
                <>
                  Total value <strong>{fmt(scopedValue)}</strong> Lunari
                  {cheapest && ` · Cheapest: ${cheapest.name} ${fmt(cheapest.price ?? 0)}`}
                  {richest && ` · Highest: ${richest.name} ${fmt(richest.price ?? 0)}`}
                </>
              )}
          </p>
        </div>
        <button type="button" className="av-shop-add-btn" onClick={() => onAdd(category === 'abilities' ? { type: 'game_ability' } : undefined)}>
          <span aria-hidden="true">+</span> New {category === 'abilities' ? 'ability' : 'item'}
        </button>
      </header>

      <div className="av-shop-filters">
        <div className="av-audit-search" style={{ flex: '1 1 240px' }}>
          <Icon name="search" size={14} />
          <input
            className="av-audit-input"
            placeholder="Search by name, id, or description…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && <button type="button" className="av-audit-clear" onClick={() => setQ('')}>×</button>}
        </div>
        <select
          className="av-audit-input av-audit-input--sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          style={{ width: 180 }}
        >
          <option value="order">Sort: Original order</option>
          <option value="price-asc">Sort: Price ↑</option>
          <option value="price-desc">Sort: Price ↓</option>
          <option value="name">Sort: Name (A→Z)</option>
        </select>
        {mirrorCount > 0 && (
          <button
            type="button"
            className="av-btn av-btn-ghost av-btn-sm"
            onClick={() => setShowMirrors((v) => !v)}
            title="Seluna-locked mirrors are pinned here so backgrounds stay resolvable for owners forever. They cannot be edited or sold from Mells."
          >
            {showMirrors ? `Hide Seluna mirrors (${mirrorCount})` : `Show Seluna mirrors (${mirrorCount})`}
          </button>
        )}
      </div>

      {types.length > 0 && (
        <nav className="av-shop-type-chips" role="tablist" aria-label="Filter by type">
          <button
            type="button"
            role="tab"
            aria-selected={typeFilter === ''}
            className={`av-shop-type-chip${typeFilter === '' ? ' av-shop-type-chip--active' : ''}`}
            onClick={() => setTypeFilter('')}
          >
            All <span className="av-shop-type-chip-count">{scoped.length}</span>
          </button>
          {types.map((t) => {
            const count = scoped.filter((it) => (it.type ?? '') === t).length;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={typeFilter === t}
                className={`av-shop-type-chip${typeFilter === t ? ' av-shop-type-chip--active' : ''}`}
                onClick={() => setTypeFilter(t)}
              >
                <span style={{ textTransform: 'capitalize' }}>{t.replace(/_/g, ' ')}</span>
                <span className="av-shop-type-chip-count">{count}</span>
              </button>
            );
          })}
        </nav>
      )}

      {visible.length === 0 ? (
        <div className="av-shop-empty">
          {q || typeFilter
            ? <>No {category === 'abilities' ? 'abilities' : 'items'} match these filters.</>
            : <>No {category === 'abilities' ? 'abilities' : 'items'} yet — <button type="button" className="av-shop-empty-add" onClick={() => onAdd(category === 'abilities' ? { type: 'game_ability' } : undefined)}>add the first one</button>.</>}
        </div>
      ) : (
        <div className="av-shop-grid">
          {visible.map((it) => {
            const locked = isMirror(it);
            const lockedTitle = locked
              ? `Locked mirror — owned by Seluna's lifecycle.${it.seluna_origin_id ? ` Source: ${it.seluna_origin_id}` : ''} Edit from the Seluna tab.`
              : undefined;
            return (
              <ContextMenu
                key={it._index}
                items={locked ? [
                  { label: 'Copy item ID', icon: '⧉', run: () => navigator.clipboard?.writeText(it.id) },
                  ...(it.seluna_origin_id ? [{ label: 'Copy Seluna source ID', icon: '⧉', run: () => navigator.clipboard?.writeText(it.seluna_origin_id!) }] : []),
                ] : [
                  { label: 'Edit', icon: '✎', run: () => onEdit(it, it._index) },
                  { label: 'Move up', icon: '↑', disabled: it._index === 0, run: () => onReorder(it._index, it._index - 1) },
                  { label: 'Move down', icon: '↓', disabled: it._index === items.length - 1, run: () => onReorder(it._index, it._index + 1) },
                  'separator' as const,
                  { label: 'Copy item ID', icon: '⧉', run: () => navigator.clipboard?.writeText(it.id) },
                  { label: 'Delete', icon: '×', tone: 'danger' as const, run: () => onDelete(it._index) },
                ]}
              >
                <article
                  className={`av-shop-item${locked ? ' av-shop-item--locked' : ''}`}
                  data-seluna-locked={locked ? 'true' : undefined}
                  style={{
                    ...(it.gradientColors && it.gradientColors.length === 2 ? {
                      ['--item-grad-a' as any]: it.gradientColors[0],
                      ['--item-grad-b' as any]: it.gradientColors[1],
                    } : null),
                    ...(locked ? {
                      borderColor: 'rgba(192, 132, 252, 0.55)',
                      boxShadow: '0 0 0 1px rgba(192, 132, 252, 0.25) inset',
                      cursor: 'default',
                      ...(it.seluna_archived ? { opacity: 0.7 } : null),
                    } : null),
                  }}
                  onClick={() => { if (!locked) onEdit(it, it._index); }}
                  title={lockedTitle}
                >
                  <div className="av-shop-item-img">
                    <ItemImage item={it} />
                    {it.type && <span className="av-shop-item-type">{it.type}</span>}
                    {locked && (
                      <span
                        className="av-shop-item-type"
                        style={{ background: 'rgba(192,132,252,0.22)', color: '#e9d5ff', borderColor: 'rgba(192,132,252,0.6)', top: 8, right: 8, left: 'auto' }}
                      >
                        {it.seluna_archived ? '🌙 Seluna · Archived' : '🌙 Seluna locked'}
                      </span>
                    )}
                  </div>
                  <div className="av-shop-item-body">
                    <div className="av-shop-item-name">{it.name}</div>
                    {it.description && <div className="av-shop-item-desc">{it.description}</div>}
                    <div className="av-shop-item-foot">
                      <span className="av-shop-item-price">{fmt(it.price ?? 0)} <small>Lunari</small></span>
                      {it.roleId && <span className="av-shop-item-role" title={`Role ${it.roleId}`}>↗ role</span>}
                      {locked && it.seluna_background_type === 'both' && (
                        <span className="av-shop-item-role" title="Profile + Rank background">P+R</span>
                      )}
                    </div>
                  </div>
                  <div className="av-shop-item-actions">
                    {locked ? (
                      <button
                        type="button"
                        className="av-shop-item-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.alert(
                            `This is a Seluna mirror. Edit it from the Seluna tab.\n\nSource ID: ${it.seluna_origin_id ?? '—'}\n\nThe mirror keeps the image resolvable for everyone who already owns this background.`
                          );
                        }}
                        title="View source info"
                      >ⓘ</button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="av-shop-item-action"
                          onClick={(e) => { e.stopPropagation(); onEdit(it, it._index); }}
                          title="Edit"
                        >✎</button>
                        <button
                          type="button"
                          className="av-shop-item-action av-shop-item-action--danger"
                          onClick={(e) => { e.stopPropagation(); onDelete(it._index); }}
                          title="Delete"
                        >×</button>
                      </>
                    )}
                  </div>
                </article>
              </ContextMenu>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Per-item image with onError fallback to gradient/letter placeholder. */
function ItemImage({ item }: { item: VendorItem & { _index: number } }) {
  const [errored, setErrored] = useState(false);
  if (item.imageUrl && !errored) {
    return <img src={item.imageUrl} alt={item.name} loading="lazy" onError={() => setErrored(true)} />;
  }
  if (item.gradientColors && item.gradientColors.length === 2) {
    return <div className="av-shop-item-grad" />;
  }
  return <div className="av-shop-item-placeholder">{item.name?.slice(0, 1) ?? '?'}</div>;
}
