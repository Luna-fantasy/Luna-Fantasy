'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import { useFocusTrap } from '../_components/a11y';
import {
  STONE_TIERS, TIER_TONES,
  type StoneDef, type StoneTier,
} from '@/lib/admin/stones-v2-types';

interface Props {
  mode: 'create' | 'edit';
  initialTier: StoneTier;
  stone?: StoneDef;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function postAction(body: Record<string, unknown>): Promise<any> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/stones/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

async function uploadStoneImage(name: string, file: File): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsDataURL(file);
  });
  const data = await postAction({
    action: 'update_image',
    name,
    imageData: base64,
    contentType: file.type || 'image/png',
  });
  return data.imageUrl;
}

export default function StoneEditDialog({ mode, initialTier, stone, onClose, onSaved }: Props) {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();
  const [mounted, setMounted] = useState(false);

  const [tier, setTier] = useState<StoneTier>(stone?.tier ?? initialTier);
  const [name, setName] = useState(stone?.name ?? '');
  const [weight, setWeight] = useState<string>(String(stone?.weight ?? 1));
  const [sellPrice, setSellPrice] = useState<string>(String(stone?.sellPrice ?? 0));
  const [emojiId, setEmojiId] = useState(stone?.emojiId ?? '');
  const [imageUrl, setImageUrl] = useState(stone?.imageUrl ?? '');
  // Forbidden-only extras
  const [hint, setHint] = useState('');
  const [giftRoleId, setGiftRoleId] = useState('');
  const [giverTitle, setGiverTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => setMounted(true), []);
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleEscape = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useFocusTrap(dialogRef, mounted, handleEscape);

  if (!mounted) return null;

  const handleFile = async (file: File) => {
    if (!name.trim()) {
      toast.show({ tone: 'error', title: 'Name first', message: 'Set the stone name before uploading.' });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.show({ tone: 'error', title: 'Too large', message: 'Image must be under 4MB.' });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadStoneImage(name.trim(), file);
      setImageUrl(url);
      toast.show({ tone: 'success', title: 'Uploaded', message: 'Image saved to R2.' });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const w = Number(weight);
    const sp = Number(sellPrice);
    if (!name.trim()) { toast.show({ tone: 'error', title: 'Missing name', message: 'Required.' }); return; }
    if (!Number.isFinite(w) || w < 0) { toast.show({ tone: 'error', title: 'Bad weight', message: '≥ 0 required.' }); return; }
    if (!Number.isFinite(sp) || sp < 0) { toast.show({ tone: 'error', title: 'Bad price', message: '≥ 0 required.' }); return; }

    if (tier === 'forbidden' && mode === 'create') {
      if (!hint.trim()) { toast.show({ tone: 'error', title: 'Hint required', message: 'Forbidden stones need a hint.' }); return; }
      if (!/^\d{17,20}$/.test(giftRoleId.trim())) { toast.show({ tone: 'error', title: 'Bad gift role', message: 'gift_role_id must be a Discord role ID.' }); return; }
      if (!giverTitle.trim()) { toast.show({ tone: 'error', title: 'Title required', message: 'Forbidden stones need a giver title.' }); return; }
    }

    setBusy(true);
    const trimmedName = name.trim();
    const label = mode === 'create' ? `Create ${tier} stone: ${trimmedName}` : `Edit ${tier} stone: ${trimmedName}`;

    const ok = await pending.queue({
      label,
      detail: `weight ${w} · sell ${sp.toLocaleString()}`,
      delayMs: 4000,
      run: async () => {
        try {
          if (mode === 'create') {
            const stoneBody: Record<string, unknown> = {
              name: trimmedName,
              weight: w,
              sell_price: sp,
              emoji_id: emojiId.trim(),
              type: tier,
            };
            if (tier === 'forbidden') {
              stoneBody.hint = hint.trim();
              stoneBody.gift_role_id = giftRoleId.trim();
              stoneBody.giver_title = giverTitle.trim();
            }
            await postAction({ action: 'add_stone', stone: stoneBody });
            // Set image after creation if provided
            if (imageUrl) {
              // imageUrl was set via R2 upload — already attached on the doc
              // (update_image action wrote it directly). Nothing more to do.
            }
            undo.push({
              label: `Undo add: ${trimmedName}`,
              detail: tier,
              revert: async () => {
                await postAction({ action: 'delete_stone', name: trimmedName });
                await onSaved();
                toast.show({ tone: 'success', title: 'Reverted', message: `Removed ${trimmedName}` });
              },
            });
          } else {
            // Edit: update_stone only handles weight, sell_price, emoji_id
            await postAction({
              action: 'update_stone',
              name: trimmedName,
              weight: w,
              sell_price: sp,
              emoji_id: emojiId.trim(),
            });
          }
          await onSaved();
          toast.show({ tone: 'success', title: mode === 'create' ? 'Stone added' : 'Stone saved', message: trimmedName });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Failed', message: (e as Error).message });
        }
      },
    });
    setBusy(false);
    if (ok !== false) onClose();
  };

  return createPortal(
    <>
      <div className="av-peek-scrim" onClick={busy ? undefined : onClose} />
      <div ref={dialogRef} className="av-moddialog av-cardedit" role="dialog" aria-modal="true" aria-label={mode === 'create' ? 'Add stone' : 'Edit stone'}>
        <header>
          <div>
            <h3>{mode === 'create' ? 'Add New Stone' : `Edit: ${stone?.name ?? ''}`}</h3>
            <p>Stones live in <span className="av-moddialog-target">stones_config</span>.</p>
          </div>
          <button type="button" className="av-peek-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="av-moddialog-body">
          <label className="av-moddialog-field">
            <span>Tier</span>
            <select className="av-audit-input" value={tier} onChange={(e) => setTier(e.target.value as StoneTier)}>
              {STONE_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="av-moddialog-field">
            <span>Name</span>
            <input className="av-audit-input" placeholder="e.g. Lunar Stone" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <div className="av-cardedit-row">
            <label className="av-moddialog-field">
              <span>Drop weight</span>
              <input className="av-audit-input" type="number" min={0} value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
            <label className="av-moddialog-field">
              <span>Sell price (Lunari)</span>
              <input className="av-audit-input" type="number" min={0} value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
            </label>
          </div>
          <label className="av-moddialog-field">
            <span>Emoji ID (optional)</span>
            <input className="av-audit-input" placeholder="Discord emoji ID" value={emojiId} onChange={(e) => setEmojiId(e.target.value)} />
          </label>

          {tier === 'forbidden' && mode === 'create' && (
            <>
              <label className="av-moddialog-field">
                <span>Hint <strong>·</strong> required for forbidden</span>
                <input className="av-audit-input" placeholder="A clue to who might possess it" value={hint} onChange={(e) => setHint(e.target.value)} />
              </label>
              <div className="av-cardedit-row">
                <label className="av-moddialog-field">
                  <span>Gift role ID</span>
                  <input className="av-audit-input" placeholder="Discord role ID" value={giftRoleId} onChange={(e) => setGiftRoleId(e.target.value)} />
                </label>
                <label className="av-moddialog-field">
                  <span>Giver title</span>
                  <input className="av-audit-input" placeholder="e.g. The Bound One" value={giverTitle} onChange={(e) => setGiverTitle(e.target.value)} />
                </label>
              </div>
              <div className="av-moddialog-warn">
                <strong>Forbidden tier.</strong> These stones cannot be edited via the dashboard once created — they need a Discord role + giver title that bind permanently.
              </div>
            </>
          )}

          {mode === 'edit' && (
            <div className="av-cardedit-hint">
              Editing only updates weight, sell price, and emoji. Use the Replace image button below to change the image. To rename or move tier, delete and recreate.
            </div>
          )}
          <div className="av-moddialog-field">
            <span>Stone image</span>
            <div className="av-fw-image-row">
              <div className="av-fw-image-preview" style={{ ['--rarity-tone' as any]: TIER_TONES[tier] }}>
                {imageUrl ? (
                  <img src={imageUrl} alt="stone preview" onError={(e) => (e.currentTarget.style.opacity = '0.3')} />
                ) : (
                  <div className="av-fw-image-empty">
                    <span>No image</span>
                    <small>Click Replace to upload</small>
                  </div>
                )}
              </div>
              <div className="av-fw-image-actions">
                <label className="av-btn av-btn-primary av-cardedit-upload-label" aria-disabled={uploading}>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                  />
                  {uploading ? 'Uploading…' : (imageUrl ? '↑ Replace image' : '↑ Upload image')}
                </label>
                {imageUrl && (
                  <button
                    type="button"
                    className="av-btn av-btn-ghost"
                    onClick={() => setImageUrl('')}
                    disabled={uploading}
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>
            <input
              className="av-audit-input"
              style={{ marginTop: 8 }}
              placeholder="…or paste a URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={uploading}
            />
          </div>
        </div>
        <footer>
          <button type="button" className="av-btn av-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="av-btn av-btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Applying…' : mode === 'create' ? 'Queue · Add stone' : 'Queue · Save changes'}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
