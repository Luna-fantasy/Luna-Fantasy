'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '../_components/Icon';
import { useToast } from '../_components/Toast';
import { useUndo } from '../_components/UndoProvider';
import { usePendingAction } from '../_components/PendingActionProvider';
import VendorHero from './VendorHero';
import VendorItemsGrid from './VendorItemsGrid';
import LuckboxEditor from './LuckboxEditor';
import VendorItemDialog, { type VendorItem } from './VendorItemDialog';
import SelunaEditor from './SelunaEditor';
import ZoldarEditor from './ZoldarEditor';
import MelunaEditor from './MelunaEditor';
import { VENDOR_LABELS, VENDOR_DEFAULTS, VENDOR_TONES } from './vendor-registry';

const SPECIAL_TABS = [
  {
    id: 'seluna',
    label: 'Seluna',
    caption: 'Rotating lunar merchant',
    tone: '#c084fc',
    portrait: 'https://assets.lunarian.app/jester/icons/seluna.png?v=20260414',
  },
  {
    id: 'zoldar',
    label: 'Zoldar',
    caption: 'Ticket shop',
    tone: '#fb923c',
    portrait: 'https://assets.lunarian.app/jester/shops/zoldar_mooncarver.png?v=20260414',
  },
  {
    id: 'meluna',
    label: 'Meluna',
    caption: 'Moon stone vendor',
    tone: '#60a5fa',
    portrait: 'https://assets.lunarian.app/jester/icons/meluna.png?v=20260415',
  },
] as const;
type SpecialTabId = typeof SPECIAL_TABS[number]['id'];

interface Vendor {
  id: string;
  data: any;
  updatedAt: string | null;
  updatedBy: string | null;
}

function versioned(url: string | undefined, version: number | undefined, updatedAt: string | null): string | undefined {
  if (!url) return url;
  const base = url.split('?')[0];
  const v = version || (updatedAt ? Date.parse(updatedAt) || 0 : 0);
  return v ? `${base}?v=${v}` : base;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function saveVendor(vendorId: string, data: any): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/vendors', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ vendorId, data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

// Vendor _ids that are owned by a special tab (dedicated editor) — don't render
// them again as generic items-based vendor tabs.
const SPECIAL_OWNED_IDS = new Set(['tickets', 'stonebox']);

export default function ShopsClient({ vendors }: { vendors: Vendor[] }) {
  const toast = useToast();
  const undo = useUndo();
  const pending = usePendingAction();

  const filteredVendors = vendors.filter((v) => !SPECIAL_OWNED_IDS.has(v.id));
  const [vendorState, setVendorState] = useState(filteredVendors);
  const [activeId, setActiveId] = useState<string>(filteredVendors[0]?.id ?? 'seluna');
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; item?: VendorItem; index?: number } | null>(null);

  const active = vendorState.find((v) => v.id === activeId);
  const activeSpecial = SPECIAL_TABS.find((t) => t.id === activeId);

  const persist = async (patch: any, label: string, detail: string) => {
    if (!active) return;
    const previous = active.data;
    const merged = { ...active.data, ...patch };

    await pending.queue({
      label,
      detail,
      delayMs: 4500,
      run: async () => {
        try {
          await saveVendor(active.id, merged);
          setVendorState((vs) => vs.map((v) => v.id === active.id
            ? { ...v, data: merged, updatedAt: new Date().toISOString() } : v));
          toast.show({ tone: 'success', title: 'Saved', message: VENDOR_LABELS[active.id] ?? active.id });
          undo.push({
            label: `Restore ${VENDOR_LABELS[active.id] ?? active.id}`,
            detail: 'Vendor config rolled back',
            revert: async () => {
              await saveVendor(active.id, previous);
              setVendorState((vs) => vs.map((v) => v.id === active.id ? { ...v, data: previous } : v));
              toast.show({ tone: 'success', title: 'Reverted', message: active.id });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Save failed', message: (e as Error).message });
        }
      },
    });
  };

  const updateMeta = async (patch: { title?: string; description?: string; image?: string }) => {
    const labelKey = patch.image ? 'portrait' : (patch.title ? 'name' : 'description');
    await persist(
      patch,
      `Update ${VENDOR_LABELS[active!.id] ?? active!.id} ${labelKey}`,
      Object.entries(patch).map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`).join(' · ')
    );
  };

  const updateItems = async (next: VendorItem[], label: string) => {
    await persist({ items: next }, label, `${next.length} items total`);
  };

  const updateTiers = async (next: any[]) => {
    await persist({ tiers: next }, `Update ${VENDOR_LABELS[active!.id] ?? active!.id} tiers`, `${next.length} tiers`);
  };

  const handleSaveItem = async (item: VendorItem) => {
    if (!active) return;
    const items: VendorItem[] = Array.isArray(active.data?.items) ? active.data.items : [];
    let next: VendorItem[];
    if (editor?.mode === 'edit' && editor.index !== undefined) {
      next = items.map((it, i) => i === editor.index ? item : it);
    } else {
      next = [...items, item];
    }
    await updateItems(next, editor?.mode === 'create' ? `Add item: ${item.name}` : `Update item: ${item.name}`);
    setEditor(null);
  };

  const handleDeleteItem = async (index: number) => {
    if (!active) return;
    const items: VendorItem[] = Array.isArray(active.data?.items) ? active.data.items : [];
    const item = items[index];
    if (!item) return;
    await pending.queue({
      label: `Delete item: ${item.name}`,
      detail: `Removed from ${VENDOR_LABELS[active.id] ?? active.id}`,
      delayMs: 5500,
      tone: 'danger',
      run: async () => {
        try {
          const next = items.filter((_, i) => i !== index);
          await saveVendor(active.id, { ...active.data, items: next });
          setVendorState((vs) => vs.map((v) => v.id === active.id
            ? { ...v, data: { ...v.data, items: next }, updatedAt: new Date().toISOString() } : v));
          toast.show({ tone: 'success', title: 'Deleted', message: item.name });
          undo.push({
            label: `Restore item: ${item.name}`,
            detail: VENDOR_LABELS[active.id] ?? active.id,
            revert: async () => {
              const restored = [...next.slice(0, index), item, ...next.slice(index)];
              await saveVendor(active.id, { ...active.data, items: restored });
              setVendorState((vs) => vs.map((v) => v.id === active.id
                ? { ...v, data: { ...v.data, items: restored }, updatedAt: new Date().toISOString() } : v));
              toast.show({ tone: 'success', title: 'Restored', message: item.name });
            },
          });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Delete failed', message: (e as Error).message });
        }
      },
    });
  };

  const handleReorderItem = async (from: number, to: number) => {
    if (!active) return;
    const items: VendorItem[] = Array.isArray(active.data?.items) ? [...active.data.items] : [];
    if (from < 0 || from >= items.length || to < 0 || to >= items.length) return;
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    await updateItems(items, `Reorder ${moved.name}`);
  };

  const isLuckbox = active?.id === 'luckbox';
  const items: VendorItem[] = Array.isArray(active?.data?.items) ? active!.data.items : [];

  if (vendors.length === 0 && !activeSpecial) {
    return <div className="av-flows-empty">No vendors found in vendor_config.</div>;
  }

  return (
    <div className="av-shops">
      {/* Vendor selector */}
      <nav className="av-shops-tabs" role="tablist">
        {vendorState.map((v) => {
          const isActive = v.id === activeId;
          const tone = VENDOR_TONES[v.id] ?? '#06b6d4';
          const portrait = v.data?.image as string | undefined;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(v.id)}
              className={`av-shops-tab${isActive ? ' av-shops-tab--active' : ''}`}
              style={{ ['--vendor-tone' as any]: tone }}
            >
              <div className="av-shops-tab-portrait">
                {portrait
                  ? <img src={versioned(portrait, v.data?.imageVersion, v.updatedAt)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  : <span>{(VENDOR_LABELS[v.id] ?? v.id).slice(0, 1)}</span>}
              </div>
              <div className="av-shops-tab-meta">
                <span className="av-shops-tab-name">{VENDOR_LABELS[v.id] ?? v.id}</span>
                <span className="av-shops-tab-count">
                  {v.id === 'luckbox'
                    ? `${(v.data?.tiers ?? []).length} tiers`
                    : `${(v.data?.items ?? []).length} items`}
                </span>
              </div>
            </button>
          );
        })}
        {SPECIAL_TABS.map((t) => {
          const isActive = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(t.id)}
              className={`av-shops-tab${isActive ? ' av-shops-tab--active' : ''}`}
              style={{ ['--vendor-tone' as any]: t.tone }}
            >
              <div className="av-shops-tab-portrait">
                {t.portrait ? (
                  <img
                    src={t.portrait}
                    alt={t.label}
                    loading="lazy"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = 'none';
                      const span = img.parentElement?.querySelector('span');
                      if (span) (span as HTMLElement).style.display = 'inline-flex';
                    }}
                  />
                ) : null}
                <span style={{ display: t.portrait ? 'none' : 'inline-flex' }}>{t.label.slice(0, 1)}</span>
              </div>
              <div className="av-shops-tab-meta">
                <span className="av-shops-tab-name">{t.label}</span>
                <span className="av-shops-tab-count">{t.caption}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {activeSpecial?.id === 'seluna' && <SelunaEditor tone={activeSpecial.tone} />}
      {activeSpecial?.id === 'zoldar' && <ZoldarEditor tone={activeSpecial.tone} />}
      {activeSpecial?.id === 'meluna' && <MelunaEditor tone={activeSpecial.tone} />}

      {active && !isLuckbox && (
        <>
          <VendorHero
            id={active.id}
            tone={VENDOR_TONES[active.id] ?? '#06b6d4'}
            title={active.data?.title || VENDOR_DEFAULTS[active.id]?.title || VENDOR_LABELS[active.id] || active.id}
            description={active.data?.description || VENDOR_DEFAULTS[active.id]?.description || ''}
            image={active.data?.image || VENDOR_DEFAULTS[active.id]?.image || ''}
            imageVersion={active.data?.imageVersion}
            updatedAt={active.updatedAt}
            onSave={updateMeta}
          />

          <VendorItemsGrid
            tone={VENDOR_TONES[active.id] ?? '#06b6d4'}
            items={items}
            onAdd={(preset) => setEditor({ mode: 'create', item: preset ? { id: '', name: '', price: 0, type: preset.type } : undefined })}
            onEdit={(item, index) => setEditor({ mode: 'edit', item, index })}
            onDelete={handleDeleteItem}
            onReorder={handleReorderItem}
          />
        </>
      )}

      {active && isLuckbox && (
        <>
          <VendorHero
            id={active.id}
            tone={VENDOR_TONES[active.id]}
            title={active.data?.title || VENDOR_DEFAULTS.luckbox.title}
            description={active.data?.description || VENDOR_DEFAULTS.luckbox.description}
            image={active.data?.image || VENDOR_DEFAULTS.luckbox.image}
            imageVersion={active.data?.imageVersion}
            updatedAt={active.updatedAt}
            onSave={updateMeta}
          />
          <LuckboxEditor
            tone={VENDOR_TONES[active.id]}
            tiers={active.data?.tiers ?? []}
            onSave={updateTiers}
          />
        </>
      )}

      {editor && active && !isLuckbox && (
        <VendorItemDialog
          tone={VENDOR_TONES[active.id] ?? '#06b6d4'}
          mode={editor.mode}
          initial={editor.item}
          vendorId={active.id}
          onSave={handleSaveItem}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
