'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ContextMenu from '../_components/ContextMenu';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { useUndo } from '../_components/UndoProvider';

export interface FactionCard {
  name: string;
  image: string;
  description?: string;
}

export interface FactionData {
  emoji?: string;
  cards: FactionCard[];
}

export const FACTION_NAMES = [
  'Beasts', 'Colossals', 'Dragons', 'Knights', 'Lunarians',
  'Moon Creatures', 'Mythical Creatures', 'Strange Beings',
  'Supernatural', 'Underworld', 'Warriors',
] as const;

type FactionName = (typeof FACTION_NAMES)[number];

// Parse Discord custom-emoji format `<:name:id>` or `<a:name:id>` and return
// a CDN URL pointing at the actual emoji image. Returns null for plain-text or
// unicode emoji strings (those render fine as-is).
function parseDiscordEmoji(raw: string | undefined): { url: string; name: string } | null {
  if (!raw) return null;
  const m = /<(a)?:([^:]+):(\d+)>/.exec(raw);
  if (!m) return null;
  const animated = m[1] === 'a';
  return {
    name: m[2],
    url: `https://cdn.discordapp.com/emojis/${m[3]}.${animated ? 'gif' : 'png'}?size=64`,
  };
}

function EmojiOrText({ raw }: { raw?: string }) {
  if (!raw) return null;
  const parsed = parseDiscordEmoji(raw);
  if (parsed) {
    return <img src={parsed.url} alt={parsed.name} className="av-fw-emoji" loading="lazy" />;
  }
  // Plain unicode or text — render as-is
  return <span className="av-fw-emoji av-fw-emoji--text">{raw}</span>;
}

// Faction War cards store `image` as either a bare filename (legacy — served
// from /LunaPairs/) or a full R2 URL (after uploading from the dashboard).
// Normalise both so <img src={resolveImage(card.image)}> always works.
function resolveImage(image: string | undefined): string {
  if (!image) return '';
  if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:')) return image;
  return `https://assets.lunarian.app/LunaPairs/${image}`;
}

function fileToBase64(file: File): Promise<{ data: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      // Strip the "data:image/png;base64," prefix — API wants raw base64
      const comma = result.indexOf(',');
      resolve({
        data: comma >= 0 ? result.slice(comma + 1) : result,
        contentType: file.type || 'image/png',
      });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function postAction(body: Record<string, unknown>): Promise<any> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/cards/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Deterministic accent color per faction — so each faction tab/tile has its
// own identity without random mismatches.
const FACTION_TONES: Record<FactionName, string> = {
  'Beasts':            '#84cc16',
  'Colossals':         '#a78bfa',
  'Dragons':           '#ef4444',
  'Knights':           '#fbbf24',
  'Lunarians':         '#0ea5e9',
  'Moon Creatures':    '#818cf8',
  'Mythical Creatures':'#f472b6',
  'Strange Beings':    '#10b981',
  'Supernatural':      '#c084fc',
  'Underworld':        '#f59e0b',
  'Warriors':          '#eab308',
};

export default function FactionWarView() {
  const toast = useToast();
  const pending = usePendingAction();
  const undo = useUndo();

  const [factionWar, setFactionWar] = useState<Record<string, FactionData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFaction, setActiveFaction] = useState<FactionName>('Beasts');
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState<{ faction: string; card?: FactionCard } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/cards/config', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setFactionWar(body.factionWar ?? null);
      // Pick the first faction with cards on initial load
      if (body.factionWar) {
        const first = FACTION_NAMES.find((n) => (body.factionWar?.[n]?.cards?.length ?? 0) > 0);
        if (first) setActiveFaction(first);
      }
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const activeCards = useMemo<FactionCard[]>(() => {
    const cards = factionWar?.[activeFaction]?.cards ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return [...cards];
    return cards.filter((c) => c.name.toLowerCase().includes(query) || c.image.toLowerCase().includes(query));
  }, [factionWar, activeFaction, q]);

  const totalCards = factionWar
    ? Object.values(factionWar).reduce((s, f) => s + (f?.cards?.length ?? 0), 0)
    : 0;

  const deleteCard = (factionName: string, cardName: string) => {
    pending.queue({
      label: `Delete ${cardName}`,
      detail: `Removed from ${factionName} faction war deck`,
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        try {
          const snapshot = factionWar;
          await postAction({ action: 'delete_faction_card', faction: factionName, cardName });
          toast.show({ tone: 'success', title: 'Deleted', message: cardName });
          void load();
          undo.push({
            label: `Restore ${cardName}`,
            detail: `Re-add to ${factionName}`,
            revert: async () => {
              const card = snapshot?.[factionName]?.cards?.find((c) => c.name === cardName);
              if (!card) throw new Error('Cannot undo — snapshot missing');
              await postAction({ action: 'add_faction_card', faction: factionName, card });
              toast.show({ tone: 'success', title: 'Restored', message: cardName });
              void load();
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Delete failed', message: (e as Error).message });
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="av-fw-placeholder">
        <div className="av-fw-placeholder-icon">⚔</div>
        <strong>Loading Faction War deck…</strong>
        <p>Fetching factions + cards from MongoDB.</p>
      </div>
    );
  }

  if (!factionWar) {
    return (
      <div className="av-fw-placeholder">
        <div className="av-fw-placeholder-icon">⚠</div>
        <strong>Faction War data not available</strong>
        <p>
          Jester's FactionWar block wasn't found in <code>bot_config.jester_game_settings</code> or <code>config.ts</code>.
          Seed the deck from Jester config to start editing.
        </p>
        <button type="button" className="av-btn av-btn-ghost" onClick={load}>↻ Retry</button>
      </div>
    );
  }

  const activeTone = FACTION_TONES[activeFaction] ?? '#f59e0b';
  const activeFactionData = factionWar[activeFaction];

  return (
    <div className="av-cards">
      {/* Data propagation hint — admins often forget their edits show up publicly */}
      <div className="av-commands-banner" data-tone="info" style={{ marginBottom: 10 }}>
        <strong>Live on lunarian.app</strong>
        <span>
          Every save mirrors to both <code>bot_config.jester_game_settings</code> (Jester bot) and
          <code>luna_pairs_config</code> (public Faction War page). Name, image, and description edits
          appear on the website within ~1 minute.
        </span>
      </div>

      {/* FACTION TABS — same visual style as rarity tabs, but amber/per-faction tinted */}
      <nav className="av-cards-tabs" role="tablist" aria-label="Faction">
        {FACTION_NAMES.map((name) => {
          const data = factionWar[name];
          const count = data?.cards?.length ?? 0;
          const active = name === activeFaction;
          return (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={count === 0 && !active}
              onClick={() => { setActiveFaction(name); setQ(''); }}
              className={`av-cards-tab${active ? ' av-cards-tab--active' : ''}`}
              style={{ ['--rarity-tone' as any]: FACTION_TONES[name] ?? '#f59e0b' }}
            >
              <EmojiOrText raw={data?.emoji} />
              <span className="av-cards-tab-name">{name}</span>
              <span className="av-cards-tab-count">{count}</span>
            </button>
          );
        })}
      </nav>

      {/* FILTER ROW — same pattern as Luna Fantasy */}
      <section className="av-surface av-cards-filters">
        <div className="av-users-filter-row">
          <div className="av-audit-search" style={{ flex: '1 1 240px' }}>
            <input
              className="av-audit-input"
              placeholder={`Search ${activeFaction.toLowerCase()} cards…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && <button type="button" className="av-audit-clear" onClick={() => setQ('')}>×</button>}
          </div>
          <span className="av-text-muted" style={{ fontSize: 'var(--av-text-xs)' }}>
            {totalCards} cards total · 11 factions
          </span>
          <span className="av-cards-count" style={{ ['--rarity-tone' as any]: activeTone }}>
            {activeCards.length} {activeCards.length === 1 ? 'card' : 'cards'}
          </span>
          <button
            type="button"
            className="av-btn av-btn-ghost"
            onClick={load}
          >
            ↻
          </button>
          <button
            type="button"
            className="av-btn av-btn-primary av-cards-add"
            onClick={() => setEditor({ faction: activeFaction })}
            style={{ ['--rarity-tone' as any]: activeTone }}
          >
            + New {activeFaction.toLowerCase()} card
          </button>
        </div>
      </section>

      {/* CARD GRID — reuses the same .av-cards-grid tile layout as Luna Fantasy */}
      <div className="av-cards-grid" style={{ ['--rarity-tone' as any]: activeTone }}>
        {activeCards.length === 0 && (
          <div className="av-flows-empty" style={{ gridColumn: '1 / -1' }}>
            {q
              ? 'No cards match this search.'
              : `No ${activeFaction.toLowerCase()} cards yet. Click "+ New ${activeFaction.toLowerCase()} card" above to add the first one.`}
          </div>
        )}
        {activeCards.map((card) => (
          <ContextMenu
            key={card.name}
            items={[
              { label: 'Edit card', icon: '✎', run: () => setEditor({ faction: activeFaction, card }) },
              { label: 'Copy card name', icon: '⧉', run: () => navigator.clipboard?.writeText(card.name) },
              { label: 'Copy image filename', icon: '⧉', run: () => navigator.clipboard?.writeText(card.image) },
              'separator' as const,
              { label: 'Delete card', icon: '🗑', run: () => deleteCard(activeFaction, card.name) },
            ]}
          >
            <button
              type="button"
              className="av-card-tile av-fw-tile"
              onClick={() => setEditor({ faction: activeFaction, card })}
              style={{ ['--rarity-tone' as any]: activeTone }}
            >
              <div className="av-card-tile-img">
                {card.image ? (
                  <img
                    src={resolveImage(card.image)}
                    alt={card.name}
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="av-card-tile-placeholder">{card.name.slice(0, 1)}</div>
                )}
                <span className="av-card-tile-rarity av-fw-tile-faction">
                  <EmojiOrText raw={activeFactionData?.emoji} />
                  {activeFaction}
                </span>
              </div>
              <div className="av-card-tile-body">
                <div className="av-card-tile-name">{card.name}</div>
                <div className="av-card-tile-stats av-fw-tile-file">{card.image || '—'}</div>
              </div>
            </button>
          </ContextMenu>
        ))}
      </div>

      {editor && (
        <FactionCardEditDialog
          faction={editor.faction}
          card={editor.card}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); void load(); }}
        />
      )}
    </div>
  );
}

// ─── Edit dialog ───

function FactionCardEditDialog({
  faction, card, onClose, onSaved,
}: {
  faction: string;
  card?: FactionCard;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(card?.name ?? '');
  const [image, setImage] = useState(card?.image ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mode = card ? 'edit' : 'create';

  const handleUpload = async (file: File) => {
    if (!name.trim()) {
      toast.show({ tone: 'error', title: 'Name first', message: 'Fill in the card name before uploading — it becomes part of the filename.' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.show({ tone: 'error', title: 'Not an image', message: 'Please pick a PNG, JPG, or WEBP.' });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.show({ tone: 'error', title: 'Too large', message: 'Max file size is 4 MB.' });
      return;
    }
    setUploading(true);
    try {
      const { data, contentType } = await fileToBase64(file);
      const res = await postAction({
        action: 'upload_faction_image',
        faction,
        cardName: name.trim(),
        imageData: data,
        contentType,
      });
      if (!res?.imageUrl) throw new Error('Upload returned no URL');
      setImage(res.imageUrl);
      toast.show({ tone: 'success', title: 'Uploaded', message: 'Click Save to apply.' });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearImage = () => {
    setImage('');
    toast.show({ tone: 'info', title: 'Image cleared', message: 'Card will show a placeholder. Click Save to apply.' });
  };

  const save = async () => {
    if (!name.trim()) { toast.show({ tone: 'error', title: 'Invalid', message: 'Name is required' }); return; }
    setSaving(true);
    try {
      // Description is owned by another surface — preserve whatever's already on
      // the card so saving here doesn't clobber it.
      const cardPayload = {
        name: name.trim(),
        image: image.trim(),
        ...(card?.description ? { description: card.description } : {}),
      };
      if (mode === 'edit' && card) {
        await postAction({
          action: 'update_faction_card',
          faction,
          oldName: card.name,        // ← API expects `oldName`, not `originalName` (previous bug)
          card: cardPayload,
        });
        toast.show({ tone: 'success', title: 'Saved', message: name });
      } else {
        await postAction({
          action: 'add_faction_card',
          faction,
          card: cardPayload,
        });
        toast.show({ tone: 'success', title: 'Added', message: name });
      }
      onSaved();
    } catch (e) {
      toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const previewUrl = image ? resolveImage(image) : null;

  return (
    <div className="av-modal-backdrop" onClick={onClose}>
      <div className="av-modal" onClick={(e) => e.stopPropagation()}>
        <header className="av-modal-head">
          <h3>{mode === 'edit' ? 'Edit' : 'Add'} {faction} card</h3>
          <button type="button" className="av-btn av-btn-ghost" onClick={onClose}>×</button>
        </header>
        <div className="av-modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div>
              <label className="av-games-field-label">Card name</label>
              <input
                type="text"
                className="av-shopf-input"
                placeholder="e.g. Abyssal Leech"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 100))}
              />
            </div>

            {/* ─── Image section ─── */}
            <div>
              <label className="av-games-field-label">Card image</label>

              {/* Drop zone + preview + actions */}
              <div
                className={`av-fw-image-zone${dragOver ? ' av-fw-image-zone--drag' : ''}${uploading ? ' av-fw-image-zone--busy' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void handleUpload(f);
                }}
              >
                <div className="av-fw-image-preview">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt=""
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                    />
                  ) : (
                    <div className="av-fw-image-empty">
                      <span>No image</span>
                      <small>Click Upload or drop a file</small>
                    </div>
                  )}
                </div>

                <div className="av-fw-image-actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f);
                    }}
                  />
                  <button
                    type="button"
                    className="av-btn av-btn-primary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || !name.trim()}
                    title={!name.trim() ? 'Enter a card name first' : 'Choose an image to upload'}
                  >
                    {uploading ? 'Uploading…' : (image ? '↑ Replace image' : '↑ Upload image')}
                  </button>
                  {image && (
                    <button
                      type="button"
                      className="av-btn av-btn-ghost"
                      onClick={clearImage}
                      disabled={uploading}
                    >
                      Remove image
                    </button>
                  )}
                </div>
              </div>

              {/* Filename field — still editable for power users / legacy LunaPairs files */}
              <div style={{ marginTop: 14 }}>
                <span className="av-games-field-sublabel">Image path or full URL</span>
                <input
                  type="text"
                  className="av-shopf-input av-shopf-input--mono"
                  placeholder="e.g. beasts_abyssal_leech.png  OR  https://assets.lunarian.app/..."
                  value={image}
                  onChange={(e) => setImage(e.target.value.slice(0, 500))}
                  disabled={uploading}
                />
                <p className="av-text-muted" style={{ fontSize: 'var(--av-text-xs)', marginTop: 4 }}>
                  Bare filenames resolve against <code>assets.lunarian.app/LunaPairs/</code>. Full URLs (http/https) are used as-is.
                </p>
              </div>
            </div>

          </div>
        </div>
        <footer className="av-modal-foot">
          <button type="button" className="av-btn av-btn-ghost" onClick={onClose} disabled={saving || uploading}>Cancel</button>
          <button type="button" className="av-btn av-btn-primary" onClick={save} disabled={saving || uploading || !name.trim()}>
            {saving ? 'Saving…' : (mode === 'edit' ? 'Save' : 'Add card')}
          </button>
        </footer>
      </div>
    </div>
  );
}
