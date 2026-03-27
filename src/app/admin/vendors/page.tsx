'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import AdminLightbox from '../components/AdminLightbox';
import SaveDeployBar from '../components/SaveDeployBar';
import { useUnsavedWarning } from '../hooks/useUnsavedWarning';
import ImagePicker from '../components/ImagePicker';
import RichTextArea from '../components/RichTextArea';
import RolePicker from '../components/RolePicker';
import { SkeletonCard, SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useGuildData } from '../utils/useGuildData';
import { getCsrfToken } from '../utils/csrf';
import { computeConfigDiff } from '../utils/computeConfigDiff';

// ── Types ──

interface SelunaItem {
  id: string;
  type: 'Card' | 'Stone' | 'Role' | 'Tickets' | 'Background';
  name: string;
  price: number;
  stock: number;
  rarity?: string;
  roleId?: string;
  amount?: number;
  description?: string;
  backgroundUrl?: string;
  rankBackgroundUrl?: string;
  backgroundType?: 'profile' | 'rank' | 'both';
}

interface ShopItem {
  id: string;
  name: string;
  price: number;
  roleId?: string;
  description?: string;
  gradientColors?: string[];
}

interface ShopConfig {
  title: string;
  description: string;
  image?: string;
  items: ShopItem[];
}

interface ActiveShop {
  channelId: string;
  startTime: number;
  endTime: number;
  isDev?: boolean;
}

type VendorId = 'brimor' | 'broker';

const VENDOR_TABS: { id: VendorId; label: string }[] = [
  { id: 'brimor', label: 'Brimor' },
  { id: 'broker', label: 'Broker' },
];

const RARITIES = ['COMMON', 'RARE', 'EPIC', 'UNIQUE', 'LEGENDARY', 'SECRET'] as const;
const ITEM_TYPES = ['Card', 'Stone', 'Role', 'Tickets', 'Background'] as const;
const RARITY_COLORS: Record<string, string> = {
  COMMON: '#4ade80', RARE: '#0077FF', EPIC: '#B066FF',
  UNIQUE: '#FF3366', LEGENDARY: '#FFD54F', SECRET: '#FFD27F',
};
const TYPE_ICONS: Record<string, string> = {
  Card: '\uD83C\uDCCF', Stone: '\uD83D\uDC8E', Role: '\uD83C\uDFC5', Tickets: '\uD83C\uDFAB', Background: '\uD83D\uDDBC\uFE0F',
};

const EMPTY_SHOP: ShopConfig = { title: '', description: '', image: '', items: [] };

function formatLunari(n: number): string {
  return n.toLocaleString() + ' \u20BD';
}

function formatTimeLeft(endTime: number): string {
  const diff = endTime - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m left`;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ── Main Page ──

export default function VendorsPage() {
  // Seluna state (unchanged)
  const [selunaItems, setSelunaItems] = useState<SelunaItem[]>([]);
  const [selunaOpen, setSelunaOpen] = useState(false);
  const [activeShop, setActiveShop] = useState<ActiveShop | null>(null);

  // Brimor / Broker state (new: from jester config API)
  const [brimor, setBrimor] = useState<ShopConfig>(deepClone(EMPTY_SHOP));
  const [brimorOrig, setBrimorOrig] = useState<ShopConfig>(deepClone(EMPTY_SHOP));
  const [broker, setBroker] = useState<ShopConfig>(deepClone(EMPTY_SHOP));
  const [brokerOrig, setBrokerOrig] = useState<ShopConfig>(deepClone(EMPTY_SHOP));

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeVendorTab, setActiveVendorTab] = useState<VendorId>('brimor');

  // Seluna modals
  const [showAddSelunaItem, setShowAddSelunaItem] = useState(false);
  const [editingSelunaItem, setEditingSelunaItem] = useState<SelunaItem | null>(null);
  const [confirmRemoveSelunaItem, setConfirmRemoveSelunaItem] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  // Vendor modals
  const [editingProfile, setEditingProfile] = useState<VendorId | null>(null);
  const [showAddVendorItem, setShowAddVendorItem] = useState(false);
  const [editingVendorItemIdx, setEditingVendorItemIdx] = useState<number | null>(null);
  const [confirmDeleteVendorItem, setConfirmDeleteVendorItem] = useState<number | null>(null);

  // Vendor item form
  const [itemForm, setItemForm] = useState({ name: '', price: '', roleId: '', description: '' });

  // Seluna schedule
  const [selunaDuration, setSelunaDuration] = useState(24);
  const [selunaDurationOrig, setSelunaDurationOrig] = useState(24);
  const [selunaReappear, setSelunaReappear] = useState(30);
  const [selunaReappearOrig, setSelunaReappearOrig] = useState(30);
  const [selunaScheduleSaving, setSelunaScheduleSaving] = useState(false);

  // Seluna add item form
  const [newItem, setNewItem] = useState({
    type: 'Card' as SelunaItem['type'],
    name: '', price: '', stock: '-1', rarity: 'LEGENDARY', roleId: '', amount: '1', description: '',
    backgroundType: 'profile' as 'profile' | 'rank' | 'both',
    rankBackgroundUrl: '',
  });
  const [bgImageFile, setBgImageFile] = useState<File | null>(null);
  const [bgImagePreview, setBgImagePreview] = useState<string | null>(null);

  const { toast } = useToast();
  const { roles } = useGuildData();

  // Role resolution helper
  const roleMap = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    for (const r of roles) {
      m.set(r.id, { name: r.name, color: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#6b7280' });
    }
    return m;
  }, [roles]);

  // Active vendor data accessors
  const activeShopData = activeVendorTab === 'brimor' ? brimor : broker;
  const setActiveShopData = activeVendorTab === 'brimor' ? setBrimor : setBroker;

  // ── Data Fetching ──

  const fetchData = useCallback(async () => {
    try {
      const [jesterRes, selunaRes] = await Promise.all([
        fetch('/api/admin/config/jester'),
        fetch('/api/admin/vendors/seluna'),
      ]);

      if (jesterRes.ok) {
        const data = await jesterRes.json();
        const b = data.sections?.shop_brimor ?? deepClone(EMPTY_SHOP);
        const k = data.sections?.shop_broker ?? deepClone(EMPTY_SHOP);
        setBrimor(deepClone(b));
        setBrimorOrig(deepClone(b));
        setBroker(deepClone(k));
        setBrokerOrig(deepClone(k));
        // Seluna schedule
        const ss = data.sections?.seluna_schedule;
        if (ss) {
          setSelunaDuration(ss.duration_hours ?? 24);
          setSelunaDurationOrig(ss.duration_hours ?? 24);
          setSelunaReappear(ss.reappear_days ?? 30);
          setSelunaReappearOrig(ss.reappear_days ?? 30);
        }
      }

      if (selunaRes.ok) {
        const data = await selunaRes.json();
        setSelunaItems(data.inventoryItems ?? []);
        setSelunaOpen(data.isOpen ?? false);
        setActiveShop(data.activeShop ?? null);
      }
    } catch {
      toast('Failed to load vendor data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Change Detection ──

  const hasChanges = useMemo(() => {
    return JSON.stringify(brimor) !== JSON.stringify(brimorOrig)
      || JSON.stringify(broker) !== JSON.stringify(brokerOrig);
  }, [brimor, brimorOrig, broker, brokerOrig]);
  useUnsavedWarning(hasChanges);

  const diff = useMemo(() => {
    const entries = [];
    if (JSON.stringify(brimor) !== JSON.stringify(brimorOrig)) {
      entries.push(...computeConfigDiff(brimorOrig as any, brimor as any, 'Brimor'));
    }
    if (JSON.stringify(broker) !== JSON.stringify(brokerOrig)) {
      entries.push(...computeConfigDiff(brokerOrig as any, broker as any, 'Broker'));
    }
    return entries;
  }, [brimor, brimorOrig, broker, brokerOrig]);

  // ── Save / Discard ──

  async function handleSave() {
    setSaving(true);
    try {
      const promises: Promise<Response>[] = [];
      const csrf = getCsrfToken();

      if (JSON.stringify(brimor) !== JSON.stringify(brimorOrig)) {
        promises.push(fetch('/api/admin/config/jester', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
          body: JSON.stringify({ section: 'shop_brimor', value: brimor }),
        }));
      }
      if (JSON.stringify(broker) !== JSON.stringify(brokerOrig)) {
        promises.push(fetch('/api/admin/config/jester', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
          body: JSON.stringify({ section: 'shop_broker', value: broker }),
        }));
      }

      const results = await Promise.all(promises);
      for (const res of results) {
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Save failed');
        }
      }

      setBrimorOrig(deepClone(brimor));
      setBrokerOrig(deepClone(broker));
      toast('Saved! Bot picks up changes within 30 seconds.', 'success');
    } catch (err: any) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setBrimor(deepClone(brimorOrig));
    setBroker(deepClone(brokerOrig));
    toast('Changes discarded', 'info');
  }

  // ── Vendor Item CRUD ──

  function updateShopField(vendor: VendorId, field: keyof ShopConfig, value: any) {
    const setter = vendor === 'brimor' ? setBrimor : setBroker;
    setter(prev => ({ ...prev, [field]: value }));
  }

  function openAddItem() {
    setItemForm({ name: '', price: '', roleId: '', description: '' });
    setEditingVendorItemIdx(null);
    setShowAddVendorItem(true);
  }

  function openEditItem(idx: number) {
    const item = activeShopData.items[idx];
    setItemForm({
      name: item.name,
      price: String(item.price),
      roleId: item.roleId || '',
      description: item.description || '',
    });
    setEditingVendorItemIdx(idx);
    setShowAddVendorItem(true);
  }

  function handleItemFormSave() {
    if (!itemForm.name.trim()) {
      toast('Name is required', 'error');
      return;
    }
    const price = parseInt(itemForm.price);
    if (!price || price < 1 || price > 10_000_000) {
      toast('Price must be between 1 and 10,000,000', 'error');
      return;
    }

    setActiveShopData(prev => {
      const items = [...prev.items];
      if (editingVendorItemIdx !== null) {
        // Edit existing — preserve gradientColors and other fields
        items[editingVendorItemIdx] = {
          ...items[editingVendorItemIdx],
          name: itemForm.name.trim(),
          price,
          roleId: itemForm.roleId || undefined,
          description: itemForm.description.trim() || undefined,
        };
      } else {
        // Add new
        const id = itemForm.name.trim().replace(/\s+/g, '');
        items.push({
          id,
          name: itemForm.name.trim(),
          price,
          roleId: itemForm.roleId || undefined,
          description: itemForm.description.trim() || undefined,
        });
      }
      return { ...prev, items };
    });
    setShowAddVendorItem(false);
  }

  function handleDeleteItem(idx: number) {
    setActiveShopData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
    setConfirmDeleteVendorItem(null);
  }

  function moveItem(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= activeShopData.items.length) return;
    setActiveShopData(prev => {
      const items = [...prev.items];
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      return { ...prev, items };
    });
  }

  // ── Seluna Actions (unchanged) ──

  async function handleAddSelunaItem() {
    if (!newItem.name || !newItem.price) {
      toast('Name and price are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const item: any = {
        type: newItem.type,
        name: newItem.name,
        price: parseInt(newItem.price),
        stock: parseInt(newItem.stock),
      };
      if (newItem.type === 'Card' && newItem.rarity) item.rarity = newItem.rarity;
      if (newItem.type === 'Role' && newItem.roleId) item.roleId = newItem.roleId;
      if (newItem.type === 'Tickets') item.amount = parseInt(newItem.amount) || 1;
      if (newItem.description) item.description = newItem.description;

      if (newItem.type === 'Background') {
        item.backgroundType = newItem.backgroundType;
        if (newItem.rankBackgroundUrl) item.rankBackgroundUrl = newItem.rankBackgroundUrl;
        if (bgImageFile) {
          const arrayBuffer = await bgImageFile.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          item.imageData = base64;
          item.contentType = bgImageFile.type;
        }
      }

      const res = await fetch('/api/admin/vendors/seluna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ action: 'add_item', item }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const data = await res.json();
      setSelunaItems(prev => [...prev, data.item]);
      setShowAddSelunaItem(false);
      setNewItem({ type: 'Card', name: '', price: '', stock: '-1', rarity: 'LEGENDARY', roleId: '', amount: '1', description: '', backgroundType: 'profile', rankBackgroundUrl: '' });
      setBgImageFile(null);
      if (bgImagePreview) URL.revokeObjectURL(bgImagePreview);
      setBgImagePreview(null);
      toast('Item added to Seluna inventory', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to add item', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSelunaItem() {
    if (!editingSelunaItem) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/vendors/seluna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ action: 'update_item', itemId: editingSelunaItem.id, updates: editingSelunaItem }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setSelunaItems(prev => prev.map(i => i.id === editingSelunaItem.id ? editingSelunaItem : i));
      setEditingSelunaItem(null);
      toast('Item updated', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveSelunaItem(itemId: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/vendors/seluna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ action: 'remove_item', itemId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setSelunaItems(prev => prev.filter(i => i.id !== itemId));
      setConfirmRemoveSelunaItem(null);
      toast('Item removed', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to remove', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleForceClose() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/vendors/seluna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ action: 'force_close' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setSelunaOpen(false);
      setActiveShop(null);
      setConfirmClose(false);
      toast('Seluna shop closed', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to close shop', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">🏬</span> Shop Items</h1>
          <p className="admin-page-subtitle">Manage vendor inventory, prices, and the rare trader</p>
        </div>
        <SkeletonCard count={3} />
        <SkeletonTable rows={4} />
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">🏬</span> Shop Items</h1>
        <p className="admin-page-subtitle">Manage vendor inventory, prices, and the rare trader</p>
      </div>

      {/* ── Seluna Section (unchanged) ── */}
      <div className="admin-card vendor-seluna-card" style={{ marginBottom: '32px' }}>
        <div className="vendor-seluna-header">
          <div className="vendor-seluna-title-area">
            <div className="vendor-avatar-glow vendor-avatar-seluna">
              <img src="https://assets.lunarian.app/jester/icons/seluna.png" alt="Seluna" className="vendor-avatar-img" />
            </div>
            <div>
              <h3 className="admin-card-title" style={{ marginBottom: '2px' }}>Seluna — Rare Trader</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                Appears once per month on full moon. Trades only rare items.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {selunaOpen && activeShop?.endTime && (
              <span style={{ fontSize: '12px', color: 'var(--accent-legendary)' }}>
                {formatTimeLeft(activeShop.endTime)}
              </span>
            )}
            <span className={`admin-badge ${selunaOpen ? 'admin-badge-success' : 'admin-badge-muted'}`}
              style={{ fontSize: '13px', padding: '4px 12px' }}>
              {selunaOpen ? 'OPEN' : 'CLOSED'}
            </span>
          </div>
        </div>

        {/* Inventory */}
        <div style={{ marginTop: '20px' }}>
          <div className="vendor-section-header">
            <h4 className="vendor-section-title">
              Inventory <span className="vendor-section-count">({selunaItems.length} items)</span>
            </h4>
            <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => setShowAddSelunaItem(true)}>
              + Add Item
            </button>
          </div>

          {selunaItems.length === 0 ? (
            <div className="admin-empty" style={{ padding: '32px' }}>
              <p style={{ margin: 0 }}>No items in Seluna&apos;s inventory. Add items to stock the shop.</p>
            </div>
          ) : (
            <div className="vendor-items-grid">
              {selunaItems.map((item) => (
                <div key={item.id} className="vendor-item-card">
                  <div className="vendor-item-header">
                    <span className="vendor-item-type-icon">{TYPE_ICONS[item.type]}</span>
                    <span className="vendor-item-name">{item.name}</span>
                    {item.rarity && (
                      <span className="vendor-rarity-badge" style={{ color: RARITY_COLORS[item.rarity] ?? '#fff', borderColor: RARITY_COLORS[item.rarity] ?? '#fff' }}>
                        {item.rarity}
                      </span>
                    )}
                  </div>
                  <div className="vendor-item-details">
                    <div className="vendor-item-detail">
                      <span className="vendor-item-detail-label">Price</span>
                      <span className="vendor-item-detail-value vendor-price">{formatLunari(item.price)}</span>
                    </div>
                    <div className="vendor-item-detail">
                      <span className="vendor-item-detail-label">Stock</span>
                      <span className="vendor-item-detail-value">{item.stock === -1 ? 'Unlimited' : item.stock}</span>
                    </div>
                    <div className="vendor-item-detail">
                      <span className="vendor-item-detail-label">Type</span>
                      <span className="vendor-item-detail-value">{item.type}</span>
                    </div>
                    {item.type === 'Tickets' && item.amount && (
                      <div className="vendor-item-detail">
                        <span className="vendor-item-detail-label">Qty</span>
                        <span className="vendor-item-detail-value">{item.amount}x</span>
                      </div>
                    )}
                  </div>
                  <div className="vendor-item-actions">
                    <button className="admin-btn admin-btn-ghost admin-btn-sm"
                      onClick={() => setEditingSelunaItem({ ...item })}>
                      Edit
                    </button>
                    <button className="admin-btn admin-btn-danger admin-btn-sm"
                      onClick={() => setConfirmRemoveSelunaItem(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seluna Schedule */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(0, 212, 255, 0.06)' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>Schedule</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
            <div className="admin-form-group" style={{ margin: 0 }}>
              <label className="admin-form-label">Duration (hours)</label>
              <input className="admin-form-input" type="number" min={1} max={168} value={selunaDuration}
                onChange={e => setSelunaDuration(Math.max(1, parseInt(e.target.value) || 1))} />
              <span className="admin-number-input-desc">How many hours Seluna's shop stays open (1-168)</span>
            </div>
            <div className="admin-form-group" style={{ margin: 0 }}>
              <label className="admin-form-label">Reappear After (days)</label>
              <input className="admin-form-input" type="number" min={1} max={365} value={selunaReappear}
                onChange={e => setSelunaReappear(Math.max(1, parseInt(e.target.value) || 1))} />
              <span className="admin-number-input-desc">Days until Seluna appears again</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`admin-btn admin-btn-primary admin-btn-sm ${selunaScheduleSaving ? 'admin-btn-loading' : ''}`}
                disabled={selunaScheduleSaving || (selunaDuration === selunaDurationOrig && selunaReappear === selunaReappearOrig)}
                onClick={async () => {
                  setSelunaScheduleSaving(true);
                  try {
                    const res = await fetch('/api/admin/config/jester', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
                      body: JSON.stringify({ section: 'seluna_schedule', value: { duration_hours: selunaDuration, reappear_days: selunaReappear } }),
                    });
                    if (!res.ok) throw new Error('Save failed');
                    setSelunaDurationOrig(selunaDuration);
                    setSelunaReappearOrig(selunaReappear);
                    toast('Seluna schedule saved!', 'success');
                  } catch {
                    toast('Failed to save schedule', 'error');
                  } finally {
                    setSelunaScheduleSaving(false);
                  }
                }}
              >
                {selunaScheduleSaving ? '...' : 'Save'}
              </button>
              {(selunaDuration !== selunaDurationOrig || selunaReappear !== selunaReappearOrig) && (
                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => { setSelunaDuration(selunaDurationOrig); setSelunaReappear(selunaReappearOrig); }}>
                  Discard
                </button>
              )}
            </div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'block' }}>
            Shop stays open for {selunaDuration}h, then reappears after {selunaReappear} day{selunaReappear !== 1 ? 's' : ''}. Changes apply to the next cycle.
          </span>
        </div>

        {/* Seluna Actions */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(0, 212, 255, 0.06)' }}>
          {selunaOpen ? (
            <button className="admin-btn admin-btn-danger" onClick={() => setConfirmClose(true)}>
              Force Close Shop
            </button>
          ) : (
            <span className="vendor-info-text">
              Shop opens automatically on full moon via the bot. Use inventory above to manage items.
            </span>
          )}
        </div>
      </div>

      {/* ── Vendor Shops (Brimor / Broker) ── */}
      <div className="admin-tabs" style={{ marginBottom: '24px' }}>
        {VENDOR_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`admin-tab ${activeVendorTab === tab.id ? 'admin-tab-active' : ''}`}
            onClick={() => { setActiveVendorTab(tab.id); setEditingProfile(null); }}
          >
            {(tab.id === 'brimor' ? brimor : broker).title || tab.label}
          </button>
        ))}
      </div>

      {/* Vendor Profile Hero Card */}
      <div className="admin-card vendor-profile-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="vendor-avatar-glow" style={{ width: 72, height: 72, flexShrink: 0 }}>
            {activeShopData.image ? (
              <img src={activeShopData.image} alt={activeShopData.title} className="vendor-avatar-img" />
            ) : (
              <span className="vendor-avatar-placeholder">?</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="vendor-hero-name">
              {activeShopData.title || activeVendorTab}
            </h3>
            {activeShopData.description && (
              <p className="vendor-hero-desc">
                {activeShopData.description}
              </p>
            )}
          </div>
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => setEditingProfile(editingProfile === activeVendorTab ? null : activeVendorTab)}
          >
            {editingProfile === activeVendorTab ? 'Close' : 'Edit Profile'}
          </button>
        </div>

        {/* Profile edit form (state-driven, not DOM toggle) */}
        {editingProfile === activeVendorTab && (
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(0, 212, 255, 0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">✏️ Vendor Name</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={activeShopData.title}
                  onChange={(e) => updateShopField(activeVendorTab, 'title', e.target.value)}
                  style={{ fontSize: '14px', fontWeight: 600 }}
                />
              </div>
              <ImagePicker
                label="🖼️ Vendor Image"
                value={activeShopData.image || ''}
                onChange={(url) => updateShopField(activeVendorTab, 'image', url)}
                uploadPrefix="shops/"
              />
              <div style={{ gridColumn: '1 / -1' }}>
                <RichTextArea
                  label="📝 Description"
                  value={activeShopData.description}
                  onChange={(v) => updateShopField(activeVendorTab, 'description', v)}
                  rows={3}
                  minHeight="100px"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Items Grid */}
      <div style={{ marginTop: '20px' }}>
        <div className="vendor-section-header">
          <h4 className="vendor-section-title">
            Items <span className="vendor-section-count">({activeShopData.items?.length ?? 0})</span>
          </h4>
          <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={openAddItem}>
            + Add Item
          </button>
        </div>

        {activeShopData.items && activeShopData.items.length > 0 ? (
          <div className="vendor-shop-items-grid">
            {activeShopData.items.map((item, idx) => {
              const role = item.roleId ? roleMap.get(item.roleId) : null;
              return (
                <div key={item.id || idx} className="vendor-shop-item-card">
                  <div className="vendor-shop-item-name">{item.name}</div>
                  {item.description && (
                    <div className="vendor-shop-item-desc">{item.description}</div>
                  )}
                  <div className="vendor-shop-item-price">{formatLunari(item.price)}</div>
                  {item.roleId && (
                    <div className="vendor-shop-item-role" style={role ? {
                      color: role.color,
                      borderLeft: `3px solid ${role.color}`,
                      paddingLeft: '8px',
                      fontFamily: 'inherit',
                      background: `${role.color}10`,
                    } : undefined}>
                      {role ? role.name : item.roleId}
                    </div>
                  )}
                  <div className="vendor-shop-item-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="vendor-item-reorder">
                      <button
                        className="admin-btn admin-btn-ghost"
                        disabled={idx === 0}
                        onClick={() => moveItem(idx, idx - 1)}
                        title="Move up"
                      >
                        &#9650;
                      </button>
                      <button
                        className="admin-btn admin-btn-ghost"
                        disabled={idx === activeShopData.items.length - 1}
                        onClick={() => moveItem(idx, idx + 1)}
                        title="Move down"
                      >
                        &#9660;
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => openEditItem(idx)}>
                        Edit
                      </button>
                      <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setConfirmDeleteVendorItem(idx)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="admin-empty" style={{ padding: '32px' }}>
            <p>No items configured for this vendor</p>
          </div>
        )}
      </div>

      {/* ── SaveDeployBar ── */}
      <SaveDeployBar
        hasChanges={hasChanges}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        projectName="Vendor Shops"
        diff={diff}
      />

      {/* ── Add/Edit Vendor Item Modal ── */}
      <AdminLightbox
        isOpen={showAddVendorItem}
        onClose={() => setShowAddVendorItem(false)}
        title={editingVendorItemIdx !== null ? 'Edit Item' : 'Add Item'}
        size="md"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="admin-form-group">
            <label className="admin-form-label">✏️ Name</label>
            <input
              className="admin-form-input"
              placeholder="e.g. Sapphire"
              value={itemForm.name}
              onChange={(e) => setItemForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">💰 Price (Lunari)</label>
            <input
              className="admin-form-input"
              type="number"
              min={1}
              max={10_000_000}
              placeholder="500000"
              value={itemForm.price}
              onChange={(e) => setItemForm(p => ({ ...p, price: e.target.value }))}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <RolePicker
              label="🛡️ Role"
              description="The Discord role granted on purchase"
              value={itemForm.roleId}
              onChange={(val) => setItemForm(p => ({ ...p, roleId: typeof val === 'string' ? val : val[0] ?? '' }))}
              placeholder="Select a role (optional)"
            />
          </div>
          <div className="admin-form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="admin-form-label">📝 Description</label>
            <input
              className="admin-form-input"
              placeholder="Brief description"
              dir="auto"
              value={itemForm.description}
              onChange={(e) => setItemForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>
        </div>
        <div className="admin-modal-actions" style={{ marginTop: '20px' }}>
          <button className="admin-btn admin-btn-ghost" onClick={() => setShowAddVendorItem(false)}>Cancel</button>
          <button className="admin-btn admin-btn-primary" onClick={handleItemFormSave}>
            {editingVendorItemIdx !== null ? '💾 Save Changes' : 'Add Item'}
          </button>
        </div>
      </AdminLightbox>

      {/* ── Confirm Delete Vendor Item ── */}
      {confirmDeleteVendorItem !== null && (
        <ConfirmModal
          title="Delete Item"
          message={`Delete "${activeShopData.items[confirmDeleteVendorItem]?.name}" from ${activeShopData.title || activeVendorTab}? This won't take effect until you save.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => handleDeleteItem(confirmDeleteVendorItem)}
          onCancel={() => setConfirmDeleteVendorItem(null)}
        />
      )}

      {/* ── Seluna: Add Item Modal ── */}
      <AdminLightbox isOpen={showAddSelunaItem} onClose={() => { if (bgImagePreview) URL.revokeObjectURL(bgImagePreview); setBgImagePreview(null); setBgImageFile(null); setShowAddSelunaItem(false); }} title="Add Item to Seluna" size="lg">
            <p className="admin-modal-message">Add a new item to Seluna&apos;s rare trader inventory.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">🔵 Type</label>
                <select className="admin-select" value={newItem.type}
                  onChange={(e) => setNewItem(p => ({ ...p, type: e.target.value as any }))}>
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>)}
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">✏️ Name</label>
                <input className="admin-form-input" placeholder="e.g. Luna Sentinel"
                  value={newItem.name} onChange={(e) => setNewItem(p => ({ ...p, name: e.target.value }))} />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">💰 Price (Lunari)</label>
                <input className="admin-form-input" type="number" placeholder="50000" min={0}
                  value={newItem.price} onChange={(e) => setNewItem(p => ({ ...p, price: e.target.value }))} />
                <span className="admin-number-input-desc">How much this item costs to buy</span>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">📦 Stock<span className="admin-tooltip-trigger" data-tooltip="-1 = unlimited stock">?</span></label>
                <input className="admin-form-input" type="number" placeholder="-1"
                  value={newItem.stock} onChange={(e) => setNewItem(p => ({ ...p, stock: e.target.value }))} />
                <span className="admin-number-input-desc">Available stock (-1 = unlimited)</span>
                <span className="admin-form-description">How many available. -1 = unlimited</span>
              </div>

              {newItem.type === 'Card' && (
                <div className="admin-form-group">
                  <label className="admin-form-label">💎 Rarity</label>
                  <select className="admin-select" value={newItem.rarity}
                    onChange={(e) => setNewItem(p => ({ ...p, rarity: e.target.value }))}>
                    {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              {newItem.type === 'Role' && (
                <div className="admin-form-group">
                  <label className="admin-form-label">🛡️ Role</label>
                  <input className="admin-form-input" placeholder="Role ID"
                    value={newItem.roleId} onChange={(e) => setNewItem(p => ({ ...p, roleId: e.target.value }))} />
                </div>
              )}

              {newItem.type === 'Tickets' && (
                <div className="admin-form-group">
                  <label className="admin-form-label">Ticket Amount</label>
                  <input className="admin-form-input" type="number" placeholder="1" min={1}
                    value={newItem.amount} onChange={(e) => setNewItem(p => ({ ...p, amount: e.target.value }))} />
                  <span className="admin-number-input-desc">Quantity given per purchase</span>
                </div>
              )}

              {newItem.type === 'Background' && (
                <>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Background Type</label>
                    <select className="admin-select" value={newItem.backgroundType}
                      onChange={(e) => setNewItem(p => ({ ...p, backgroundType: e.target.value as any }))}>
                      <option value="profile">Profile</option>
                      <option value="rank">Rank</option>
                      <option value="both">Both</option>
                    </select>
                  </div>

                  <div className="admin-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="admin-form-label">Background Image</label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="admin-form-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setBgImageFile(file);
                        if (bgImagePreview) URL.revokeObjectURL(bgImagePreview);
                        if (file) {
                          const url = URL.createObjectURL(file);
                          setBgImagePreview(url);
                        } else {
                          setBgImagePreview(null);
                        }
                      }}
                    />
                    {bgImagePreview && (
                      <div style={{ marginTop: '8px' }}>
                        <img src={bgImagePreview} alt="Preview" style={{ maxWidth: '200px', maxHeight: '120px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                      </div>
                    )}
                  </div>

                  {(newItem.backgroundType === 'rank' || newItem.backgroundType === 'both') && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <ImagePicker
                        label="Rank Background (optional, if different from main image)"
                        value={newItem.rankBackgroundUrl}
                        onChange={(url) => setNewItem(p => ({ ...p, rankBackgroundUrl: url }))}
                        uploadPrefix="profiles/"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="admin-form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="admin-form-label">Description (optional)</label>
                <input className="admin-form-input" placeholder="Brief description of the item"
                  value={newItem.description} onChange={(e) => setNewItem(p => ({ ...p, description: e.target.value }))} />
              </div>
            </div>

            <div className="admin-modal-actions" style={{ marginTop: '20px' }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setShowAddSelunaItem(false)}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleAddSelunaItem} disabled={saving}>
                {saving ? 'Adding...' : 'Add Item'}
              </button>
            </div>
      </AdminLightbox>

      {/* ── Seluna: Edit Item Modal ── */}
      <AdminLightbox isOpen={editingSelunaItem !== null} onClose={() => setEditingSelunaItem(null)} title="Edit Item" size="lg">
        {editingSelunaItem && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">✏️ Name</label>
                <input className="admin-form-input" value={editingSelunaItem.name}
                  onChange={(e) => setEditingSelunaItem(p => p ? { ...p, name: e.target.value } : p)} />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">💰 Price (Lunari)</label>
                <input className="admin-form-input" type="number" min={0} value={editingSelunaItem.price}
                  onChange={(e) => setEditingSelunaItem(p => p ? { ...p, price: parseInt(e.target.value) || 0 } : p)} />
                <span className="admin-number-input-desc">How much this item costs to buy</span>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">📦 Stock<span className="admin-tooltip-trigger" data-tooltip="-1 = unlimited stock">?</span></label>
                <input className="admin-form-input" type="number" value={editingSelunaItem.stock}
                  onChange={(e) => setEditingSelunaItem(p => p ? { ...p, stock: parseInt(e.target.value) } : p)} />
                <span className="admin-number-input-desc">Available stock (-1 = unlimited)</span>
                <span className="admin-form-description">How many available. -1 = unlimited</span>
              </div>

              {editingSelunaItem.type === 'Card' && (
                <div className="admin-form-group">
                  <label className="admin-form-label">💎 Rarity</label>
                  <select className="admin-select" value={editingSelunaItem.rarity ?? 'COMMON'}
                    onChange={(e) => setEditingSelunaItem(p => p ? { ...p, rarity: e.target.value } : p)}>
                    {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              {editingSelunaItem.type === 'Tickets' && (
                <div className="admin-form-group">
                  <label className="admin-form-label">Ticket Amount</label>
                  <input className="admin-form-input" type="number" min={1} value={editingSelunaItem.amount ?? 1}
                    onChange={(e) => setEditingSelunaItem(p => p ? { ...p, amount: parseInt(e.target.value) || 1 } : p)} />
                  <span className="admin-number-input-desc">Quantity given per purchase</span>
                </div>
              )}
            </div>

            <div className="admin-modal-actions" style={{ marginTop: '20px' }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setEditingSelunaItem(null)}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleUpdateSelunaItem} disabled={saving}>
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </>
        )}
      </AdminLightbox>

      {/* ── Seluna: Confirm Remove ── */}
      {confirmRemoveSelunaItem && (
        <ConfirmModal
          title="Remove Item"
          message={`Remove "${selunaItems.find(i => i.id === confirmRemoveSelunaItem)?.name}" from Seluna's inventory?`}
          confirmLabel="Remove"
          variant="danger"
          onConfirm={() => handleRemoveSelunaItem(confirmRemoveSelunaItem)}
          onCancel={() => setConfirmRemoveSelunaItem(null)}
        />
      )}

      {/* ── Seluna: Confirm Close ── */}
      {confirmClose && (
        <ConfirmModal
          title="Close Seluna Shop"
          message="This will force close Seluna's shop for all users immediately."
          confirmLabel="Close Shop"
          variant="danger"
          onConfirm={handleForceClose}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </>
  );
}
