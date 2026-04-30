'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import { useFocusTrap } from '../_components/a11y';
import { RARITY_ORDER, RARITY_TONES, type CardDef, type Rarity } from '@/lib/admin/cards-v2-types';
import { withBust, useBustVersion } from '@/lib/admin/cache-bust';

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

/**
 * Fetch the canonical card list for a given rarity. The API actually returns
 * { rarities: [{ rarity, items[] }], factionWar }. The previous version of
 * this function checked `data.cards[rarity]` and `data[rarity]` — neither of
 * which exist on the response — so it always returned an empty array. Combined
 * with putRarityItems writing whatever array the caller passed, that meant a
 * single edit nuked every other card in the rarity. Catastrophic data loss.
 *
 * This version reads the actual `rarities[]` shape and throws loudly if it's
 * missing, so we never silently turn an edit into a wipe.
 */
async function getRarityItems(rarity: Rarity): Promise<any[]> {
  const res = await fetch('/api/admin/cards/config', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load config: ${res.status}`);
  const data = await res.json();

  if (!Array.isArray(data?.rarities)) {
    throw new Error(
      'Cards config response is missing the `rarities` array. Refusing to ' +
      'continue — proceeding without the existing items would overwrite the ' +
      'rarity with only the edited card.',
    );
  }

  const bucket = data.rarities.find((r: any) => r?.rarity === rarity);
  // It IS legal for a rarity to have zero items (e.g. fresh install), so we
  // distinguish "rarity not present in response" (suspicious — refuse) vs
  // "rarity present, items=[]" (legitimate).
  if (!bucket) {
    // Empty rarity is fine; the API simply omits empty rarity docs from the
    // result. Treat as empty list so create flow still works.
    return [];
  }
  return Array.isArray(bucket.items) ? bucket.items : [];
}

async function putRarityItems(rarity: Rarity, items: any[]): Promise<void> {
  // Defence-in-depth: refuse to PUT a single-item array unless the caller
  // confirms via the `force` flag. The bug we just hit overwrote a 25-card
  // rarity with [editedCard]; this guard makes that exact failure mode
  // impossible to ship by accident again. Genuine "delete down to 1 card"
  // operations can pass force=true through a future API param if ever needed.
  if (!Array.isArray(items)) {
    throw new Error('putRarityItems: items must be an array');
  }
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
  const [dragActive, setDragActive] = useState(false);
  const { bustVersion, bump } = useBustVersion();

  useEffect(() => setMounted(true), []);
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleEscape = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useFocusTrap(dialogRef, mounted, handleEscape);

  // Drag enter/leave counter — fixes the flicker bug where dragLeave fires
  // every time the cursor crosses over a child element (the preview img, the
  // overlay text, etc.), which toggled dragActive off mid-drag and sometimes
  // made drops miss entirely. We count enters vs leaves; only when the count
  // returns to 0 do we treat the drag as "left".
  //
  // CRITICAL: these hooks MUST stay above the `if (!mounted)` early return.
  // Adding hooks after the return crashes React with "Rendered more hooks
  // than during the previous render" once `mounted` flips true.
  const dragCounter = useRef(0);
  const handleDialogDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (uploading) return;
    if (e.dataTransfer.types?.includes('Files')) {
      dragCounter.current += 1;
      setDragActive(true);
    }
  }, [uploading]);
  const handleDialogDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragActive(false);
  }, []);
  const handleDialogDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

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
      bump();

      // Auto-persist on edit. The user dragged a new image expecting the
      // card to update — they shouldn't also have to click Save. For new
      // cards (mode === 'create') we still require Save because attack /
      // weight haven't been confirmed yet.
      if (mode === 'edit' && card) {
        setUploadProgress('Saving card…');
        try {
          const items = await getRarityItems(card.rarity);
          const next = items.map((c: any) =>
            c.name === card.name
              ? { ...c, imageUrl: data.imageUrl }
              : c,
          );
          // If the card somehow isn't in the rarity (e.g. mid-rename), fall
          // through to the manual Save flow. Don't push, that risks
          // duplicating it.
          if (next.some((c: any) => c.name === card.name)) {
            await putRarityItems(card.rarity, next);
            toast.show({ tone: 'success', title: 'Replaced', message: `${card.name} now uses the new image.` });
            await onSaved();
          } else {
            toast.show({ tone: 'info', title: 'Uploaded', message: 'Image staged — click Save to attach.' });
          }
        } catch (saveErr) {
          toast.show({
            tone: 'error',
            title: 'Auto-save failed',
            message: `Image is on R2 but the card record didn't update: ${(saveErr as Error).message}. Click Save to retry.`,
          });
        }
      } else {
        toast.show({ tone: 'success', title: 'Uploaded', message: 'Image staged — click Save to attach.' });
      }
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

    // delayMs: 0 — submit immediately. The 4s "pending action" buffer was
    // designed for undo-on-misclick, but it makes bulk uploads (180 cards)
    // intolerable. Each Save now goes straight through; the wipe-guard +
    // 409 protection at the API layer is the real safety net, not the UI delay.
    const ok = await pending.queue({
      label,
      detail: `attack ${parsedAttack} · weight ${parsedWeight}`,
      delayMs: 0,
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

  // handleDialogDrop is a plain function (not a useCallback) because it
  // closes over `handleFileUpload`, which itself is a non-hook function
  // declared *after* the early return. We can't useCallback it without
  // restructuring the whole component. A plain function recreated each
  // render is fine — no descendants depend on its identity.
  const handleDialogDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragActive(false);
    if (uploading) return;
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
    if (file) handleFileUpload(file);
  };

  return createPortal(
    <>
      <div className="av-peek-scrim" onClick={busy ? undefined : onClose} />
      <div
        ref={dialogRef}
        className="av-moddialog av-cardedit"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'create' ? 'Add card' : 'Edit card'}
        // Drop targeting moved to the dialog root so dropping anywhere in
        // the modal works — even on the form fields. Previously the user
        // had to land precisely on the dropzone, and crossing onto the
        // preview img killed the dragActive flag.
        onDragEnter={handleDialogDragEnter}
        onDragLeave={handleDialogDragLeave}
        onDragOver={handleDialogDragOver}
        onDrop={handleDialogDrop}
      >
        <header>
          <div>
            <h3>{mode === 'create' ? 'Add New Card' : `Edit: ${card?.name ?? ''}`}</h3>
            <p>Changes apply to <span className="av-moddialog-target">cards_config</span> and propagate live to both bots.</p>
          </div>
          <button type="button" className="av-peek-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="av-moddialog-body av-cardedit-body">
          {/* LEFT: image dropzone + buttons (vertical, fills column) */}
          <div className="av-cardedit-imgcol">
            <div
              // Drag handlers moved up to the dialog root — see
              // handleDialogDrop. The dropzone is now purely visual; any drop
              // anywhere in the modal triggers the upload, removing the need
              // to land on this exact element.
              className={`av-cardedit-dropzone${dragActive ? ' av-cardedit-dropzone--drag' : ''}${uploading ? ' av-cardedit-dropzone--busy' : ''}`}
              style={{ ['--rarity-tone' as any]: RARITY_TONES[rarity] }}
            >
              {imageUrl ? (
                <div className="av-cardedit-dropzone-preview">
                  <img
                    key={`${imageUrl}-${bustVersion}`}
                    src={withBust(imageUrl, bustVersion)}
                    alt="preview"
                    onError={(e) => (e.currentTarget.style.opacity = '0.3')}
                  />
                  <div className="av-cardedit-dropzone-overlay">
                    <strong>{dragActive ? 'Drop to replace' : 'Drag a new image to replace'}</strong>
                    <span>or use the buttons below</span>
                  </div>
                </div>
              ) : (
                <div className="av-cardedit-dropzone-empty">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                  <strong>{dragActive ? 'Drop image to upload' : 'Drag image here'}</strong>
                  <span>PNG / JPG / WEBP, up to 4MB</span>
                </div>
              )}
            </div>

            <div className="av-cardedit-uploader">
              <label className="av-cardedit-upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = '';
                  }}
                  disabled={uploading}
                />
                <span>{uploading ? (uploadProgress ?? 'Uploading…') : (imageUrl ? '⟲ Replace from file' : '⬆ Upload from file')}</span>
              </label>
              {imageUrl && (
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => { setImageUrl(''); bump(); }}
                  disabled={uploading}
                >
                  ✕ Clear
                </button>
              )}
            </div>
            <input
              className="av-audit-input"
              placeholder="…or paste a URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          {/* RIGHT: stats + form fields */}
          <div className="av-cardedit-fieldcol">
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

            <div className="av-cardedit-hint">
              Weight is relative to the rarity pool. Higher weight = more likely to drop in that tier.
              Uploaded images go to <code>cards/{'{Rarity}'}/{'{Name}'}.png</code> on R2 — same file replaces the previous one if you re-upload with the same card name.
            </div>
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
