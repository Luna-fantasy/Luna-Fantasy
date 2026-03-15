'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import AdminLightbox from '../components/AdminLightbox';
import { useToast } from '../components/Toast';

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

interface VendorItem {
  id: string;
  name: string;
  price: number;
  roleId?: string;
  description?: string;
  stock?: number;
}

interface VendorConfig {
  id: string;
  data: {
    title: string;
    description: string;
    image?: string;
    items: VendorItem[];
  };
}

interface ActiveShop {
  channelId: string;
  startTime: number;
  endTime: number;
  isDev?: boolean;
}

const RARITIES = ['COMMON', 'RARE', 'EPIC', 'UNIQUE', 'LEGENDARY', 'SECRET'] as const;
const ITEM_TYPES = ['Card', 'Stone', 'Role', 'Tickets', 'Background'] as const;
const RARITY_COLORS: Record<string, string> = {
  COMMON: '#4ade80', RARE: '#0077FF', EPIC: '#B066FF',
  UNIQUE: '#FF3366', LEGENDARY: '#FFD54F', SECRET: '#FFD27F',
};
const TYPE_ICONS: Record<string, string> = {
  Card: '\uD83C\uDCCF', Stone: '\uD83D\uDC8E', Role: '\uD83C\uDFC5', Tickets: '\uD83C\uDFAB', Background: '\uD83D\uDDBC\uFE0F',
};

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

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

// ── Main Page ──

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorConfig[]>([]);
  const [selunaItems, setSelunaItems] = useState<SelunaItem[]>([]);
  const [selunaOpen, setSelunaOpen] = useState(false);
  const [activeShop, setActiveShop] = useState<ActiveShop | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeVendorTab, setActiveVendorTab] = useState<string>('');

  // Modals
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<SelunaItem | null>(null);
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  // Vendor item editing
  const [editingVendorItem, setEditingVendorItem] = useState<{ vendorId: string; itemIdx: number } | null>(null);
  const [vendorItemPrice, setVendorItemPrice] = useState('');
  const [vendorItemName, setVendorItemName] = useState('');

  // Add item form
  const [newItem, setNewItem] = useState({
    type: 'Card' as SelunaItem['type'],
    name: '', price: '', stock: '-1', rarity: 'LEGENDARY', roleId: '', amount: '1', description: '',
    backgroundType: 'profile' as 'profile' | 'rank' | 'both',
    rankBackgroundUrl: '',
  });
  const [bgImageFile, setBgImageFile] = useState<File | null>(null);
  const [bgImagePreview, setBgImagePreview] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [vendorRes, selunaRes] = await Promise.all([
        fetch('/api/admin/vendors'),
        fetch('/api/admin/vendors/seluna'),
      ]);
      if (vendorRes.ok) {
        const data = await vendorRes.json();
        const vList = (data.vendors ?? []).map((v: any) => ({
          id: typeof v.id === 'object' ? v.id.toString() : v.id,
          data: v.data ?? { title: v.id, description: '', items: [] },
        }));
        setVendors(vList);
        if (vList.length > 0 && !activeVendorTab) setActiveVendorTab(vList[0].id);
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
  }, [toast, activeVendorTab]);

  useEffect(() => { fetchData(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Seluna Actions ──

  async function handleAddItem() {
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

      // Background-specific fields
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
      setShowAddItem(false);
      setNewItem({ type: 'Card', name: '', price: '', stock: '-1', rarity: 'LEGENDARY', roleId: '', amount: '1', description: '', backgroundType: 'profile', rankBackgroundUrl: '' });
      setBgImageFile(null);
      setBgImagePreview(null);
      toast('Item added to Seluna inventory', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to add item', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateItem() {
    if (!editingItem) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/vendors/seluna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ action: 'update_item', itemId: editingItem.id, updates: editingItem }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setSelunaItems(prev => prev.map(i => i.id === editingItem.id ? editingItem : i));
      setEditingItem(null);
      toast('Item updated', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/vendors/seluna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ action: 'remove_item', itemId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setSelunaItems(prev => prev.filter(i => i.id !== itemId));
      setConfirmRemoveItem(null);
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

  // ── Vendor Item Save ──

  async function handleVendorItemSave(vendorId: string, itemIdx: number) {
    const vendor = vendors.find(v => v.id === vendorId);
    if (!vendor) return;
    setSaving(true);
    try {
      const updatedItems = [...vendor.data.items];
      updatedItems[itemIdx] = {
        ...updatedItems[itemIdx],
        name: vendorItemName || updatedItems[itemIdx].name,
        price: parseInt(vendorItemPrice) || updatedItems[itemIdx].price,
      };
      const updatedData = { ...vendor.data, items: updatedItems };
      const res = await fetch('/api/admin/vendors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ vendorId, data: updatedData }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, data: updatedData } : v));
      setEditingVendorItem(null);
      toast('Item updated', 'success');
    } catch (err: any) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title">Vendors & Seluna</h1>
          <p className="admin-page-subtitle">Manage vendor inventory, prices, and the rare trader</p>
        </div>
        <div className="admin-loading"><div className="admin-spinner" />Loading vendors...</div>
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Vendors & Seluna</h1>
        <p className="admin-page-subtitle">Manage vendor inventory, prices, and the rare trader</p>
      </div>

      {/* ── Seluna Section ── */}
      <div className="admin-card vendor-seluna-card" style={{ marginBottom: '32px' }}>
        <div className="vendor-seluna-header">
          <div className="vendor-seluna-title-area">
            <div className="vendor-avatar-glow vendor-avatar-seluna">
              <span className="vendor-avatar-icon">\uD83C\uDF19</span>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
              Inventory ({selunaItems.length} items)
            </h4>
            <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => setShowAddItem(true)}>
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
                      onClick={() => setEditingItem({ ...item })}>
                      Edit
                    </button>
                    <button className="admin-btn admin-btn-danger admin-btn-sm"
                      onClick={() => setConfirmRemoveItem(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seluna Actions */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(0, 212, 255, 0.06)' }}>
          {selunaOpen ? (
            <button className="admin-btn admin-btn-danger" onClick={() => setConfirmClose(true)}>
              Force Close Shop
            </button>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '8px 0' }}>
              Shop opens automatically on full moon via the bot. Use inventory above to manage items.
            </span>
          )}
        </div>
      </div>

      {/* ── Vendor Shops ── */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 0' }}>
          <h3 className="admin-card-title" style={{ marginBottom: '16px' }}>Vendor Shops</h3>
        </div>

        {vendors.length > 0 && (
          <>
            <div className="admin-tabs" style={{ paddingLeft: '24px' }}>
              {vendors.map((v) => (
                <button
                  key={v.id}
                  className={`admin-tab ${activeVendorTab === v.id ? 'admin-tab-active' : ''}`}
                  onClick={() => setActiveVendorTab(v.id)}
                >
                  {v.data.title || v.id}
                </button>
              ))}
            </div>

            {vendors.filter(v => v.id === activeVendorTab).map((vendor) => (
              <div key={vendor.id} style={{ padding: '24px' }}>
                {/* Vendor header */}
                <div className="vendor-shop-header">
                  {vendor.data.image && (
                    <div className="vendor-avatar-glow">
                      <img src={vendor.data.image} alt={vendor.data.title} className="vendor-avatar-img" />
                    </div>
                  )}
                  <div>
                    <h4 style={{ fontSize: '18px', margin: '0 0 4px', color: 'var(--text-primary)' }}>
                      {vendor.data.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                      {vendor.data.description}
                    </p>
                  </div>
                </div>

                {/* Items table */}
                {vendor.data.items && vendor.data.items.length > 0 ? (
                  <div className="admin-table-wrap" style={{ marginTop: '16px' }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Price</th>
                          {vendor.data.items.some(i => i.roleId) && <th>Role ID</th>}
                          <th style={{ width: '120px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendor.data.items.map((item, idx) => (
                          <tr key={item.id || idx}>
                            <td style={{ fontWeight: 500 }}>{item.name}</td>
                            <td>
                              {editingVendorItem?.vendorId === vendor.id && editingVendorItem.itemIdx === idx ? (
                                <input
                                  type="number"
                                  className="admin-form-input"
                                  value={vendorItemPrice}
                                  onChange={(e) => setVendorItemPrice(e.target.value)}
                                  style={{ width: '120px', padding: '4px 8px', fontSize: '13px' }}
                                />
                              ) : (
                                <span className="vendor-price">{formatLunari(item.price)}</span>
                              )}
                            </td>
                            {vendor.data.items.some(i => i.roleId) && (
                              <td style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {item.roleId || '—'}
                              </td>
                            )}
                            <td>
                              {editingVendorItem?.vendorId === vendor.id && editingVendorItem.itemIdx === idx ? (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button className="admin-btn admin-btn-primary admin-btn-sm"
                                    onClick={() => handleVendorItemSave(vendor.id, idx)} disabled={saving}>
                                    Save
                                  </button>
                                  <button className="admin-btn admin-btn-ghost admin-btn-sm"
                                    onClick={() => setEditingVendorItem(null)}>
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button className="admin-btn admin-btn-ghost admin-btn-sm"
                                  onClick={() => {
                                    setEditingVendorItem({ vendorId: vendor.id, itemIdx: idx });
                                    setVendorItemPrice(String(item.price));
                                    setVendorItemName(item.name);
                                  }}>
                                  Edit Price
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="admin-empty" style={{ padding: '24px' }}>
                    <p>No items configured for this vendor</p>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {vendors.length === 0 && (
          <div className="admin-empty" style={{ padding: '40px' }}>
            <p>No vendor configurations found in the database</p>
          </div>
        )}
      </div>

      {/* ── Add Item Modal ── */}
      <AdminLightbox isOpen={showAddItem} onClose={() => setShowAddItem(false)} title="Add Item to Seluna" size="lg">
            <p className="admin-modal-message">Add a new item to Seluna&apos;s rare trader inventory.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">Type</label>
                <select className="admin-select" value={newItem.type}
                  onChange={(e) => setNewItem(p => ({ ...p, type: e.target.value as any }))}>
                  {ITEM_TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>)}
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Name</label>
                <input className="admin-form-input" placeholder="e.g. Luna Sentinel"
                  value={newItem.name} onChange={(e) => setNewItem(p => ({ ...p, name: e.target.value }))} />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Price (Lunari)</label>
                <input className="admin-form-input" type="number" placeholder="50000"
                  value={newItem.price} onChange={(e) => setNewItem(p => ({ ...p, price: e.target.value }))} />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Stock<span className="admin-tooltip-trigger" data-tooltip="-1 = unlimited stock">?</span></label>
                <input className="admin-form-input" type="number" placeholder="-1"
                  value={newItem.stock} onChange={(e) => setNewItem(p => ({ ...p, stock: e.target.value }))} />
              </div>

              {newItem.type === 'Card' && (
                <div className="admin-form-group">
                  <label className="admin-form-label">Rarity</label>
                  <select className="admin-select" value={newItem.rarity}
                    onChange={(e) => setNewItem(p => ({ ...p, rarity: e.target.value }))}>
                    {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              {newItem.type === 'Role' && (
                <div className="admin-form-group">
                  <label className="admin-form-label">Discord Role ID</label>
                  <input className="admin-form-input" placeholder="Role ID"
                    value={newItem.roleId} onChange={(e) => setNewItem(p => ({ ...p, roleId: e.target.value }))} />
                </div>
              )}

              {newItem.type === 'Tickets' && (
                <div className="admin-form-group">
                  <label className="admin-form-label">Ticket Amount</label>
                  <input className="admin-form-input" type="number" placeholder="1"
                    value={newItem.amount} onChange={(e) => setNewItem(p => ({ ...p, amount: e.target.value }))} />
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
                    <div className="admin-form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="admin-form-label">Rank Background URL (optional, if different from main image)</label>
                      <input className="admin-form-input" placeholder="https://assets.lunarian.app/..."
                        value={newItem.rankBackgroundUrl} onChange={(e) => setNewItem(p => ({ ...p, rankBackgroundUrl: e.target.value }))} />
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
              <button className="admin-btn admin-btn-ghost" onClick={() => setShowAddItem(false)}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleAddItem} disabled={saving}>
                {saving ? 'Adding...' : 'Add Item'}
              </button>
            </div>
      </AdminLightbox>

      {/* ── Edit Item Modal ── */}
      <AdminLightbox isOpen={editingItem !== null} onClose={() => setEditingItem(null)} title="Edit Item" size="lg">
        {editingItem && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">Name</label>
                <input className="admin-form-input" value={editingItem.name}
                  onChange={(e) => setEditingItem(p => p ? { ...p, name: e.target.value } : p)} />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Price (Lunari)</label>
                <input className="admin-form-input" type="number" value={editingItem.price}
                  onChange={(e) => setEditingItem(p => p ? { ...p, price: parseInt(e.target.value) || 0 } : p)} />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Stock<span className="admin-tooltip-trigger" data-tooltip="-1 = unlimited stock">?</span></label>
                <input className="admin-form-input" type="number" value={editingItem.stock}
                  onChange={(e) => setEditingItem(p => p ? { ...p, stock: parseInt(e.target.value) } : p)} />
              </div>

              {editingItem.type === 'Card' && (
                <div className="admin-form-group">
                  <label className="admin-form-label">Rarity</label>
                  <select className="admin-select" value={editingItem.rarity ?? 'COMMON'}
                    onChange={(e) => setEditingItem(p => p ? { ...p, rarity: e.target.value } : p)}>
                    {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              {editingItem.type === 'Tickets' && (
                <div className="admin-form-group">
                  <label className="admin-form-label">Ticket Amount</label>
                  <input className="admin-form-input" type="number" value={editingItem.amount ?? 1}
                    onChange={(e) => setEditingItem(p => p ? { ...p, amount: parseInt(e.target.value) || 1 } : p)} />
                </div>
              )}
            </div>

            <div className="admin-modal-actions" style={{ marginTop: '20px' }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setEditingItem(null)}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleUpdateItem} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </AdminLightbox>

      {/* ── Confirm Remove ── */}
      {confirmRemoveItem && (
        <ConfirmModal
          title="Remove Item"
          message={`Remove "${selunaItems.find(i => i.id === confirmRemoveItem)?.name}" from Seluna's inventory?`}
          confirmLabel="Remove"
          variant="danger"
          onConfirm={() => handleRemoveItem(confirmRemoveItem)}
          onCancel={() => setConfirmRemoveItem(null)}
        />
      )}

      {/* ── Confirm Close ── */}
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
