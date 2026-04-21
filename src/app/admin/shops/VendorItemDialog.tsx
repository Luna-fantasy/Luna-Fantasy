'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../_components/Toast';
import RolePicker from '../_components/RolePicker';
import { useFocusTrap } from '../_components/a11y';

export interface VendorItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  roleId?: string;
  type?: string;
  gradientColors?: string[];
}

interface Props {
  tone: string;
  mode: 'create' | 'edit';
  vendorId: string;
  initial?: VendorItem;
  onSave: (item: VendorItem) => Promise<void> | void;
  onClose: () => void;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function uploadItemImage(vendorId: string, itemId: string, file: File): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsDataURL(file);
  });
  const token = await fetchCsrf();
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const safeId = itemId.replace(/[^a-z0-9_-]/gi, '_');
  // Mells = profiles folder; Brimor/Broker = shops folder; default to shops
  const folder = vendorId === 'mells_selvair' ? 'profiles' : 'shops';
  const res = await fetch('/api/admin/v2/r2/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({
      folder,
      filename: `${vendorId}_${safeId}.${ext}`,
      imageData: base64,
      contentType: file.type || 'image/png',
    }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  const data = await res.json();
  return `${data.url}?v=${Date.now()}`;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

const SUGGESTED_TYPES = ['profile', 'rank', 'game_ability', 'cosmetic', 'role'];

export default function VendorItemDialog({ tone, mode, vendorId, initial, onSave, onClose }: Props) {
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [id, setId] = useState(initial?.id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState<string>(String(initial?.price ?? 0));
  const [description, setDescription] = useState(initial?.description ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [roleId, setRoleId] = useState(initial?.roleId ?? '');
  const [type, setType] = useState(initial?.type ?? '');
  const [gradA, setGradA] = useState(initial?.gradientColors?.[0] ?? '');
  const [gradB, setGradB] = useState(initial?.gradientColors?.[1] ?? '');

  // Auto-derive id from name on create
  useEffect(() => {
    if (mode === 'create' && name && !id) setId(slugify(name));
  }, [name, mode, id]);

  useEffect(() => setMounted(true), []);
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleEscape = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useFocusTrap(dialogRef, mounted, handleEscape);

  if (!mounted) return null;

  const handleFile = async (file: File) => {
    const useId = id || slugify(name) || `item_${Date.now()}`;
    if (file.size > 4 * 1024 * 1024) {
      toast.show({ tone: 'error', title: 'Too large', message: 'Image must be under 4MB.' });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadItemImage(vendorId, useId, file);
      setImageUrl(url);
      toast.show({ tone: 'success', title: 'Uploaded', message: 'Image saved to R2.' });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!name.trim()) { toast.show({ tone: 'error', title: 'Missing name', message: 'Required.' }); return; }
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) { toast.show({ tone: 'error', title: 'Bad price', message: 'Must be a non-negative number.' }); return; }

    setBusy(true);
    const item: VendorItem = {
      id: id.trim() || slugify(name),
      name: name.trim(),
      price: parsedPrice,
      ...(description.trim() && { description: description.trim() }),
      ...(imageUrl.trim() && { imageUrl: imageUrl.trim() }),
      ...(roleId.trim() && { roleId: roleId.trim() }),
      ...(type.trim() && { type: type.trim() }),
      ...(gradA && gradB && { gradientColors: [gradA, gradB] }),
    };

    try {
      await onSave(item);
    } catch (e) {
      toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const previewStyle: React.CSSProperties = gradA && gradB
    ? { background: `linear-gradient(135deg, ${gradA}, ${gradB})` }
    : {};

  return createPortal(
    <>
      <div className="av-peek-scrim" onClick={busy ? undefined : onClose} />
      <div ref={dialogRef} className="av-itemdialog" role="dialog" aria-modal="true" aria-label={mode === 'create' ? 'Add item' : 'Edit item'}
        style={{ ['--vendor-tone' as any]: tone }}>
        <header className="av-itemdialog-head">
          <div>
            <h3>{mode === 'create' ? 'New item' : `Edit · ${initial?.name}`}</h3>
            <p>Saved to <code>vendor_config/{vendorId}.items</code> with the 5-second cancel window.</p>
          </div>
          <button type="button" className="av-peek-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="av-itemdialog-body">
          {/* Visual preview at top */}
          <div className="av-itemdialog-preview">
            <div className="av-itemdialog-preview-img" style={previewStyle}>
              {imageUrl
                ? <img src={imageUrl} alt="" key={imageUrl} />
                : (gradA && gradB) ? null
                : <span>{(name || '?').slice(0, 1)}</span>}
            </div>
            <div className="av-itemdialog-preview-meta">
              <strong>{name || 'Untitled item'}</strong>
              <span>{Number(price).toLocaleString()} Lunari</span>
              {description && <em>{description}</em>}
            </div>
          </div>

          <div className="av-itemdialog-fields">
            <label className="av-shopf-field">
              <span>Name</span>
              <input className="av-shopf-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Visible to players" autoFocus />
            </label>

            <label className="av-shopf-field">
              <span>Item ID <small>· internal slug</small></span>
              <input className="av-shopf-input av-shopf-input--mono" value={id} onChange={(e) => setId(e.target.value)} placeholder="auto from name" disabled={mode === 'edit'} />
            </label>

            <label className="av-shopf-field">
              <span>Price <small>· Lunari</small></span>
              <input className="av-shopf-input av-shopf-input--num" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>

            <label className="av-shopf-field av-shopf-field--full">
              <span>Description</span>
              <textarea className="av-shopf-input" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Shown to players in the shop" />
            </label>

            <div className="av-shopf-field av-shopf-field--full">
              <span>Image</span>
              <div className="av-shopf-uploader">
                <label className="av-cardedit-upload">
                  <input type="file" accept="image/*" disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                  <span>{uploading ? 'Uploading…' : '⬆ Upload to R2'}</span>
                </label>
                <input className="av-shopf-input" placeholder="…or paste an image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              </div>
            </div>

            <label className="av-shopf-field">
              <span>Discord role reward <small>· optional</small></span>
              <RolePicker
                value={roleId}
                onChange={(id) => setRoleId(id)}
                placeholder="Pick a role reward"
                hideFallback
              />
            </label>

            <label className="av-shopf-field">
              <span>Type tag <small>· optional grouping</small></span>
              <input className="av-shopf-input" list="vendor-item-types" value={type} onChange={(e) => setType(e.target.value)} placeholder="profile, rank, ability…" />
              <datalist id="vendor-item-types">
                {SUGGESTED_TYPES.map((t) => <option key={t} value={t} />)}
              </datalist>
            </label>

            <div className="av-shopf-field av-shopf-field--full">
              <span>Gradient colors <small>· two hex values for cosmetic role tiles (no image)</small></span>
              <div className="av-shopf-grad-row">
                <div className="av-shopf-grad-input">
                  <input
                    type="color"
                    value={gradA || '#000000'}
                    onChange={(e) => setGradA(e.target.value)}
                  />
                  <input
                    className="av-shopf-input av-shopf-input--mono"
                    value={gradA}
                    onChange={(e) => setGradA(e.target.value)}
                    placeholder="#e138ea"
                  />
                </div>
                <div className="av-shopf-grad-input">
                  <input
                    type="color"
                    value={gradB || '#000000'}
                    onChange={(e) => setGradB(e.target.value)}
                  />
                  <input
                    className="av-shopf-input av-shopf-input--mono"
                    value={gradB}
                    onChange={(e) => setGradB(e.target.value)}
                    placeholder="#3af3b5"
                  />
                </div>
                {(gradA || gradB) && (
                  <button type="button" className="av-shop-item-action" onClick={() => { setGradA(''); setGradB(''); }} title="Clear gradient">×</button>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="av-itemdialog-foot">
          <button type="button" className="av-btn av-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="av-btn av-btn-primary" onClick={submit} disabled={busy || uploading}>
            {busy ? 'Saving…' : mode === 'create' ? 'Add item' : 'Save changes'}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
