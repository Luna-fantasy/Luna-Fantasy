'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import { useFocusTrap } from '../_components/a11y';
import { RARITY_ORDER, RARITY_TONES, type CardDef, type Rarity } from '@/lib/admin/cards-v2-types';

type Mode = 'create' | 'edit';

interface Props {
  mode: Mode;
  initialRarity: Rarity;
  card?: CardDef;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  if (!res.ok) throw new Error('CSRF fetch failed');
  const data = await res.json();
  return data.token;
}

async function getRarityItems(rarity: Rarity): Promise<any[]> {
  const res = await fetch('/api/admin/cards/config', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load config: ${res.status}`);
  const data = await res.json();
  const bucket = data?.cards?.[rarity] ?? data?.[rarity] ?? [];
  return Array.isArray(bucket) ? bucket : [];
}

async function putRarityItems(rarity: Rarity, items: any[]): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/cards/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify({ rarity, items }),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

export default function CardEditDialog({ mode, initialRarity, card, onClose, onSaved }: Props) {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();
  const [mounted, setMounted] = useState(false);

  const [rarity, setRarity] = useState<Rarity>(card?.rarity ?? initialRarity);
  const [name, setName] = useState(card?.name ?? '');
  const [attack, setAttack] = useState<string>(String(card?.attack ?? 0));
  const [weight, setWeight] = useState<string>(String(card?.weight ?? 1));
  const [imageUrl, setImageUrl] = useState(card?.imageUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleEscape = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useFocusTrap(dialogRef, mounted, handleEscape);

  if (!mounted) return null;

  const handleFileUpload = async (file: File) => {
    if (!name.trim()) {
      toast.show({ tone: 'error', title: 'Name first', message: 'Set a card name before uploading an image — it determines the R2 filename.' });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.show({ tone: 'error', title: 'Too large', message: 'Image must be under 4MB.' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.show({ tone: 'error', title: 'Bad file', message: 'Pick an image file (PNG, JPG, WEBP).' });
      return;
    }

    setUploading(true);
    setUploadProgress('Reading file…');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] ?? ''); // strip data:image/...;base64, prefix
        };
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });

      setUploadProgress('Uploading to R2…');
      const token = await fetchCsrf();
      const res = await fetch('/api/admin/cards/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        credentials: 'include',
        body: JSON.stringify({
          action: 'upload_image_only',
          rarity,
          cardName: name.trim(),
          imageData: base64,
          contentType: file.type,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setImageUrl(data.imageUrl);
      toast.show({ tone: 'success', title: 'Uploaded', message: 'Image saved to R2 — remember to save the card to attach it.' });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const submit = async () => {
    const parsedAttack = Number(attack);
    const parsedWeight = Number(weight);
    if (!name.trim()) { toast.show({ tone: 'error', title: 'Missing name', message: 'Name is required.' }); return; }
    if (!Number.isFinite(parsedAttack) || parsedAttack < 0) { toast.show({ tone: 'error', title: 'Bad attack', message: 'Attack must be a non-negative number.' }); return; }
    if (!Number.isFinite(parsedWeight) || parsedWeight < 0) { toast.show({ tone: 'error', title: 'Bad weight', message: 'Weight must be a non-negative number.' }); return; }

    setBusy(true);

    const newItem = {
      name: name.trim(),
      rarity,
      attack: parsedAttack,
      weight: parsedWeight,
      imageUrl: imageUrl.trim(),
    };

    const label = mode === 'create' ? `Create ${rarity} card: ${newItem.name}` : `Edit ${rarity} card: ${newItem.name}`;

    const ok = await pending.queue({
      label,
      detail: `attack ${parsedAttack} · weight ${parsedWeight}`,
      delayMs: 4000,
      run: async () => {
        try {
          // If rarity changed on edit, need to remove from old AND add to new
          const oldRarity = card?.rarity;
          if (mode === 'edit' && oldRarity && oldRarity !== rarity) {
            const oldItems = await getRarityItems(oldRarity);
            const filtered = oldItems.filter((c: any) => c.name !== card!.name);
            await putRarityItems(oldRarity, filtered);
          }

          const currentItems = await getRarityItems(rarity);
          const filtered = currentItems.filter((c: any) => c.name !== (card?.name ?? newItem.name));
          const next = mode === 'create' || (oldRarity && oldRarity !== rarity)
            ? [...filtered, newItem]
            : filtered.map((c: any) => c.name === card?.name ? { ...c, ...newItem } : c).concat(
              filtered.some((c: any) => c.name === card?.name) ? [] : [newItem]
            );

          await putRarityItems(rarity, next);
          await onSaved();
          toast.show({ tone: 'success', title: mode === 'create' ? 'Card added' : 'Card saved', message: newItem.name });

          // Register undo for create (removes the card)
          if (mode === 'create') {
            undo.push({
              label: `Undo add: ${newItem.name}`,
              detail: `${rarity}`,
              revert: async () => {
                const cur = await getRarityItems(rarity);
                await putRarityItems(rarity, cur.filter((c: any) => c.name !== newItem.name));
                await onSaved();
                toast.show({ tone: 'success', title: 'Reverted', message: `Removed ${newItem.name}` });
              },
            });
          }
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
      <div ref={dialogRef} className="av-moddialog av-cardedit" role="dialog" aria-modal="true" aria-label={mode === 'create' ? 'Add card' : 'Edit card'}>
        <header>
          <div>
            <h3>{mode === 'create' ? 'Add New Card' : `Edit: ${card?.name ?? ''}`}</h3>
            <p>Changes apply to <span className="av-moddialog-target">cards_config</span> and propagate live to both bots.</p>
          </div>
          <button type="button" className="av-peek-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="av-moddialog-body">
          <label className="av-moddialog-field">
            <span>Rarity</span>
            <select
              className="av-audit-input"
              value={rarity}
              onChange={(e) => setRarity(e.target.value as Rarity)}
            >
              {RARITY_ORDER.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <label className="av-moddialog-field">
            <span>Name</span>
            <input
              className="av-audit-input"
              placeholder="e.g. Luna Seer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>

          <div className="av-cardedit-row">
            <label className="av-moddialog-field">
              <span>Attack</span>
              <input
                className="av-audit-input"
                type="number"
                min={0}
                value={attack}
                onChange={(e) => setAttack(e.target.value)}
              />
            </label>
            <label className="av-moddialog-field">
              <span>Drop weight</span>
              <input
                className="av-audit-input"
                type="number"
                min={0}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </label>
          </div>

          <div className="av-moddialog-field">
            <span>Card image</span>
            <div className="av-cardedit-uploader">
              <label className="av-cardedit-upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = ''; // reset so same file can be reselected
                  }}
                  disabled={uploading}
                />
                <span>{uploading ? (uploadProgress ?? 'Uploading…') : '⬆ Upload to R2'}</span>
              </label>
              <input
                className="av-audit-input"
                placeholder="…or paste a URL"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
          </div>

          {imageUrl && (
            <div className="av-cardedit-preview" style={{ ['--rarity-tone' as any]: RARITY_TONES[rarity] }}>
              <img src={imageUrl} alt="preview" onError={(e) => (e.currentTarget.style.display = 'none')} />
            </div>
          )}

          <div className="av-cardedit-hint">
            Weight is relative to the rarity pool. Higher weight = more likely to drop in that tier.
            Uploaded images go to <code>cards/{'{Rarity}'}/{'{Name}'}.png</code> on R2 — same file replaces the previous one if you re-upload with the same card name.
          </div>
        </div>
        <footer>
          <button type="button" className="av-btn av-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="av-btn av-btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Applying…' : mode === 'create' ? 'Queue · Add card' : 'Queue · Save changes'}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}

/** Helper to delete a card — wired up by the detail drawer. */
export async function deleteCard(card: CardDef): Promise<void> {
  const currentItems = await getRarityItems(card.rarity);
  const next = currentItems.filter((c: any) => c.name !== card.name);
  await putRarityItems(card.rarity, next);
}

/** Helper to re-add a card — used as the Undo reverse for delete. */
export async function reAddCard(card: CardDef): Promise<void> {
  const currentItems = await getRarityItems(card.rarity);
  if (currentItems.some((c: any) => c.name === card.name)) return;
  await putRarityItems(card.rarity, [...currentItems, {
    name: card.name,
    rarity: card.rarity,
    attack: card.attack,
    weight: card.weight,
    imageUrl: card.imageUrl ?? '',
  }]);
}
