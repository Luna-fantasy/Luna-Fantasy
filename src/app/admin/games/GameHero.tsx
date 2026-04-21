'use client';

import { useEffect, useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useTimezone } from '../_components/TimezoneProvider';
import TriggerPills from './TriggerPills';
import PermissionSummary from './PermissionSummary';
import type { GameSpec } from './game-schema';

interface Props {
  game: GameSpec;
  title: string;
  description: string;
  image: string;
  enabled: boolean | null;   // null when the game has no enabledKey (e.g. Baloot)
  flavorPool?: string;
  flavorPinned?: string;
  triggers?: string[];           // undefined = bot has no trigger concept (Butler); [] = triggers expected but none set
  allowedRoles?: string[];
  allowedChannels?: string[];
  updatedAt: string | null;
  onPatch: (patch: { title?: string; description?: string; image?: string; enabled?: boolean; flavorPool?: string; flavorPinned?: string }) => Promise<void>;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function uploadPortrait(gameId: string, folder: 'butler' | 'jester', file: File): Promise<string> {
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
      folder,
      filename: `games_${gameId}.${ext}`,
      imageData: base64,
      contentType: file.type || 'image/png',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return `${data.url}?v=${Date.now()}`;
}

export default function GameHero({ game, title, description, image, enabled, flavorPool, flavorPinned, triggers, allowedRoles, allowedChannels, updatedAt, onPatch }: Props) {
  const toast = useToast();
  const { fmtRel, absolute } = useTimezone();

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [descDraft, setDescDraft] = useState(description);
  const [poolDraft, setPoolDraft] = useState(flavorPool ?? '');
  const [pinnedDraft, setPinnedDraft] = useState(flavorPinned ?? '');
  const [flavorOpen, setFlavorOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setMounted(true), []);
  // Reset error state when the image URL changes (new portrait, retry)
  useEffect(() => setImgError(false), [image]);
  useEffect(() => setTitleDraft(title), [title]);
  useEffect(() => setDescDraft(description), [description]);
  useEffect(() => setPoolDraft(flavorPool ?? ''), [flavorPool]);
  useEffect(() => setPinnedDraft(flavorPinned ?? ''), [flavorPinned]);

  const canEditTitle = Boolean(game.nameKey);
  const canEditDesc  = Boolean(game.descKey);
  const canUpload    = Boolean(game.imageKey);
  const hasFlavor    = Boolean(game.flavor);
  const poolLineCount = poolDraft ? poolDraft.split('\n').filter((l) => l.trim()).length : 0;
  const flavorMode    = pinnedDraft.trim() ? 'pinned' : poolLineCount > 0 ? 'rotating' : 'default';

  const handleFile = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.show({ tone: 'error', title: 'Too large', message: 'Image must be under 4 MB.' });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadPortrait(game.id, game.bot, file);
      await onPatch({ image: url });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="av-games-hero av-vendor-hero" style={{ ['--vendor-tone' as any]: game.tone }}>
      <div className="av-vendor-portrait-wrap">
        <div className="av-vendor-portrait">
          {image && !imgError
            ? <img src={image} alt={title} key={image} onError={() => setImgError(true)} />
            : <div className="av-vendor-portrait-placeholder">{game.glyph}</div>}
          {uploading && <div className="av-vendor-uploading">Uploading…</div>}
        </div>
        {canUpload && (
          <>
            <button
              type="button"
              className="av-vendor-portrait-change"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <span aria-hidden="true">⬆</span> Change portrait
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>

      <div className="av-vendor-meta">
        {canEditTitle && editingTitle ? (
          <input
            className="av-vendor-title-edit"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              if (titleDraft !== title) onPatch({ title: titleDraft });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') { setTitleDraft(title); setEditingTitle(false); }
            }}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="av-vendor-title"
            onClick={canEditTitle ? () => setEditingTitle(true) : undefined}
            title={canEditTitle ? 'Click to rename' : 'Name is locked for this game — no nameKey configured in game-schema.ts'}
            disabled={!canEditTitle}
          >
            {title}
            <span className="av-vendor-title-id">{game.bot} · {game.id}</span>
          </button>
        )}

        {triggers !== undefined && (
          <TriggerPills triggers={triggers} enabled={enabled !== false} />
        )}

        {(allowedRoles !== undefined || allowedChannels !== undefined) && (
          <PermissionSummary
            allowedRoles={allowedRoles ?? []}
            allowedChannels={allowedChannels ?? []}
          />
        )}

        {canEditDesc && editingDesc ? (
          <textarea
            className="av-vendor-desc-edit"
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={() => {
              setEditingDesc(false);
              if (descDraft !== description) onPatch({ description: descDraft });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setDescDraft(description); setEditingDesc(false); }
            }}
            autoFocus
            rows={3}
          />
        ) : (
          <button
            type="button"
            className="av-vendor-desc"
            onClick={canEditDesc ? () => setEditingDesc(true) : undefined}
            disabled={!canEditDesc}
            title={canEditDesc ? 'Click to edit description' : undefined}
          >
            {description || (canEditDesc ? <em>Click to add a description…</em> : <em>{game.description}</em>)}
            {canEditDesc && <span className="av-vendor-edit-hint">✎ edit</span>}
          </button>
        )}

        {hasFlavor && (
          <div className="av-games-hero-flavor">
            <button
              type="button"
              className={`av-games-hero-flavor-head${flavorOpen ? ' av-games-hero-flavor-head--open' : ''}`}
              onClick={() => setFlavorOpen((v) => !v)}
              aria-expanded={flavorOpen}
            >
              <span className="av-games-hero-flavor-title">Flavor text</span>
              <span className={`av-games-hero-flavor-badge av-games-hero-flavor-badge--${flavorMode}`}>
                {flavorMode === 'pinned' && 'Pinned'}
                {flavorMode === 'rotating' && `${poolLineCount} rotating`}
                {flavorMode === 'default' && 'Built-in defaults'}
              </span>
              <span className="av-games-hero-flavor-chevron" aria-hidden="true">▾</span>
            </button>
            {flavorOpen && (
              <div className="av-games-hero-flavor-body">
                <label className="av-games-hero-flavor-label">Pool (one line per flavor)</label>
                <textarea
                  className="av-games-hero-flavor-textarea"
                  value={poolDraft}
                  onChange={(e) => setPoolDraft(e.target.value)}
                  onBlur={() => { if (poolDraft !== (flavorPool ?? '')) onPatch({ flavorPool: poolDraft }); }}
                  rows={4}
                  placeholder="One flavor per line. Empty = built-in defaults."
                />
                <label className="av-games-hero-flavor-label">Pinned (overrides pool when set)</label>
                <textarea
                  className="av-games-hero-flavor-textarea"
                  value={pinnedDraft}
                  onChange={(e) => setPinnedDraft(e.target.value)}
                  onBlur={() => { if (pinnedDraft !== (flavorPinned ?? '')) onPatch({ flavorPinned: pinnedDraft }); }}
                  rows={2}
                  placeholder="Leave empty to rotate the pool."
                />
              </div>
            )}
          </div>
        )}

        <div className="av-vendor-meta-foot">
          {updatedAt && mounted && (
            <span className="av-vendor-updated" title={absolute(updatedAt)}>
              Updated {fmtRel(updatedAt)}
            </span>
          )}
        </div>
      </div>

      {enabled !== null && (
        <div className="av-games-hero-enabled-wrap">
          <button
            type="button"
            className={`av-games-hero-enabled${enabled ? ' av-games-hero-enabled--on' : ''}`}
            onClick={() => onPatch({ enabled: !enabled })}
            aria-pressed={enabled}
          >
            <span className="av-games-hero-enabled-rail" />
            <span className="av-games-hero-enabled-knob" />
          </button>
          <span className="av-games-hero-enabled-label">
            {enabled ? 'Game ON — accepting players' : 'Game OFF — command returns a disabled message'}
          </span>
        </div>
      )}
    </section>
  );
}
