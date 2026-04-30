'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onButtonKey } from '../_components/a11y';
import { usePendingAction } from '../_components/PendingActionProvider';
import { useToast } from '../_components/Toast';
import {
  PROPERTY_TIERS, RARITIES, ITEM_CATEGORIES,
  type ItemCatalogEntry, type PropertyCatalogEntry,
  type UserPropertyRow, type PropertyTier, type Rarity, type ItemCategory,
} from '@/lib/admin/valecroft-types';
import FamilyHomePanel from './FamilyHomePanel';

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

type Tab = 'family' | 'properties' | ItemCategory | 'ownership';
const TABS: { key: Tab; label: string }[] = [
  { key: 'family',     label: 'Family & Home' },
  { key: 'properties', label: 'Properties' },
  { key: 'artifact',   label: 'Artifacts' },
  { key: 'horse',      label: 'Horses' },
  { key: 'sword',      label: 'Swords' },
  { key: 'ownership',  label: 'Ownership' },
];

export default function ValecroftClient() {
  const [tab, setTab] = useState<Tab>('family');

  return (
    <section className="av-surface" style={{ padding: 24, marginTop: 24 }}>
      <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {TABS.map(t => (
          <div
            key={t.key}
            role="tab"
            tabIndex={0}
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            onKeyDown={onButtonKey(() => setTab(t.key))}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              cursor: 'pointer',
              background: tab === t.key ? 'rgba(91, 108, 255, 0.2)' : 'rgba(255,255,255,0.03)',
              border: tab === t.key ? '1px solid rgba(91, 108, 255, 0.6)' : '1px solid rgba(255,255,255,0.08)',
              userSelect: 'none',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {tab === 'family' && <FamilyHomePanel />}
      {tab === 'properties' && <PropertiesTab />}
      {(tab === 'artifact' || tab === 'horse' || tab === 'sword') && <ItemsTab category={tab} />}
      {tab === 'ownership' && <OwnershipTab />}
    </section>
  );
}

// ── Properties Tab ──

function PropertiesTab() {
  const [rows, setRows] = useState<PropertyCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<PropertyCatalogEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/v2/valecroft/properties', { cache: 'no-store' });
      const data = await res.json();
      setRows(data.rows ?? []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const pending = usePendingAction();
  const toast = useToast();

  function doDelete(key: string) {
    pending.queue({
      label: `Delete property "${key}"`,
      detail: "Won't succeed if someone currently owns it",
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        const token = await fetchCsrf();
        const res = await fetch(`/api/admin/v2/valecroft/properties/${encodeURIComponent(key)}`, {
          method: 'DELETE',
          headers: { 'x-csrf-token': token },
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setMsg(data.error || `Failed (${res.status})`); toast.show({ tone: 'error', title: 'Delete failed', message: data.error || `HTTP ${res.status}` }); return; }
        setMsg(`Deleted "${key}"`);
        toast.show({ tone: 'success', title: 'Deleted', message: key });
        refresh();
      },
    });
  }

  return (
    <div>
      {msg && <div style={{ padding: 10, marginBottom: 12, borderRadius: 8, background: 'rgba(91,108,255,0.12)' }}>{msg}</div>}

      <button
        onClick={() => { setCreating(true); setEditing(null); }}
        style={btnPrimary}
      >+ New Property</button>

      {(creating || editing) && (
        <PropertyForm
          initial={editing ?? undefined}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); refresh(); }}
        />
      )}

      {loading ? <p style={{ opacity: 0.7 }}>Loading...</p> :
        rows.length === 0 ? <p style={{ opacity: 0.7 }}>No properties yet — click "+ New Property".</p> : (
        <table style={tableStyle}>
          <thead><tr>
            <th style={th}>Name</th><th style={th}>Tier</th><th style={th}>Price</th><th style={th}>Base Income</th><th style={th}>Active</th><th style={th}>Actions</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} style={tr}>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {r.image_url
                      ? <img src={r.image_url} alt="" width={120} height={90} style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }} />
                      : <div style={{ width: 120, height: 90, borderRadius: 8, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
                    }
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 15 }}>{r.name}</div>
                      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{r.key}</div>
                    </div>
                  </div>
                </td>
                <td style={td}>{r.tier}</td>
                <td style={td}>{r.price.toLocaleString()}</td>
                <td style={td}>{r.base_income.toLocaleString()}</td>
                <td style={td}>{r.active ? '✓' : '—'}</td>
                <td style={td}>
                  <button style={btnSecondary} onClick={() => setEditing(r)}>Edit</button>
                  <button style={btnDanger} onClick={() => doDelete(r.key)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Reusable image drop / upload field. Uploads via /api/admin/assets/presign
// to R2 directly, then reports the public URL back to the parent through
// onChange. Supports drag-drop, click-to-upload, replace, and clear.
// Pasting a URL into the textbox at the bottom still works.
function ImageDropField({ value, onChange, folder, filenameHint, disabledHint }: {
    value: string;
    onChange: (next: string) => void;
    folder: 'valecroft/properties' | 'valecroft/items';
    filenameHint: string;
    disabledHint?: string | null;
}) {
    const [uploading, setUploading] = useState(false);
    const [drag, setDrag] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const dragTimeout = useRef<number | null>(null);
    const uploadId = useRef(0);

    const handleUpload = async (file: File) => {
        if (disabledHint) { setErr(disabledHint); return; }
        if (!filenameHint.trim()) { setErr('Set a name/key first — the upload key uses it.'); return; }
        const myId = ++uploadId.current;
        setErr(null);
        setUploading(true);
        try {
            const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
            const key = `${folder}/${filenameHint}.${ext === 'jpeg' ? 'jpeg' : ext}`;
            const token = await fetchCsrf();
            const presignRes = await fetch('/api/admin/assets/presign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
                credentials: 'include',
                body: JSON.stringify({ key, contentType: file.type || 'image/png', size: file.size }),
            });
            const presignData = await presignRes.json().catch(() => ({}));
            if (!presignRes.ok) {
                if (presignRes.status === 429) {
                    const wait = Math.ceil((presignData?.retryAfterMs ?? 1000) / 1000);
                    throw new Error(`Rate limited — wait ${wait}s before next upload`);
                }
                throw new Error(presignData?.error ?? `Presign failed (${presignRes.status})`);
            }
            const putRes = await fetch(presignData.presignedUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type || 'image/png' },
                body: file,
            });
            if (!putRes.ok) throw new Error(`R2 upload failed: ${putRes.status}`);
            if (myId !== uploadId.current) return;
            const publicUrl = `${presignData.publicUrl}?v=${Date.now()}`;
            onChange(publicUrl);
        } catch (e: any) {
            if (myId === uploadId.current) setErr(e?.message ?? 'Upload failed');
        } finally {
            if (myId === uploadId.current) setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (!e.dataTransfer.types?.includes('Files')) return;
        e.dataTransfer.dropEffect = 'copy';
        if (!drag) setDrag(true);
        if (dragTimeout.current) window.clearTimeout(dragTimeout.current);
        dragTimeout.current = window.setTimeout(() => setDrag(false), 150);
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (dragTimeout.current) { window.clearTimeout(dragTimeout.current); dragTimeout.current = null; }
        setDrag(false);
        const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
        if (file) void handleUpload(file);
    };

    return (
        <div>
            <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                style={{
                    border: drag ? '2px dashed rgba(91,108,255,0.85)' : '2px dashed rgba(255,255,255,0.18)',
                    background: drag ? 'rgba(91,108,255,0.08)' : 'rgba(0,0,0,0.25)',
                    borderRadius: 12,
                    minHeight: 220,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', cursor: 'pointer',
                    transition: 'border-color .15s, background .15s',
                    position: 'relative',
                }}
            >
                {value ? (
                    <>
                        <img src={value} alt="" style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain' }} />
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.7) 100%)',
                            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                            padding: 12, gap: 8,
                            opacity: drag || uploading ? 1 : 0,
                            transition: 'opacity .15s',
                            pointerEvents: 'none',
                        }}>
                            <span style={{ color: '#f1f5ff', fontSize: 13, fontWeight: 500 }}>
                                {uploading ? 'Uploading…' : (drag ? 'Drop to replace' : '')}
                            </span>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', color: '#88a0c8', fontSize: 13, padding: 24 }}>
                        <div style={{ fontSize: 36, marginBottom: 6, opacity: 0.5 }}>↑</div>
                        <div style={{ color: '#f1f5ff', fontWeight: 500 }}>{drag ? 'Drop image to upload' : 'Drag image here, or click to browse'}</div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>PNG / JPG / WEBP — uploads to R2 automatically</div>
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" style={btnSecondary} onClick={() => fileRef.current?.click()} disabled={uploading || !!disabledHint}>
                    {uploading ? 'Uploading…' : (value ? '⟲ Replace' : '↑ Upload')}
                </button>
                {value && (
                    <button type="button" style={btnSecondary} onClick={() => { onChange(''); }} disabled={uploading}>
                        Clear
                    </button>
                )}
                <input
                    style={{ ...inp, flex: 1, minWidth: 240 }}
                    placeholder="…or paste an image URL"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    disabled={uploading}
                />
            </div>
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) void handleUpload(f); }}
            />
            {disabledHint && <div style={{ fontSize: 11, color: '#f7b500', marginTop: 6 }}>{disabledHint}</div>}
            {err && <div style={{ ...errBox, marginTop: 8 }}>{err}</div>}
        </div>
    );
}

// Slugifier identical to the API side so the user can preview the key
// the upload will use before they drop a file.
function slugify(s: string): string {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

function PropertyForm({ initial, onClose, onSaved }: {
  initial?: PropertyCatalogEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [key, setKey] = useState(initial?.key ?? '');
  const [tier, setTier] = useState<PropertyTier>(initial?.tier ?? 'shack');
  const [price, setPrice] = useState(String(initial?.price ?? 1000000));
  const [base_income, setBaseIncome] = useState(String(initial?.base_income ?? 0));
  const [image_url, setImageUrl] = useState(initial?.image_url ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [active, setActive] = useState(initial?.active !== false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Resolved key for the R2 upload path. In edit mode the key is locked
  // to the existing one; in create mode we use the user-typed key, or
  // slugify the name as a preview.
  const resolvedKey = isEdit ? initial!.key : (key.trim() ? slugify(key) : slugify(name));
  const uploadDisabledHint = !resolvedKey ? 'Type a name first — it becomes the upload filename.' : null;

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const token = await fetchCsrf();
      const body = {
        name, key: key || undefined, tier,
        price: Number(price) || 0,
        base_income: Number(base_income) || 0,
        image_url, description, active,
      };
      const url = isEdit
        ? `/api/admin/v2/valecroft/properties/${encodeURIComponent(initial!.key)}`
        : '/api/admin/v2/valecroft/properties';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error || `Failed (${res.status})`); return; }
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div style={editorBox}>
      <h3 style={{ margin: 0, marginBottom: 14 }}>{isEdit ? `Edit Property — ${initial!.name}` : 'New Property'}</h3>
      {err && <div style={errBox}>{err}</div>}
      <div style={editorGrid}>
        <div>
          <ImageDropField
            value={image_url}
            onChange={setImageUrl}
            folder="valecroft/properties"
            filenameHint={resolvedKey}
            disabledHint={uploadDisabledHint}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Label>Name<input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Eclipsehold Manor" /></Label>
          {!isEdit && <Label>Key (optional, auto-slug)<input style={inp} value={key} onChange={e => setKey(e.target.value)} placeholder={resolvedKey || 'auto'} /></Label>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Label>Tier
              <select style={inp} value={tier} onChange={e => setTier(e.target.value as PropertyTier)}>
                {PROPERTY_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Label>
            <Label>Price (Lunari)<input style={inp} type="number" value={price} onChange={e => setPrice(e.target.value)} /></Label>
          </div>
          <Label>Base Income (per cycle)<input style={inp} type="number" value={base_income} onChange={e => setBaseIncome(e.target.value)} /></Label>
          <Label>Description<textarea style={{ ...inp, minHeight: 90, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="A short flavour description shown to players." /></Label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            Active (visible in /valecroft)
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
        <button style={btnSecondary} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={save} disabled={saving || !name}>{saving ? 'Saving...' : (isEdit ? 'Save' : 'Create')}</button>
      </div>
    </div>
  );
}

// ── Items Tab ──

function ItemsTab({ category }: { category: ItemCategory }) {
  const [rows, setRows] = useState<ItemCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ItemCatalogEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/v2/valecroft/items?category=${category}`, { cache: 'no-store' });
      const data = await res.json();
      setRows(data.rows ?? []);
    } finally { setLoading(false); }
  }, [category]);
  useEffect(() => { refresh(); }, [refresh]);

  const itemPending = usePendingAction();
  const itemToast = useToast();

  function doDelete(key: string) {
    itemPending.queue({
      label: `Delete item "${key}"`,
      detail: 'Removes from catalog · players who own it keep theirs',
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        const token = await fetchCsrf();
        const res = await fetch(`/api/admin/v2/valecroft/items/${encodeURIComponent(key)}`, {
          method: 'DELETE',
          headers: { 'x-csrf-token': token },
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setMsg(data.error || `Failed (${res.status})`); itemToast.show({ tone: 'error', title: 'Delete failed', message: data.error || `HTTP ${res.status}` }); return; }
        setMsg(`Deleted "${key}"`);
        itemToast.show({ tone: 'success', title: 'Deleted', message: key });
        refresh();
      },
    });
  }

  return (
    <div>
      {msg && <div style={{ padding: 10, marginBottom: 12, borderRadius: 8, background: 'rgba(91,108,255,0.12)' }}>{msg}</div>}

      <button onClick={() => { setCreating(true); setEditing(null); }} style={btnPrimary}>+ New {category}</button>

      {(creating || editing) && (
        <ItemForm
          defaultCategory={category}
          initial={editing ?? undefined}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); refresh(); }}
        />
      )}

      {loading ? <p style={{ opacity: 0.7 }}>Loading...</p> :
        rows.length === 0 ? <p style={{ opacity: 0.7 }}>No {category} items yet.</p> : (
        <table style={tableStyle}>
          <thead><tr>
            <th style={th}>Name</th><th style={th}>Rarity</th><th style={th}>Price</th><th style={th}>Income Bonus</th><th style={th}>Active</th><th style={th}>Actions</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} style={tr}>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {r.image_url
                      ? <img src={r.image_url} alt="" width={90} height={90} style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }} />
                      : <div style={{ width: 90, height: 90, borderRadius: 8, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
                    }
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 15 }}>{r.name}</div>
                      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{r.key}</div>
                    </div>
                  </div>
                </td>
                <td style={{ ...td, color: rarityColor(r.rarity), fontWeight: 500 }}>{r.rarity}</td>
                <td style={td}>{r.price.toLocaleString()}</td>
                <td style={td}>+{r.income_bonus.toLocaleString()}</td>
                <td style={td}>{r.active ? '✓' : '—'}</td>
                <td style={td}>
                  <button style={btnSecondary} onClick={() => setEditing(r)}>Edit</button>
                  <button style={btnDanger} onClick={() => doDelete(r.key)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ItemForm({ defaultCategory, initial, onClose, onSaved }: {
  defaultCategory: ItemCategory;
  initial?: ItemCatalogEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [key, setKey] = useState(initial?.key ?? '');
  const [category, setCategory] = useState<ItemCategory>(initial?.category ?? defaultCategory);
  const [rarity, setRarity] = useState<Rarity>(initial?.rarity ?? 'common');
  const [price, setPrice] = useState(String(initial?.price ?? 50000));
  const [income_bonus, setIncomeBonus] = useState(String(initial?.income_bonus ?? 0));
  const [image_url, setImageUrl] = useState(initial?.image_url ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [active, setActive] = useState(initial?.active !== false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const resolvedKey = isEdit ? initial!.key : (key.trim() ? slugify(key) : slugify(name));
  const uploadDisabledHint = !resolvedKey ? 'Type a name first — it becomes the upload filename.' : null;

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const token = await fetchCsrf();
      const body = { name, key: key || undefined, category, rarity, price: Number(price) || 0, income_bonus: Number(income_bonus) || 0, image_url, description, active };
      const url = isEdit
        ? `/api/admin/v2/valecroft/items/${encodeURIComponent(initial!.key)}`
        : '/api/admin/v2/valecroft/items';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error || `Failed (${res.status})`); return; }
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div style={editorBox}>
      <h3 style={{ margin: 0, marginBottom: 14 }}>{isEdit ? `Edit Item — ${initial!.name}` : `New ${defaultCategory}`}</h3>
      {err && <div style={errBox}>{err}</div>}
      <div style={editorGrid}>
        <div>
          <ImageDropField
            value={image_url}
            onChange={setImageUrl}
            folder="valecroft/items"
            filenameHint={resolvedKey}
            disabledHint={uploadDisabledHint}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Label>Name<input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Sunfire Dagger" /></Label>
          {!isEdit && <Label>Key (optional, auto-slug)<input style={inp} value={key} onChange={e => setKey(e.target.value)} placeholder={resolvedKey || 'auto'} /></Label>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Label>Category
              <select style={inp} value={category} onChange={e => setCategory(e.target.value as ItemCategory)}>
                {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Label>
            <Label>Rarity
              <select style={inp} value={rarity} onChange={e => setRarity(e.target.value as Rarity)}>
                {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Label>Price (Lunari)<input style={inp} type="number" value={price} onChange={e => setPrice(e.target.value)} /></Label>
            <Label>Income Bonus<input style={inp} type="number" value={income_bonus} onChange={e => setIncomeBonus(e.target.value)} /></Label>
          </div>
          <Label>Description<textarea style={{ ...inp, minHeight: 90, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="A short flavour description shown to players." /></Label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            Active
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
        <button style={btnSecondary} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={save} disabled={saving || !name}>{saving ? 'Saving...' : (isEdit ? 'Save' : 'Create')}</button>
      </div>
    </div>
  );
}

// ── Ownership Tab ──

function OwnershipTab() {
  const [rows, setRows] = useState<UserPropertyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterState, setFilterState] = useState<'' | 'owned' | 'damaged' | 'foreclosed'>('');
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterState) params.set('state', filterState);
      const res = await fetch(`/api/admin/v2/valecroft/ownership?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      setRows(data.rows ?? []);
    } finally { setLoading(false); }
  }, [filterState]);
  useEffect(() => { refresh(); }, [refresh]);

  const forecPending = usePendingAction();
  const forecToast = useToast();

  function doForceForeclose(discordId: string) {
    forecPending.queue({
      label: `Force-foreclose on ${discordId}`,
      detail: 'Returns all placed items · releases property back to market',
      delayMs: 6000,
      tone: 'danger',
      run: async () => {
        const token = await fetchCsrf();
        const res = await fetch(`/api/admin/v2/valecroft/ownership/${discordId}`, {
          method: 'DELETE',
          headers: { 'x-csrf-token': token },
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setMsg(data.error || `Failed (${res.status})`); forecToast.show({ tone: 'error', title: 'Foreclose failed', message: data.error || `HTTP ${res.status}` }); return; }
        setMsg(`Foreclosed: ${data.forecloseddKey}, ${data.itemsReturned} item(s) returned.`);
        forecToast.show({ tone: 'success', title: 'Foreclosed', message: `${data.itemsReturned} items returned` });
        refresh();
      },
    });
  }

  return (
    <div>
      {msg && <div style={{ padding: 10, marginBottom: 12, borderRadius: 8, background: 'rgba(91,108,255,0.12)' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, opacity: 0.7 }}>State filter:</span>
        {['', 'owned', 'damaged', 'foreclosed'].map(s => (
          <div
            key={s || 'all'}
            role="button"
            tabIndex={0}
            onClick={() => setFilterState(s as any)}
            onKeyDown={onButtonKey(() => setFilterState(s as any))}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              background: filterState === s ? 'rgba(91,108,255,0.2)' : 'rgba(255,255,255,0.04)',
              border: filterState === s ? '1px solid rgba(91,108,255,0.5)' : '1px solid transparent',
            }}
          >{s || 'all'}</div>
        ))}
      </div>

      {loading ? <p style={{ opacity: 0.7 }}>Loading...</p> :
        rows.length === 0 ? <p style={{ opacity: 0.7 }}>No owned properties.</p> : (
        <table style={tableStyle}>
          <thead><tr>
            <th style={th}>User</th><th style={th}>Property</th><th style={th}>State</th><th style={th}>Damage</th><th style={th}>Deadline</th><th style={th}>Actions</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r._id} style={tr}>
                <td style={td}><code>{r.discord_id}</code></td>
                <td style={td}>
                  <div style={{ fontWeight: 500 }}>{r.custom_name || r.property_name || r.property_key}</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>{r.property_key} · {r.property_tier ?? '—'}</div>
                </td>
                <td style={{ ...td, color: stateColor(r.state), fontWeight: 500 }}>{r.state}</td>
                <td style={td}>{r.damage_percent}%</td>
                <td style={td}>{r.foreclosure_deadline ? new Date(r.foreclosure_deadline).toLocaleString() : '—'}</td>
                <td style={td}>
                  <button style={btnDanger} onClick={() => doForceForeclose(r.discord_id)}>Force Foreclose</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Shared UI bits ──

function Label(props: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, ...props.style }}>{props.children}</label>;
}

const inp: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(0,0,0,0.2)',
  color: 'inherit',
  fontSize: 13,
  fontFamily: 'inherit',
};
const btnBase: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 8,
  border: '1px solid transparent',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  marginRight: 6,
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'rgba(91,108,255,0.25)', color: '#c7d0ff', borderColor: 'rgba(91,108,255,0.5)' };
const btnSecondary: React.CSSProperties = { ...btnBase, background: 'rgba(255,255,255,0.06)', color: 'inherit' };
const btnDanger: React.CSSProperties = { ...btnBase, background: 'rgba(255,80,80,0.15)', color: '#ff8c8c', borderColor: 'rgba(255,80,80,0.35)' };

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'separate', borderSpacing: 0, marginTop: 18 };
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 12, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: '1px solid rgba(255,255,255,0.08)' };
const tr: React.CSSProperties = {};
const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)' };
const formBox: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', padding: 18, borderRadius: 12, marginTop: 14, marginBottom: 14 };
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 };
const errBox: React.CSSProperties = { padding: 10, borderRadius: 8, background: 'rgba(255,80,80,0.12)', color: '#ff8c8c', marginBottom: 10, fontSize: 13 };
// Wider edit dialog body — image preview on the left, all fields on the right.
// Collapses to a single column under ~720px so it stays usable on narrow screens.
const editorBox: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    padding: 22,
    borderRadius: 14,
    marginTop: 14,
    marginBottom: 14,
    border: '1px solid rgba(255,255,255,0.06)',
};
const editorGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 380px) 1fr',
    gap: 24,
    alignItems: 'start',
};

function rarityColor(r: Rarity): string {
  switch (r) {
    case 'common':    return '#00FF99';
    case 'rare':      return '#0077FF';
    case 'epic':      return '#B066FF';
    case 'unique':    return '#FF3366';
    case 'legendary': return '#FFD54F';
  }
}
function stateColor(s: string): string {
  if (s === 'damaged') return '#f7b500';
  if (s === 'foreclosed') return '#ff6b6b';
  return '#8be39b';
}
