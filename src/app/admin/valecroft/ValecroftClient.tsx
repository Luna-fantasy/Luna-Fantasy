'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onButtonKey } from '../_components/a11y';
import { usePendingAction } from '../_components/PendingActionProvider';
import { useToast } from '../_components/Toast';
import {
  PROPERTY_TIERS, RARITIES, ITEM_CATEGORIES, DEFAULT_TIER_SLOT_RULES,
  type ItemCatalogEntry, type PropertyCatalogEntry, type SlotRule,
  type UserPropertyRow, type PropertyTier, type Rarity, type ItemCategory,
} from '@/lib/admin/valecroft-types';
import FamilyHomePanel from './FamilyHomePanel';

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

type Tab = 'family' | 'properties' | ItemCategory | 'ownership' | 'grant';
const TABS: { key: Tab; label: string }[] = [
  { key: 'family',     label: 'Family & Home' },
  { key: 'properties', label: 'Properties' },
  { key: 'artifact',   label: 'Artifacts' },
  { key: 'horse',      label: 'Horses' },
  { key: 'sword',      label: 'Swords' },
  { key: 'ownership',  label: 'Ownership' },
  { key: 'grant',      label: '✦ Grant Special' },
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
      {tab === 'grant' && <GrantSpecialTab />}
    </section>
  );
}

// ── Properties Tab ──

interface OwnersTarget { kind: 'property' | 'item'; key: string; name: string }

function PropertiesTab() {
  const [rows, setRows] = useState<PropertyCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<PropertyCatalogEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ownersOf, setOwnersOf] = useState<OwnersTarget | null>(null);

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
                  <button style={btnSecondary} onClick={() => setOwnersOf({ kind: 'property', key: r.key, name: r.name })}>Owners</button>
                  <button style={btnSecondary} onClick={() => setEditing(r)}>Edit</button>
                  <button style={btnDanger} onClick={() => doDelete(r.key)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {ownersOf && (
        <OwnersDialog
          kind={ownersOf.kind}
          targetKey={ownersOf.key}
          targetName={ownersOf.name}
          onClose={() => setOwnersOf(null)}
        />
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
  const [ownerCount, setOwnerCount] = useState<number | null>(null);

  // Slot rule override · null/undefined = inherit tier defaults (with the
  // bot's price-rank scaling); a SlotRule = freeze this exact allocation.
  // The bot's resolveScaledSlotRule treats any non-null override as
  // authoritative — no scaling, no merging.
  const [overrideEnabled, setOverrideEnabled] = useState<boolean>(!!initial?.slot_rules_override);
  const [overrideTotal, setOverrideTotal] = useState<string>(
    String(initial?.slot_rules_override?.total ?? DEFAULT_TIER_SLOT_RULES[initial?.tier ?? 'shack'].total),
  );
  const [overrideByRarity, setOverrideByRarity] = useState<Partial<Record<Rarity, string>>>(() => {
    const seed = initial?.slot_rules_override?.by_rarity ?? DEFAULT_TIER_SLOT_RULES[initial?.tier ?? 'shack'].by_rarity;
    const out: Partial<Record<Rarity, string>> = {};
    for (const r of RARITIES) out[r] = String(seed[r] ?? 0);
    return out;
  });

  // Pull the live owner count once so the admin sees how many users will be
  // affected by a shrink. Read-only — doesn't block save.
  useEffect(() => {
    if (!isEdit || !initial?.key) return;
    fetch(`/api/admin/v2/valecroft/properties/${encodeURIComponent(initial.key)}/owners`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && Array.isArray(d.rows)) setOwnerCount(d.rows.length); })
      .catch(() => { /* non-fatal · just hides the warning */ });
  }, [isEdit, initial?.key]);

  // Resolved key for the R2 upload path. In edit mode the key is locked
  // to the existing one; in create mode we use the user-typed key, or
  // slugify the name as a preview.
  const resolvedKey = isEdit ? initial!.key : (key.trim() ? slugify(key) : slugify(name));
  const uploadDisabledHint = !resolvedKey ? 'Type a name first — it becomes the upload filename.' : null;

  // Build the override SlotRule from form state, omitting empty buckets
  // (matches what sanitizeSlotRule would produce server-side). Returns null
  // when override is disabled — server reads null as "clear, inherit tier
  // defaults". Mirror of server logic so the live preview stays honest.
  function buildOverrideRule(): SlotRule | null {
    if (!overrideEnabled) return null;
    const total = Math.floor(Number(overrideTotal) || 0);
    if (!Number.isFinite(total) || total <= 0) return null;
    const by_rarity: Partial<Record<Rarity, number>> = {};
    for (const r of RARITIES) {
      const n = Math.floor(Number(overrideByRarity[r]) || 0);
      if (n > 0) by_rarity[r] = n;
    }
    return { total, by_rarity };
  }

  // Live preview of what the form is about to submit. Derived per-render so
  // the warnings stay in sync with every keystroke.
  const previewRule = buildOverrideRule();
  const tierDefault = DEFAULT_TIER_SLOT_RULES[tier];
  const nonWildcardSum = previewRule
    ? RARITIES
        .filter(r => r !== 'forbidden' && r !== 'special')
        .reduce((acc, r) => acc + (previewRule.by_rarity[r] ?? 0), 0)
    : 0;
  const overflow = previewRule ? nonWildcardSum - previewRule.total : 0;
  const wildcardSlots = previewRule ? Math.max(0, previewRule.total - nonWildcardSum) : 0;
  // Block save if the override is enabled but invalid — mirrors the
  // server's null-return so we never POST garbage.
  const overrideInvalid = overrideEnabled && (
    !previewRule || previewRule.total < 1 || previewRule.total > 50 || overflow > 0
  );

  async function save() {
    setErr(null);
    if (overrideInvalid) {
      setErr(overflow > 0
        ? `Slot rule invalid: per-rarity allocations sum to ${nonWildcardSum} but total is ${previewRule!.total}. Reduce a bucket or raise the total.`
        : 'Slot rule invalid: total must be 1–50.');
      return;
    }
    setSaving(true);
    try {
      const token = await fetchCsrf();
      const body = {
        name, key: key || undefined, tier,
        price: Number(price) || 0,
        base_income: Number(base_income) || 0,
        image_url, description, active,
        // Pass null to CLEAR the override (revert to tier defaults + price
        // scaling), or a SlotRule to freeze a custom allocation. The server
        // re-validates with sanitizeSlotRule and will null-out anything
        // malformed.
        slot_rules_override: previewRule,
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

      {/* ── Slot rules override ───────────────────────────────────────────── */}
      <div style={{
        marginTop: 18,
        padding: '14px 16px',
        borderRadius: 10,
        background: 'rgba(91,108,255,0.06)',
        border: '1px solid rgba(91,108,255,0.18)',
      }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={overrideEnabled}
            onChange={e => setOverrideEnabled(e.target.checked)}
          />
          Custom slot rules (override tier defaults)
        </label>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
          Off = the bot uses the <strong>{tier}</strong> tier defaults
          ({tierDefault.total} slots, scaled +1 per price-rank within tier).
          On = freeze the exact total + per-rarity allocation below. Forbidden
          and special items always slot anywhere — only the total cap applies
          to them. The bot picks up changes within ~60s of save.
        </div>

        {overrideEnabled && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, alignItems: 'end' }}>
              <Label>Total slots (1–50)
                <input
                  style={inp}
                  type="number"
                  min={1}
                  max={50}
                  value={overrideTotal}
                  onChange={e => setOverrideTotal(e.target.value)}
                />
              </Label>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Tier default: <strong>{tierDefault.total}</strong> · Players who
                already own this property keep any items they’ve placed even if
                you shrink slots, but new placements past the new cap will fail.
                {ownerCount !== null && ownerCount > 0 && (
                  <div style={{ marginTop: 6, color: '#FFB347' }}>
                    ⚠️ <strong>{ownerCount}</strong> user{ownerCount === 1 ? '' : 's'} currently own this property — review their item placements before shrinking.
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                Per-rarity allocation (0 = none allowed)
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: 8,
              }}>
                {RARITIES.map(r => {
                  const isWildcard = r === 'forbidden' || r === 'special';
                  return (
                    <label
                      key={r}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: 'rgba(0,0,0,0.18)',
                        border: `1px solid ${rarityColor(r)}33`,
                        opacity: isWildcard ? 0.55 : 1,
                      }}
                      title={isWildcard ? `${r} items slot anywhere — this number is informational only.` : undefined}
                    >
                      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', color: rarityColor(r), textTransform: 'uppercase' }}>
                        {r}
                      </span>
                      <input
                        style={{ ...inp, padding: '4px 6px', fontSize: 13 }}
                        type="number"
                        min={0}
                        max={50}
                        value={overrideByRarity[r] ?? '0'}
                        onChange={e => setOverrideByRarity(prev => ({ ...prev, [r]: e.target.value }))}
                        disabled={isWildcard}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Live validation feedback */}
            <div style={{ marginTop: 12, fontSize: 12 }}>
              {overflow > 0 ? (
                <div style={{ color: '#ff6b6b' }}>
                  ❌ Per-rarity allocations sum to <strong>{nonWildcardSum}</strong>, but the total cap is <strong>{previewRule!.total}</strong>. Reduce a bucket or raise the total.
                </div>
              ) : previewRule ? (
                <div style={{ color: '#8be39b' }}>
                  ✓ {previewRule.total} total slot{previewRule.total === 1 ? '' : 's'} ·
                  {' '}{nonWildcardSum} reserved for specific rarities ·
                  {' '}{wildcardSlots} open slot{wildcardSlots === 1 ? '' : 's'} (any rarity, including forbidden/special)
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
        <button style={btnSecondary} onClick={onClose}>Cancel</button>
        <button
          style={btnPrimary}
          onClick={save}
          disabled={saving || !name || overrideInvalid}
          title={overrideInvalid ? 'Slot rule invalid — fix the highlighted issue first.' : undefined}
        >{saving ? 'Saving...' : (isEdit ? 'Save' : 'Create')}</button>
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
  const [ownersOf, setOwnersOf] = useState<OwnersTarget | null>(null);

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
                      <div style={{ fontWeight: 500, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {r.name}
                        {r.rarity === 'special' && (
                          <span
                            title="Special-tier items are admin-grant-only. They are hidden from the Valecroft storefront and players cannot buy them."
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'rgba(255, 215, 0, 0.18)',
                              color: '#FFD700',
                              border: '1px solid rgba(255, 215, 0, 0.35)',
                            }}
                          >⭐ ADMIN-ONLY</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{r.key}</div>
                    </div>
                  </div>
                </td>
                <td style={{ ...td, color: rarityColor(r.rarity), fontWeight: 500 }}>{r.rarity}</td>
                <td style={td}>
                  {r.rarity === 'special'
                    ? <span style={{ opacity: 0.5, fontStyle: 'italic' }}>—</span>
                    : r.price.toLocaleString()}
                </td>
                <td style={td}>+{r.income_bonus.toLocaleString()}</td>
                <td style={td}>{r.active ? '✓' : '—'}</td>
                <td style={td}>
                  <button style={btnSecondary} onClick={() => setOwnersOf({ kind: 'item', key: r.key, name: r.name })}>Owners</button>
                  <button style={btnSecondary} onClick={() => setEditing(r)}>Edit</button>
                  <button style={btnDanger} onClick={() => doDelete(r.key)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {ownersOf && (
        <OwnersDialog
          kind={ownersOf.kind}
          targetKey={ownersOf.key}
          targetName={ownersOf.name}
          onClose={() => setOwnersOf(null)}
        />
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

// ── Grant Special Tab — Mastermind-only gift flow for `special`-tier props ──

interface SpecialPropertyRow { key: string; name: string; image_url: string; active: boolean }

function GrantSpecialTab() {
  const [specials, setSpecials] = useState<SpecialPropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [discordId, setDiscordId] = useState('');
  const [propertyKey, setPropertyKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const toast = useToast();
  const pending = usePendingAction();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/v2/valecroft/grant-special', { cache: 'no-store' });
      const data = await res.json();
      setSpecials(data.rows ?? []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  function doGrant() {
    if (!/^\d{17,20}$/.test(discordId.trim())) {
      toast.show({ tone: 'warn', title: 'Invalid Discord ID', message: 'Paste a 17-20 digit user ID.' });
      return;
    }
    if (!propertyKey) {
      toast.show({ tone: 'warn', title: 'Pick a property', message: 'Select a special property to grant.' });
      return;
    }
    const chosen = specials.find(s => s.key === propertyKey);
    pending.queue({
      label: `Grant "${chosen?.name ?? propertyKey}" to ${discordId.trim()}`,
      detail: 'User must already be a member of the Luna server. Cannot be undone except by Force Foreclose.',
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        setBusy(true);
        setMsg(null);
        try {
          const csrf = await fetchCsrf();
          const res = await fetch('/api/admin/v2/valecroft/grant-special', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
            credentials: 'include',
            body: JSON.stringify({ discordId: discordId.trim(), key: propertyKey }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setMsg({ tone: 'err', text: data?.error ?? `HTTP ${res.status}` });
            toast.show({ tone: 'error', title: 'Grant failed', message: data?.error ?? `HTTP ${res.status}` });
            return;
          }
          const who = data?.memberName ? ` (${data.memberName})` : '';
          setMsg({ tone: 'ok', text: `Granted to ${discordId.trim()}${who}.` });
          toast.show({ tone: 'success', title: 'Granted', message: `${chosen?.name ?? propertyKey} → ${data?.memberName || discordId.trim()}` });
          setDiscordId('');
          setPropertyKey('');
        } finally {
          setBusy(false);
        }
      },
    });
  }

  return (
    <div>
      <div style={{ padding: 14, marginBottom: 16, borderRadius: 10, background: 'rgba(255, 213, 79, 0.08)', border: '1px solid rgba(255, 213, 79, 0.3)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#FFD54F' }}>✦ Special Property grant</div>
        <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.6 }}>
          Special properties are <strong>never sold or shown</strong> in the Cassian shop. They can only be granted here, by a Mastermind, to a specific Discord user.
          The user must be in the Luna server. Special properties stack on top of the user&apos;s regular property — they do not replace it.
        </div>
      </div>

      {loading ? (
        <p style={{ opacity: 0.7 }}>Loading…</p>
      ) : specials.length === 0 ? (
        <p style={{ opacity: 0.7 }}>
          No special properties exist yet. Go to the Properties tab → <strong>+ New Property</strong>, set tier to <code>special</code>, then come back here to grant it.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          <div>
            <label style={{ fontSize: 13, opacity: 0.8, display: 'block', marginBottom: 6 }}>Recipient Discord ID</label>
            <input
              style={inp}
              value={discordId}
              onChange={e => setDiscordId(e.target.value.replace(/[^\d]/g, '').slice(0, 20))}
              placeholder="e.g. 462550591547572224"
              inputMode="numeric"
            />
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>17-20 digit Discord snowflake. Right-click a user → Copy ID (Developer Mode).</div>

            <label style={{ fontSize: 13, opacity: 0.8, display: 'block', marginTop: 16, marginBottom: 6 }}>Special property to grant</label>
            <select style={inp} value={propertyKey} onChange={e => setPropertyKey(e.target.value)}>
              <option value="">— pick one —</option>
              {specials.map(s => (
                <option key={s.key} value={s.key} disabled={!s.active}>
                  {s.name} {s.active ? '' : '(inactive)'}
                </option>
              ))}
            </select>

            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button style={btnPrimary} onClick={doGrant} disabled={busy || !discordId || !propertyKey}>
                {busy ? 'Granting…' : 'Grant property'}
              </button>
            </div>

            {msg && (
              <div style={{
                marginTop: 14,
                padding: 10, borderRadius: 8, fontSize: 13,
                background: msg.tone === 'ok' ? 'rgba(91, 200, 130, 0.12)' : msg.tone === 'err' ? 'rgba(255,80,80,0.12)' : 'rgba(91,108,255,0.12)',
                color: msg.tone === 'ok' ? '#8be39b' : msg.tone === 'err' ? '#ff8c8c' : '#c7d0ff',
              }}>
                {msg.text}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Preview</div>
            {propertyKey ? (() => {
              const chosen = specials.find(s => s.key === propertyKey);
              if (!chosen) return null;
              return (
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {chosen.image_url ? (
                    <img src={chosen.image_url} alt="" style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ height: 200, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>no image</div>
                  )}
                  <div style={{ padding: 14 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{chosen.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>{chosen.key}</div>
                  </div>
                </div>
              );
            })() : (
              <div style={{ padding: 24, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.1)', opacity: 0.6, fontSize: 13 }}>
                Pick a property to preview
              </div>
            )}
          </div>
        </div>
      )}
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

// Owners dialog · lists every user who owns the given property/item, with a
// Revoke button per row and a "grant by Discord ID" form at the top. Closes
// over the table refresh isn't necessary · the dialog just refetches its own
// list on each grant/revoke.
interface OwnerEntry {
    discord_id: string;
    name: string | null;
    avatar?: string | null;
    state?: string;
    damage_percent?: number;
    custom_name?: string | null;
    granted_by_admin?: boolean;
    copies?: number;
    placed?: number;
    damaged?: number;
}

function OwnersDialog({ kind, targetKey, targetName, onClose }: {
    kind: 'property' | 'item';
    targetKey: string;
    targetName: string;
    onClose: () => void;
}) {
    const toast = useToast();
    const [owners, setOwners] = useState<OwnerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [grantId, setGrantId] = useState('');
    const [busy, setBusy] = useState(false);

    const baseUrl = `/api/admin/v2/valecroft/${kind === 'property' ? 'properties' : 'items'}/${encodeURIComponent(targetKey)}/owners`;

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(baseUrl, { cache: 'no-store' });
            const data = await res.json();
            setOwners(Array.isArray(data?.rows) ? data.rows : []);
        } catch (e: any) {
            toast.show({ tone: 'error', title: 'Load failed', message: e?.message || 'Network error' });
        } finally {
            setLoading(false);
        }
    }, [baseUrl, toast]);
    useEffect(() => { void refresh(); }, [refresh]);

    async function doGrant() {
        if (!/^\d{17,20}$/.test(grantId.trim())) {
            toast.show({ tone: 'warn', title: 'Invalid Discord ID', message: 'Paste a 17-20 digit user ID.' });
            return;
        }
        setBusy(true);
        try {
            const csrf = await fetchCsrf();
            const res = await fetch(baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
                credentials: 'include',
                body: JSON.stringify({ discordId: grantId.trim() }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.show({ tone: 'error', title: 'Grant failed', message: data?.error || `HTTP ${res.status}` });
                return;
            }
            toast.show({ tone: 'success', title: 'Granted', message: `${targetName} → ${grantId.trim()}` });
            setGrantId('');
            await refresh();
        } finally { setBusy(false); }
    }

    async function doRevoke(discordId: string) {
        if (!confirm(`Revoke "${targetName}" from ${discordId}? ${kind === 'property' ? 'Placed items will return to their storage.' : 'Removes one copy.'}`)) return;
        setBusy(true);
        try {
            const csrf = await fetchCsrf();
            const res = await fetch(`${baseUrl}/${encodeURIComponent(discordId)}`, {
                method: 'DELETE',
                headers: { 'x-csrf-token': csrf },
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.show({ tone: 'error', title: 'Revoke failed', message: data?.error || `HTTP ${res.status}` });
                return;
            }
            const extra = data?.itemsReturned ? ` · ${data.itemsReturned} items returned` : '';
            toast.show({ tone: 'success', title: 'Revoked', message: `${discordId}${extra}` });
            await refresh();
        } finally { setBusy(false); }
    }

    return (
        <div style={modalBg} onClick={onClose}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
                <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontFamily: 'Cinzel, serif' }}>Owners · {targetName}</h3>
                        <div style={{ fontSize: 12, opacity: 0.6 }}><code>{targetKey}</code> · {kind}</div>
                    </div>
                    <button style={btnSecondary} onClick={onClose}>Close</button>
                </header>

                <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: 12, background: 'rgba(91,108,255,0.06)', borderRadius: 10, border: '1px solid rgba(91,108,255,0.2)' }}>
                    <input
                        style={{ ...inp, flex: 1 }}
                        placeholder="Discord user ID to grant…"
                        value={grantId}
                        onChange={e => setGrantId(e.target.value.replace(/[^\d]/g, '').slice(0, 20))}
                        inputMode="numeric"
                    />
                    <button style={btnPrimary} onClick={doGrant} disabled={busy || !grantId.trim()}>
                        {busy ? '…' : 'Grant'}
                    </button>
                </div>

                {loading ? (
                    <p style={{ opacity: 0.7 }}>Loading owners…</p>
                ) : owners.length === 0 ? (
                    <p style={{ opacity: 0.7, padding: 16, textAlign: 'center' }}>No owners yet.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
                        {owners.map(o => (
                            <div key={`${o.discord_id}`} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: 10, borderRadius: 8,
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                {o.avatar
                                    ? <img src={o.avatar} alt="" width={32} height={32} style={{ borderRadius: '50%', flexShrink: 0 }} />
                                    : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
                                }
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {o.name ?? 'Unknown'}
                                    </div>
                                    <div style={{ fontSize: 11, opacity: 0.6, fontFamily: 'monospace' }}>{o.discord_id}</div>
                                    {kind === 'property' && (
                                        <div style={{ fontSize: 11, marginTop: 2, opacity: 0.75 }}>
                                            {o.state ?? 'owned'}
                                            {(o.damage_percent ?? 0) > 0 && <> · 🛠️ {o.damage_percent}% dmg</>}
                                            {o.custom_name && <> · "{o.custom_name}"</>}
                                            {o.granted_by_admin && <> · ✦ admin grant</>}
                                        </div>
                                    )}
                                    {kind === 'item' && (
                                        <div style={{ fontSize: 11, marginTop: 2, opacity: 0.75 }}>
                                            ×{o.copies ?? 1}
                                            {o.placed ? <> · 🏠 {o.placed} placed</> : null}
                                            {o.damaged ? <> · 🛠️ {o.damaged} damaged</> : null}
                                        </div>
                                    )}
                                </div>
                                <button style={btnDanger} onClick={() => doRevoke(o.discord_id)} disabled={busy}>
                                    {kind === 'property' ? 'Revoke' : 'Take 1'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

const modalBg: React.CSSProperties = {
    position: 'fixed', inset: 0,
    background: 'rgba(5,7,16,0.78)', backdropFilter: 'blur(6px)',
    zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modalBox: React.CSSProperties = {
    background: 'linear-gradient(180deg, #161a2e 0%, #0c0f1f 100%)',
    border: '1px solid rgba(140, 200, 255, 0.18)',
    borderRadius: 14,
    width: 'min(640px, 95vw)',
    maxHeight: '92vh',
    padding: 22,
    overflow: 'auto',
};

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
    case 'forbidden': return '#B71C1C'; // deep crimson — above-legendary
    case 'special':   return '#FFD700'; // gold — Mastermind-only ⭐
  }
}
function stateColor(s: string): string {
  if (s === 'damaged') return '#f7b500';
  if (s === 'foreclosed') return '#ff6b6b';
  return '#8be39b';
}
