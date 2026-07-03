'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminGet, adminPost } from '@/lib/admin/http';
import ContextMenu from '../_components/ContextMenu';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { useUndo } from '../_components/UndoProvider';
import { withBust, useBustVersion } from '@/lib/admin/cache-bust';

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

// Strip any `?v=...` cache-buster from the stored image string so the
// card-tile footer shows a clean filename instead of "name.png?v=1777509540463"
// — long query suffixes were wrapping inside the tile and visually breaking
// the grid layout.
function displayImageName(image: string | undefined): string {
  if (!image) return '—';
  return image.split('?')[0];
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

async function postAction(body: Record<string, unknown>): Promise<any> {
  return adminPost<any>('/api/admin/cards/config', body);
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
  const { bustVersion, bump } = useBustVersion();

  const [factionWar, setFactionWar] = useState<Record<string, FactionData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFaction, setActiveFaction] = useState<FactionName>('Beasts');
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState<{ faction: string; card?: FactionCard } | null>(null);

  // load is the imperative refetch — used by the retry button, reload button,
  // and onSaved handlers. It is intentionally NOT in any useEffect dep array
  // because `useToast()` returns a fresh object on every render, which would
  // make this callback unstable and cause the effect to refire on every state
  // update (the source of the "5 refreshes per upload" + "bounced back to
  // Beasts" bug — every refire reset activeFaction).
  const load = useCallback(async (opts?: { keepFaction?: boolean }) => {
    setLoading(true);
    try {
      const body = await adminGet<any>('/api/admin/cards/config');
      setFactionWar(body?.factionWar ?? null);
      bump();
      if (body.factionWar && !opts?.keepFaction) {
        const first = FACTION_NAMES.find((n) => (body.factionWar?.[n]?.cards?.length ?? 0) > 0);
        if (first) setActiveFaction(first);
      }
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast, bump]);

  // Initial mount only. Inline the fetch logic so we don't depend on `load`.
  // The eslint exhaustive-deps rule flags this; intentional — see the load
  // comment above. Re-fetches on save are triggered imperatively via onSaved.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const body = await adminGet<any>('/api/admin/cards/config');
        if (cancelled) return;
        setFactionWar(body?.factionWar ?? null);
        if (body.factionWar) {
          const first = FACTION_NAMES.find((n) => (body.factionWar?.[n]?.cards?.length ?? 0) > 0);
          if (first) setActiveFaction(first);
        }
      } catch (e) {
        if (!cancelled) console.error('[FactionWarView] initial load failed:', (e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <button type="button" className="av-btn av-btn-ghost" onClick={() => void load()}>↻ Retry</button>
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
            onClick={() => void load()}
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
                    key={`${card.image}-${bustVersion}`}
                    src={withBust(resolveImage(card.image), bustVersion)}
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
                <div
                  className="av-card-tile-stats av-fw-tile-file"
                  title={card.image || ''}
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {displayImageName(card.image)}
                </div>
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
          onSaved={() => { setEditor(null); void load({ keepFaction: true }); }}
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
  const { bustVersion, bump } = useBustVersion();
  const [name, setName] = useState(card?.name ?? '');
  const [image, setImage] = useState(card?.image ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fwDragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mode = card ? 'edit' : 'create';

  // Persist the card record. Returns true on success so callers can chain (e.g.
  // upload-then-save) without re-toasting.
  const persist = useCallback(async (nextImage: string, opts?: { silent?: boolean }): Promise<boolean> => {
    if (!name.trim()) {
      if (!opts?.silent) toast.show({ tone: 'error', title: 'Invalid', message: 'Name is required' });
      return false;
    }
    const cardPayload = {
      name: name.trim(),
      image: nextImage.trim(),
      ...(card?.description ? { description: card.description } : {}),
    };
    if (mode === 'edit' && card) {
      await postAction({
        action: 'update_faction_card',
        faction,
        oldName: card.name,
        card: cardPayload,
      });
    } else {
      await postAction({
        action: 'add_faction_card',
        faction,
        card: cardPayload,
      });
    }
    return true;
  }, [name, card, faction, mode, toast]);

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
      bump();
      toast.show({ tone: 'success', title: 'Image uploaded', message: 'Saving card…' });

      // Auto-persist so the user doesn't have to click Save twice. This was the
      // root cause of "image stays the same after replacing": uploads landed on
      // R2 + bumped the cache-bust query, but the DB doc still pointed at the
      // unversioned filename, so subsequent renders served the cached image.
      if (mode === 'edit' && card) {
        try {
          await persist(res.imageUrl, { silent: true });
          toast.show({ tone: 'success', title: 'Replaced', message: `${name} now uses the new image.` });
          onSaved();
          return;
        } catch (saveErr) {
          toast.show({ tone: 'error', title: 'Auto-save failed', message: `Image is on R2, but the card record didn't update: ${(saveErr as Error).message}. Click Save to retry.` });
        }
      } else {
        toast.show({ tone: 'info', title: 'Image staged', message: 'Click "Add card" below to create the card with this image.' });
      }
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearImage = () => {
    setImage('');
    bump();
    toast.show({ tone: 'info', title: 'Image cleared', message: 'Card will show a placeholder. Click Save to apply.' });
  };

  const save = async () => {
    setSaving(true);
    try {
      const ok = await persist(image);
      if (!ok) return;
      toast.show({ tone: 'success', title: mode === 'edit' ? 'Saved' : 'Added', message: name });
      onSaved();
    } catch (e) {
      toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const previewUrl = image ? withBust(resolveImage(image), bustVersion) : null;

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

              {/* Drop zone + preview + actions. Uses an enter/leave counter
                  to fix the flicker bug where dragLeave fires when entering
                  child elements (preview img, action buttons) and toggles
                  dragOver off mid-drag. */}
              <div
                className={`av-fw-image-zone${dragOver ? ' av-fw-image-zone--drag' : ''}${uploading ? ' av-fw-image-zone--busy' : ''}`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  if (uploading) return;
                  if (e.dataTransfer.types?.includes('Files')) {
                    fwDragCounter.current += 1;
                    setDragOver(true);
                  }
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  fwDragCounter.current = Math.max(0, fwDragCounter.current - 1);
                  if (fwDragCounter.current === 0) setDragOver(false);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  fwDragCounter.current = 0;
                  setDragOver(false);
                  if (uploading) return;
                  const f = Array.from(e.dataTransfer.files).find(file => file.type.startsWith('image/'));
                  if (f) void handleUpload(f);
                }}
              >
                <div className="av-fw-image-preview">
                  {previewUrl ? (
                    <img
                      key={`${image}-${bustVersion}`}
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
