'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';

interface BadgeThresholds {
  million: number;
  text_messages: number;
  voice_seconds: number;
  game_wins: number;
  la_luna_level: number;
  roulette_wins: number;
}

interface BadgeVisual {
  imageUrl: string;
  updatedAt: number;
}

type BadgesVisuals = Record<string, BadgeVisual>;

interface BadgeInfo {
  id: string;
  name: string;
  glyph: string;
  tone: string;
  threshold: keyof BadgeThresholds | null;
  condition: string;
  kind: 'auto' | 'manual' | 'role' | 'collection' | 'time';
}

const BADGES: BadgeInfo[] = [
  { id: 'million', name: 'Millionaire', glyph: '💰', tone: '#FFD54F', threshold: 'million', condition: 'Lifetime Lunari earned', kind: 'auto' },
  { id: 'text', name: 'Chatter', glyph: '💬', tone: '#00FF99', threshold: 'text_messages', condition: 'Messages sent', kind: 'auto' },
  { id: 'voice', name: 'Voice Veteran', glyph: '🎙️', tone: '#0077FF', threshold: 'voice_seconds', condition: 'Voice time (seconds)', kind: 'auto' },
  { id: 'games_500', name: 'Gamer', glyph: '🎮', tone: '#B066FF', threshold: 'game_wins', condition: 'Game wins', kind: 'auto' },
  { id: 'la_luna', name: 'La Luna', glyph: '🌙', tone: '#FFD27F', threshold: 'la_luna_level', condition: 'Level reached', kind: 'auto' },
  { id: 'roulette_king', name: 'Roulette King', glyph: '🎯', tone: '#FF3366', threshold: 'roulette_wins', condition: 'Roulette wins', kind: 'auto' },
  { id: 'all_cards', name: 'Card Master', glyph: '🃏', tone: '#FF3366', threshold: null, condition: 'Owns every card in the catalog', kind: 'collection' },
  { id: 'all_stones', name: 'Stone Master', glyph: '💎', tone: '#0077FF', threshold: null, condition: 'Owns every stone in the catalog', kind: 'collection' },
  { id: 'one_year', name: 'Veteran', glyph: '📅', tone: '#FFD54F', threshold: null, condition: 'Account age ≥ 1 year', kind: 'time' },
  { id: 'first_role', name: 'Pioneer', glyph: '✨', tone: '#FFD27F', threshold: null, condition: 'First role recipient', kind: 'manual' },
  { id: 'honor', name: 'Honor', glyph: '🏆', tone: '#FFD27F', threshold: null, condition: 'Manually awarded by staff', kind: 'manual' },
];

const DEFAULTS: BadgeThresholds = {
  million: 1_000_000,
  text_messages: 2_500,
  voice_seconds: 360_000,
  game_wins: 500,
  la_luna_level: 100,
  roulette_wins: 100,
};

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function saveSection(section: string, value: any): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/config/butler', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ section, value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

async function uploadBadgeImage(badgeId: string, file: File): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsDataURL(file);
  });
  const token = await fetchCsrf();
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const res = await fetch('/api/admin/v2/r2/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({
      folder: 'badges',
      filename: `${badgeId}.${ext}`,
      imageData: base64,
      contentType: file.type || 'image/png',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.url as string;
}

function formatValue(key: keyof BadgeThresholds, v: number): string {
  if (key === 'voice_seconds') {
    const h = Math.round(v / 3600);
    return `${h} hours (${v.toLocaleString()}s)`;
  }
  return v.toLocaleString();
}

export default function BadgesClient() {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();

  const [draft, setDraft] = useState<BadgeThresholds>(DEFAULTS);
  const [saved, setSaved] = useState<BadgeThresholds>(DEFAULTS);
  const [visuals, setVisuals] = useState<BadgesVisuals>({});
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config/butler', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const thresholds: BadgeThresholds = { ...DEFAULTS, ...(body.sections?.badge_thresholds ?? {}) };
      setSaved(thresholds);
      setDraft(thresholds);
      setVisuals((body.sections?.badges_visuals as BadgesVisuals) ?? {});
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const save = () => {
    if (!dirty) return;
    const before = saved;
    pending.queue({
      label: 'Save badge thresholds',
      detail: 'Butler will pick up within ~30s (no restart needed)',
      delayMs: 4500,
      run: async () => {
        try {
          await saveSection('badge_thresholds', draft);
          setSaved(draft);
          toast.show({ tone: 'success', title: 'Saved', message: 'Badge thresholds updated' });
          undo.push({
            label: 'Restore previous badge thresholds',
            detail: 'One-click revert',
            revert: async () => {
              await saveSection('badge_thresholds', before);
              setSaved(before);
              setDraft(before);
              toast.show({ tone: 'success', title: 'Reverted', message: 'Previous thresholds restored' });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const reset = () => { setDraft(saved); };
  const resetDefaults = () => { setDraft(DEFAULTS); };

  const update = (key: keyof BadgeThresholds, val: number) => {
    setDraft((d) => ({ ...d, [key]: val }));
  };

  const handleFile = async (badgeId: string, file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.show({ tone: 'error', title: 'Too large', message: 'Badge images must be under 2MB.' });
      return;
    }
    setUploadingId(badgeId);
    try {
      const url = await uploadBadgeImage(badgeId, file);
      const nextVisuals: BadgesVisuals = {
        ...visuals,
        [badgeId]: { imageUrl: url, updatedAt: Date.now() },
      };
      await saveSection('badges_visuals', nextVisuals);
      setVisuals(nextVisuals);
      toast.show({ tone: 'success', title: 'Uploaded', message: 'Badge image saved.' });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setUploadingId(null);
    }
  };

  const removeImage = async (badgeId: string) => {
    const before = visuals;
    const next: BadgesVisuals = { ...visuals };
    delete next[badgeId];
    try {
      await saveSection('badges_visuals', next);
      setVisuals(next);
      toast.show({ tone: 'success', title: 'Removed', message: 'Badge image cleared.' });
      undo.push({
        label: `Restore ${badgeId} badge image`,
        detail: 'One-click revert',
        revert: async () => {
          await saveSection('badges_visuals', before);
          setVisuals(before);
          toast.show({ tone: 'success', title: 'Reverted', message: 'Image restored.' });
        },
      });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Remove failed', message: (e as Error).message });
    }
  };

  if (loading) return <div className="av-commands-empty">Loading badge config…</div>;

  const bustCache = (url: string, updatedAt?: number) => {
    if (!url) return url;
    if (url.includes('?')) return url;
    return updatedAt ? `${url}?v=${updatedAt}` : url;
  };

  return (
    <div className="av-badges-page">
      <article className="av-surface">
        <header className="av-flows-head">
          <div>
            <h3>Auto-award thresholds</h3>
            <p>Butler evaluates these when a user crosses the threshold or during the daily scan. Lower a threshold to make a badge more accessible.</p>
          </div>
          <div className="av-flows-actions" style={{ display: 'flex', gap: 8 }}>
            {dirty && <button type="button" className="av-btn av-btn-ghost" onClick={reset}>Discard</button>}
            <button type="button" className="av-btn av-btn-ghost" onClick={resetDefaults}>Restore defaults</button>
            <button type="button" className="av-btn av-btn-primary" onClick={save} disabled={!dirty}>
              {dirty ? 'Save changes' : 'Saved'}
            </button>
          </div>
        </header>

        <div className="av-badges-threshold-grid">
          {(['million', 'text_messages', 'voice_seconds', 'game_wins', 'la_luna_level', 'roulette_wins'] as const).map((key) => {
            const b = BADGES.find((x) => x.threshold === key)!;
            return (
              <div key={key} className="av-badges-threshold-card" style={{ borderColor: `${b.tone}33` }}>
                <div className="av-badges-threshold-head">
                  <span className="av-badges-glyph" style={{ background: `${b.tone}22`, color: b.tone }}>{b.glyph}</span>
                  <div>
                    <strong>{b.name}</strong>
                    <span className="av-badges-threshold-label">{b.condition}</span>
                  </div>
                </div>
                <div className="av-badges-threshold-input">
                  <input
                    type="number"
                    min={0}
                    step={key === 'voice_seconds' ? 3600 : 1}
                    className="av-shopf-input"
                    value={draft[key]}
                    onChange={(e) => update(key, Math.max(0, Number(e.target.value) || 0))}
                  />
                  <span className="av-badges-formatted">{formatValue(key, draft[key])}</span>
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <article className="av-surface">
        <header className="av-flows-head">
          <div>
            <h3>Badge gallery</h3>
            <p>The full badge roster. Upload custom images per badge — Butler picks these up automatically (falls back to the built-in icon if none is set).</p>
          </div>
        </header>
        <div className="av-badges-all-grid">
          {BADGES.map((b) => {
            const vis = visuals[b.id];
            const imageUrl = vis?.imageUrl ? bustCache(vis.imageUrl, vis.updatedAt) : null;
            return (
              <BadgeCard
                key={b.id}
                badge={b}
                imageUrl={imageUrl}
                savedThreshold={b.threshold ? formatValue(b.threshold, saved[b.threshold]) : null}
                uploading={uploadingId === b.id}
                onFile={(f) => void handleFile(b.id, f)}
                onRemove={() => void removeImage(b.id)}
                canRemove={!!imageUrl}
              />
            );
          })}
        </div>
      </article>
    </div>
  );
}

function BadgeCard({
  badge,
  imageUrl,
  savedThreshold,
  uploading,
  onFile,
  onRemove,
  canRemove,
}: {
  badge: BadgeInfo;
  imageUrl: string | null;
  savedThreshold: string | null;
  uploading: boolean;
  onFile: (f: File) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="av-badges-card" style={{ borderColor: `${badge.tone}33` }}>
      <div className="av-badges-card-art" style={{ background: `${badge.tone}14`, borderColor: `${badge.tone}33` }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={badge.name}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <span className="av-badges-glyph av-badges-glyph--lg" style={{ background: `${badge.tone}22`, color: badge.tone }}>{badge.glyph}</span>
        )}
      </div>
      <div className="av-badges-card-body">
        <div className="av-badges-card-head">
          <strong>{badge.name}</strong>
          <span className={`av-badges-kind av-badges-kind--${badge.kind}`}>{badge.kind}</span>
        </div>
        <p>{badge.condition}</p>
        {savedThreshold && (
          <span className="av-badges-current">Current: <strong>{savedThreshold}</strong></span>
        )}
        {!savedThreshold && badge.kind === 'manual' && (
          <span className="av-badges-current av-text-muted">Awarded via admin command</span>
        )}
        {!savedThreshold && badge.kind === 'collection' && (
          <span className="av-badges-current av-text-muted">Requires full collection</span>
        )}
        {!savedThreshold && badge.kind === 'time' && (
          <span className="av-badges-current av-text-muted">Account age based</span>
        )}
        <div className="av-badges-card-actions">
          <button
            type="button"
            className="av-btn av-btn-ghost av-btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : imageUrl ? '⬆ Replace' : '⬆ Upload image'}
          </button>
          {canRemove && (
            <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={onRemove} disabled={uploading}>
              Remove
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
}
