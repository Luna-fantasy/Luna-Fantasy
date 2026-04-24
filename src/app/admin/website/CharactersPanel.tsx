'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';

interface LocalizedString { en: string; ar: string }
interface Character {
  id: string;
  name: LocalizedString;
  lore?: LocalizedString;
  faction: string;
  imageUrl: string;
  isMainCharacter?: boolean;
  cardId?: string;
}

interface FactionMeta { id: string; name: LocalizedString }

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

export default function CharactersPanel({ factions }: { factions: FactionMeta[] }) {
  const toast = useToast();
  const pending = usePendingAction();

  const [loading, setLoading] = useState(true);
  const [chars, setChars] = useState<Character[]>([]);
  const [original, setOriginal] = useState<Record<string, Character>>({});
  const [pendingImages, setPendingImages] = useState<Record<string, File>>({});
  const [filterFaction, setFilterFaction] = useState<string>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/characters/list', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: Character[] = data.characters ?? [];
      setChars(list);
      const byId: Record<string, Character> = {};
      for (const c of list) byId[c.id] = JSON.parse(JSON.stringify(c));
      setOriginal(byId);
      setPendingImages({});
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const factionLabel = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of factions) m[f.id] = f.name.en;
    return m;
  }, [factions]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chars.filter((c) => {
      if (filterFaction !== 'all' && c.faction !== filterFaction) return false;
      if (!q) return true;
      return (
        c.id.toLowerCase().includes(q) ||
        c.name?.en?.toLowerCase().includes(q) ||
        c.name?.ar?.toLowerCase().includes(q)
      );
    });
  }, [chars, filterFaction, query]);

  const diffOf = useCallback((c: Character): Array<{ field: string; value: string }> => {
    const o = original[c.id];
    if (!o) return [];
    const out: Array<{ field: string; value: string }> = [];
    if ((c.name?.en ?? '') !== (o.name?.en ?? '')) out.push({ field: 'name.en', value: c.name.en });
    if ((c.name?.ar ?? '') !== (o.name?.ar ?? '')) out.push({ field: 'name.ar', value: c.name.ar });
    const coLen = c.lore?.en ?? '';
    const ooLen = o.lore?.en ?? '';
    if (coLen !== ooLen) out.push({ field: 'lore.en', value: coLen });
    const coAr = c.lore?.ar ?? '';
    const ooAr = o.lore?.ar ?? '';
    if (coAr !== ooAr) out.push({ field: 'lore.ar', value: coAr });
    return out;
  }, [original]);

  const hasChanges = useCallback((c: Character) => {
    return diffOf(c).length > 0 || Boolean(pendingImages[c.id]);
  }, [diffOf, pendingImages]);

  const update = (id: string, patch: Partial<Character> | ((c: Character) => Character)) => {
    setChars((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      return typeof patch === 'function' ? patch(c) : { ...c, ...patch };
    }));
  };

  const onPickImage = (id: string, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.show({ tone: 'error', title: 'Not an image', message: 'Pick a PNG, JPG, or WEBP file.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.show({ tone: 'error', title: 'Too large', message: 'Max 10 MB per image.' });
      return;
    }
    setPendingImages((m) => ({ ...m, [id]: file }));
    const localUrl = URL.createObjectURL(file);
    update(id, { imageUrl: localUrl });
  };

  const saveOne = (c: Character) => {
    const dbDiff = diffOf(c);
    const img = pendingImages[c.id];
    if (dbDiff.length === 0 && !img) return;

    pending.queue({
      label: `Save ${c.name?.en || c.id}`,
      detail: [
        dbDiff.length ? `${dbDiff.length} field change${dbDiff.length === 1 ? '' : 's'}` : null,
        img ? 'new image' : null,
      ].filter(Boolean).join(' · '),
      delayMs: 3000,
      run: async () => {
        try {
          const fd = new FormData();
          if (dbDiff.length > 0) {
            const dbFields = dbDiff.map((d) => ({
              collection: 'characters',
              id: c.id,
              field: d.field,
              value: d.value,
            }));
            fd.append('dbFields', JSON.stringify(dbFields));
          }
          if (img) {
            fd.append(`image_${c.id}`, img);
            fd.append(`image_meta_${c.id}`, JSON.stringify({
              id: c.id,
              dbCollection: 'characters',
              dbId: c.id,
              dbField: 'imageUrl',
            }));
          }
          const res = await fetch('/api/admin/content/save', {
            method: 'POST',
            headers: { 'x-csrf-token': getCsrfToken() },
            body: fd,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || 'Save failed');
          }
          toast.show({ tone: 'success', title: 'Saved', message: `${c.name?.en || c.id} updated.` });
          await load();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const resetOne = (id: string) => {
    const o = original[id];
    if (!o) return;
    update(id, () => JSON.parse(JSON.stringify(o)));
    setPendingImages((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
  };

  return (
    <div className="av-chars-panel">
      <div className="av-chars-toolbar">
        <input
          type="search"
          className="av-audit-input"
          placeholder="Search by name or id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search characters"
        />
        <select
          className="av-audit-input"
          value={filterFaction}
          onChange={(e) => setFilterFaction(e.target.value)}
          aria-label="Filter by faction"
        >
          {factions.map((f) => (
            <option key={f.id} value={f.id}>{f.name.en}</option>
          ))}
        </select>
        <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => void load()}>
          Reload
        </button>
        <span className="av-text-muted" style={{ marginLeft: 'auto', fontSize: 13 }}>
          {loading ? 'Loading…' : `${visible.length} of ${chars.length}`}
        </span>
      </div>

      {loading ? (
        <div className="av-flows-empty">Loading characters…</div>
      ) : visible.length === 0 ? (
        <div className="av-flows-empty">No characters match this filter.</div>
      ) : (
        <div className="av-chars-grid">
          {visible.map((c) => (
            <CharacterCard
              key={c.id}
              c={c}
              factionLabel={factionLabel[c.faction] || c.faction}
              dirty={hasChanges(c)}
              onChange={(patch) => update(c.id, patch)}
              onPickImage={(file) => onPickImage(c.id, file)}
              onSave={() => saveOne(c)}
              onReset={() => resetOne(c.id)}
              hasPendingImage={Boolean(pendingImages[c.id])}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  c: Character;
  factionLabel: string;
  dirty: boolean;
  hasPendingImage: boolean;
  onChange: (patch: Partial<Character>) => void;
  onPickImage: (file: File | null) => void;
  onSave: () => void;
  onReset: () => void;
}

function CharacterCard({ c, factionLabel, dirty, hasPendingImage, onChange, onPickImage, onSave, onReset }: CardProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const setName = (lang: 'en' | 'ar', v: string) => {
    onChange({ name: { ...c.name, [lang]: v } as LocalizedString });
  };
  const setLore = (lang: 'en' | 'ar', v: string) => {
    const next = { en: c.lore?.en ?? '', ar: c.lore?.ar ?? '', [lang]: v } as LocalizedString;
    onChange({ lore: next });
  };

  return (
    <article className="av-chars-card">
      <div className="av-chars-card-head">
        <div className="av-chars-image-wrap">
          {c.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.imageUrl} alt="" className="av-chars-image" />
          ) : (
            <div className="av-chars-image-placeholder">?</div>
          )}
        </div>
        <div className="av-chars-meta">
          <div className="av-chars-id"><code>{c.id}</code></div>
          <div className="av-chars-faction">{factionLabel}</div>
          {hasPendingImage && <span className="av-chars-pending-pill">New image pending</span>}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className="av-btn av-btn-ghost av-btn-sm av-chars-swap-btn"
        onClick={() => fileRef.current?.click()}
      >
        ⬆ Swap image
      </button>

      <div className="av-chars-fields">
        <label className="av-banking-field">
          <span>Name (EN)</span>
          <input
            className="av-audit-input"
            value={c.name?.en ?? ''}
            onChange={(e) => setName('en', e.target.value)}
            maxLength={120}
          />
        </label>
        <label className="av-banking-field">
          <span>Name (AR)</span>
          <input
            className="av-audit-input"
            value={c.name?.ar ?? ''}
            onChange={(e) => setName('ar', e.target.value)}
            maxLength={120}
            dir="rtl"
          />
        </label>
        <label className="av-banking-field" style={{ gridColumn: '1 / -1' }}>
          <span>Lore (EN)</span>
          <textarea
            className="av-audit-input"
            value={c.lore?.en ?? ''}
            onChange={(e) => setLore('en', e.target.value)}
            maxLength={2000}
            rows={3}
          />
        </label>
        <label className="av-banking-field" style={{ gridColumn: '1 / -1' }}>
          <span>Lore (AR)</span>
          <textarea
            className="av-audit-input"
            value={c.lore?.ar ?? ''}
            onChange={(e) => setLore('ar', e.target.value)}
            maxLength={2000}
            rows={3}
            dir="rtl"
          />
        </label>
      </div>

      {dirty && (
        <div className="av-chars-actions">
          <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={onReset}>
            Discard
          </button>
          <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={onSave}>
            Save
          </button>
        </div>
      )}
    </article>
  );
}
