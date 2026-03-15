'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import AdminLightbox from '../components/AdminLightbox';
import { useToast } from '../components/Toast';

// ── Types ──

interface RaritySlot {
  rarity: string;
  percentage: number;
}

interface CardOverride {
  name: string;
  weight: number;
}

interface LuckboxBox {
  id: string;
  label: string;
  price: number;
  rarities: RaritySlot[];
  enabled: boolean;
  order: number;
  cardOverrides?: Record<string, CardOverride[]>;
}

interface StoneConfig {
  name: string;
  weight: number;
  sell_price: number;
  imageUrl: string;
}

interface StoneBoxConfig {
  price: number;
  refundAmount: number;
  stones: StoneConfig[];
}

interface TicketPackage {
  id: string;
  name: string;
  tickets: number;
  price: number;
}

type ShopTab = 'luckbox' | 'stonebox' | 'tickets';

const VALID_RARITIES = ['common', 'rare', 'epic', 'unique', 'legendary', 'secret', 'forbidden'] as const;
const RARITY_COLORS: Record<string, string> = {
  common: '#4ade80',
  rare: '#0077FF',
  epic: '#B066FF',
  unique: '#FF3366',
  legendary: '#FFD54F',
  secret: '#FFD27F',
  forbidden: '#ff4444',
};

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function formatLunari(n: number): string {
  return n.toLocaleString();
}

// ── Main Page ──

export default function ShopsPage() {
  const [activeTab, setActiveTab] = useState<ShopTab>('luckbox');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data
  const [luckboxTiers, setLuckboxTiers] = useState<LuckboxBox[]>([]);
  const [stoneBox, setStoneBox] = useState<StoneBoxConfig>({ price: 2000, refundAmount: 1000, stones: [] });
  const [ticketPackages, setTicketPackages] = useState<TicketPackage[]>([]);

  // Edit states
  const [editingLuckbox, setEditingLuckbox] = useState<LuckboxBox | null>(null);
  const [editingStone, setEditingStone] = useState<{ index: number; stone: StoneConfig } | null>(null);
  const [editingTicket, setEditingTicket] = useState<TicketPackage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: string } | null>(null);

  // Cards catalog for luckbox card overrides
  const [cardsCatalog, setCardsCatalog] = useState<Record<string, { name: string; weight: number }[]>>({});
  const [cardsLoaded, setCardsLoaded] = useState(false);

  // Stonebox price editing
  const [editStonePrice, setEditStonePrice] = useState(false);
  const [stonePriceInput, setStonePriceInput] = useState('');
  const [stoneRefundInput, setStoneRefundInput] = useState('');

  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shops/config');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setLuckboxTiers(data.luckbox ?? []);
      if (data.stonebox) setStoneBox(data.stonebox);
      setTicketPackages(data.tickets ?? []);
    } catch {
      toast('Failed to load shop config', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch cards catalog when luckbox modal opens (for card overrides)
  useEffect(() => {
    if (editingLuckbox && !cardsLoaded) {
      fetch('/api/admin/cards/config')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.rarities) {
            const catalog: Record<string, { name: string; weight: number }[]> = {};
            for (const { rarity, items } of data.rarities) {
              catalog[rarity.toUpperCase()] = items.map((c: any) => ({ name: c.name, weight: c.weight }));
            }
            setCardsCatalog(catalog);
            setCardsLoaded(true);
          }
        })
        .catch(() => {});
    }
  }, [editingLuckbox, cardsLoaded]);

  // ── Save helpers ──

  async function saveLuckbox(tiers: LuckboxBox[]) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/shops/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ shop: 'luckbox', config: { tiers } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setLuckboxTiers(data.tiers);
      toast('Luckbox config saved', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveStoneBox(config: StoneBoxConfig) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/shops/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ shop: 'stonebox', config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setStoneBox(data.config);
      toast('Stone box config saved', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveTickets(packages: TicketPackage[]) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/shops/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ shop: 'tickets', config: { packages } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setTicketPackages(data.packages);
      toast('Ticket packages saved', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Luckbox handlers ──

  function handleAddLuckbox() {
    setEditingLuckbox({
      id: '',
      label: '',
      price: 500,
      rarities: [{ rarity: 'common', percentage: 100 }],
      enabled: true,
      order: luckboxTiers.length,
    });
  }

  function handleSaveLuckbox() {
    if (!editingLuckbox) return;
    const box = editingLuckbox;
    if (!box.id.trim() || !box.label.trim()) {
      toast('ID and Label are required', 'error');
      return;
    }

    const totalPct = box.rarities.reduce((s, r) => s + r.percentage, 0);
    if (totalPct > 100.01) {
      toast(`Rarity percentages cannot exceed 100 (currently ${totalPct})`, 'error');
      return;
    }

    const exists = luckboxTiers.find(t => t.id === box.id);
    let updated: LuckboxBox[];
    if (exists) {
      updated = luckboxTiers.map(t => t.id === box.id ? box : t);
    } else {
      updated = [...luckboxTiers, box];
    }

    saveLuckbox(updated);
    setEditingLuckbox(null);
  }

  function handleDeleteLuckbox(id: string) {
    const updated = luckboxTiers.filter(t => t.id !== id);
    saveLuckbox(updated);
    setConfirmDelete(null);
  }

  function handleToggleLuckbox(id: string) {
    const updated = luckboxTiers.map(t =>
      t.id === id ? { ...t, enabled: !t.enabled } : t
    );
    saveLuckbox(updated);
  }

  // ── Stonebox handlers ──

  function handleSaveStonePrices() {
    const price = parseInt(stonePriceInput) || stoneBox.price;
    const refundAmount = parseInt(stoneRefundInput) || stoneBox.refundAmount;
    saveStoneBox({ ...stoneBox, price, refundAmount });
    setEditStonePrice(false);
  }

  function handleSaveStone() {
    if (!editingStone) return;
    const { index, stone } = editingStone;
    if (!stone.name.trim()) {
      toast('Stone name required', 'error');
      return;
    }

    let updated: StoneConfig[];
    if (index === -1) {
      // New stone
      updated = [...stoneBox.stones, stone];
    } else {
      updated = stoneBox.stones.map((s, i) => i === index ? stone : s);
    }

    saveStoneBox({ ...stoneBox, stones: updated });
    setEditingStone(null);
  }

  function handleDeleteStone(index: number) {
    const updated = stoneBox.stones.filter((_, i) => i !== index);
    saveStoneBox({ ...stoneBox, stones: updated });
    setConfirmDelete(null);
  }

  // ── Ticket handlers ──

  function handleAddTicket() {
    setEditingTicket({
      id: `pack${ticketPackages.length + 1}`,
      name: '',
      tickets: 1,
      price: 1000,
    });
  }

  function handleSaveTicket() {
    if (!editingTicket) return;
    if (!editingTicket.name.trim() || !editingTicket.id.trim()) {
      toast('ID and Name are required', 'error');
      return;
    }

    const exists = ticketPackages.find(p => p.id === editingTicket.id);
    let updated: TicketPackage[];
    if (exists) {
      updated = ticketPackages.map(p => p.id === editingTicket.id ? editingTicket : p);
    } else {
      updated = [...ticketPackages, editingTicket];
    }

    saveTickets(updated);
    setEditingTicket(null);
  }

  function handleDeleteTicket(id: string) {
    const updated = ticketPackages.filter(p => p.id !== id);
    saveTickets(updated);
    setConfirmDelete(null);
  }

  // ── Render ──

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title">Shop Configuration</h1>
          <p className="admin-page-subtitle">Manage luckbox tiers, stone boxes, and ticket packages</p>
        </div>
        <div className="admin-loading"><div className="admin-spinner" />Loading...</div>
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Shop Configuration</h1>
        <p className="admin-page-subtitle">Manage luckbox tiers, stone boxes, and ticket packages</p>
      </div>

      {/* Tabs */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="admin-tabs" style={{ paddingLeft: '24px' }}>
          <button className={`admin-tab ${activeTab === 'luckbox' ? 'admin-tab-active' : ''}`}
            onClick={() => setActiveTab('luckbox')}>
            Luckboxes (Kael)
          </button>
          <button className={`admin-tab ${activeTab === 'stonebox' ? 'admin-tab-active' : ''}`}
            onClick={() => setActiveTab('stonebox')}>
            Stone Boxes (Meluna)
          </button>
          <button className={`admin-tab ${activeTab === 'tickets' ? 'admin-tab-active' : ''}`}
            onClick={() => setActiveTab('tickets')}>
            Tickets (Zoldar)
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* ── Luckbox Tab ── */}
          {activeTab === 'luckbox' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: '16px' }}>
                    Luckbox Tiers
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
                    Each box can contain cards from one or multiple rarities with custom percentages.
                  </p>
                </div>
                <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={handleAddLuckbox}>
                  + Add Box
                </button>
              </div>

              <div className="vendor-items-grid">
                {luckboxTiers.map((box) => (
                  <div key={box.id} className={`vendor-item-card ${!box.enabled ? 'vendor-item-disabled' : ''}`}
                    style={{ opacity: box.enabled ? 1 : 0.5 }}>
                    <div className="vendor-item-header">
                      <span className="vendor-item-type-icon" style={{ fontSize: '18px' }}>
                        {box.rarities.length > 1 ? '\uD83C\uDFB2' : '\uD83C\uDFF0'}
                      </span>
                      <span className="vendor-item-name">{box.label}</span>
                      {!box.enabled && (
                        <span className="admin-badge admin-badge-muted" style={{ fontSize: '10px' }}>DISABLED</span>
                      )}
                    </div>

                    <div className="vendor-item-details">
                      <div className="vendor-item-detail">
                        <span className="vendor-item-detail-label">Price</span>
                        <span className="vendor-item-detail-value vendor-price">{formatLunari(box.price)}</span>
                      </div>
                      <div className="vendor-item-detail">
                        <span className="vendor-item-detail-label">ID</span>
                        <span className="vendor-item-detail-value" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{box.id}</span>
                      </div>
                    </div>

                    {/* Rarity breakdown */}
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Rarities:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {box.rarities.map((r, i) => (
                          <span key={i} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                            color: RARITY_COLORS[r.rarity] ?? '#fff',
                            border: `1px solid ${RARITY_COLORS[r.rarity] ?? '#555'}`,
                            background: `${RARITY_COLORS[r.rarity] ?? '#555'}15`,
                          }}>
                            {r.rarity.toUpperCase()} {r.percentage}%
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="vendor-item-actions" style={{ marginTop: '12px' }}>
                      <button className="admin-btn admin-btn-ghost admin-btn-sm"
                        onClick={() => setEditingLuckbox({ ...box })}>
                        Edit
                      </button>
                      <button className={`admin-btn admin-btn-sm ${box.enabled ? 'admin-btn-ghost' : 'admin-btn-primary'}`}
                        onClick={() => handleToggleLuckbox(box.id)} disabled={saving}>
                        {box.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button className="admin-btn admin-btn-danger admin-btn-sm"
                        onClick={() => setConfirmDelete({ type: 'luckbox', id: box.id })}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {luckboxTiers.length === 0 && (
                <div className="admin-empty" style={{ padding: '40px' }}>
                  <p>No luckbox tiers configured. Click &quot;Add Box&quot; to create one, or the default hardcoded tiers will be used.</p>
                </div>
              )}
            </>
          )}

          {/* ── Stonebox Tab ── */}
          {activeTab === 'stonebox' && (
            <>
              {/* Price config */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: '16px' }}>
                    Stone Box Configuration
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
                    50% chance to get a stone, 50% partial refund. Manage stones and their drop weights.
                  </p>
                </div>
                <button className="admin-btn admin-btn-primary admin-btn-sm"
                  onClick={() => setEditingStone({ index: -1, stone: { name: '', weight: 1, sell_price: 500, imageUrl: '' } })}>
                  + Add Stone
                </button>
              </div>

              {/* Price / Refund row */}
              <div className="admin-card" style={{ padding: '16px', marginBottom: '20px', background: 'rgba(0,212,255,0.03)' }}>
                {editStonePrice ? (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <div className="admin-form-group" style={{ margin: 0, flex: 1 }}>
                      <label className="admin-form-label">Box Price</label>
                      <input className="admin-form-input" type="number" value={stonePriceInput}
                        onChange={e => setStonePriceInput(e.target.value)} />
                    </div>
                    <div className="admin-form-group" style={{ margin: 0, flex: 1 }}>
                      <label className="admin-form-label">Refund Amount (on miss)</label>
                      <input className="admin-form-input" type="number" value={stoneRefundInput}
                        onChange={e => setStoneRefundInput(e.target.value)} />
                    </div>
                    <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={handleSaveStonePrices} disabled={saving}>
                      Save
                    </button>
                    <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setEditStonePrice(false)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Box Price</span>
                      <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                        {formatLunari(stoneBox.price)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Refund on Miss</span>
                      <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {formatLunari(stoneBox.refundAmount)}
                      </div>
                    </div>
                    <button className="admin-btn admin-btn-ghost admin-btn-sm"
                      onClick={() => {
                        setStonePriceInput(String(stoneBox.price));
                        setStoneRefundInput(String(stoneBox.refundAmount));
                        setEditStonePrice(true);
                      }}>
                      Edit Prices
                    </button>
                  </div>
                )}
              </div>

              {/* Stones table */}
              {stoneBox.stones.length > 0 ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Stone</th>
                        <th>Weight</th>
                        <th>Drop %</th>
                        <th>Sell Price</th>
                        <th style={{ width: '120px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const totalWeight = stoneBox.stones.filter(s => s.weight > 0)
                          .reduce((sum, s) => sum + Math.max(1, Math.round(s.weight * 1000)), 0);
                        return stoneBox.stones.map((stone, idx) => {
                          const entries = Math.max(1, Math.round(stone.weight * 1000));
                          const dropPct = stone.weight === 0 ? 0 : Math.round((entries / totalWeight) * 10000) / 100;
                          return (
                            <tr key={idx}>
                              <td style={{ fontWeight: 500 }}>
                                {stone.imageUrl && (
                                  <img src={stone.imageUrl} alt="" style={{ width: 20, height: 20, borderRadius: 4, marginRight: 8, verticalAlign: 'middle' }} />
                                )}
                                {stone.name}
                              </td>
                              <td>{stone.weight}</td>
                              <td>{dropPct}%</td>
                              <td className="vendor-price">{formatLunari(stone.sell_price)}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button className="admin-btn admin-btn-ghost admin-btn-sm"
                                    onClick={() => setEditingStone({ index: idx, stone: { ...stone } })}>
                                    Edit
                                  </button>
                                  <button className="admin-btn admin-btn-danger admin-btn-sm"
                                    onClick={() => setConfirmDelete({ type: 'stone', id: String(idx) })}>
                                    Del
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="admin-empty" style={{ padding: '32px' }}>
                  <p>No stones configured. Default hardcoded stones will be used.</p>
                </div>
              )}
            </>
          )}

          {/* ── Tickets Tab ── */}
          {activeTab === 'tickets' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: '16px' }}>
                    Ticket Packages
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
                    Manage Zoldar&apos;s ticket packages: name, price, and ticket count.
                  </p>
                </div>
                <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={handleAddTicket}>
                  + Add Package
                </button>
              </div>

              {ticketPackages.length > 0 ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Tickets</th>
                        <th>Price</th>
                        <th style={{ width: '120px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ticketPackages.map((pkg) => (
                        <tr key={pkg.id}>
                          <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{pkg.id}</td>
                          <td style={{ fontWeight: 500 }}>{pkg.name}</td>
                          <td>{pkg.tickets}</td>
                          <td className="vendor-price">{formatLunari(pkg.price)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button className="admin-btn admin-btn-ghost admin-btn-sm"
                                onClick={() => setEditingTicket({ ...pkg })}>
                                Edit
                              </button>
                              <button className="admin-btn admin-btn-danger admin-btn-sm"
                                onClick={() => setConfirmDelete({ type: 'ticket', id: pkg.id })}>
                                Del
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="admin-empty" style={{ padding: '32px' }}>
                  <p>No ticket packages configured. Default hardcoded packages will be used.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Luckbox Edit Modal ── */}
      <AdminLightbox
        isOpen={editingLuckbox !== null}
        onClose={() => setEditingLuckbox(null)}
        title={editingLuckbox && luckboxTiers.find(t => t.id === editingLuckbox?.id) ? 'Edit Box' : 'Add New Box'}
        size="lg"
      >
        {editingLuckbox && (
          <>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">Box ID</label>
                <input className="admin-form-input" value={editingLuckbox.id}
                  disabled={!!luckboxTiers.find(t => t.id === editingLuckbox.id)}
                  onChange={e => setEditingLuckbox({ ...editingLuckbox, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                  placeholder="e.g. mixed_epic" />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Label</label>
                <input className="admin-form-input" value={editingLuckbox.label}
                  onChange={e => setEditingLuckbox({ ...editingLuckbox, label: e.target.value })}
                  placeholder="e.g. Epic Box" />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Price (Lunari)</label>
                <input className="admin-form-input" type="number" value={editingLuckbox.price}
                  onChange={e => setEditingLuckbox({ ...editingLuckbox, price: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Order</label>
                <input className="admin-form-input" type="number" value={editingLuckbox.order}
                  onChange={e => setEditingLuckbox({ ...editingLuckbox, order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            {/* Rarity slots */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="admin-form-label" style={{ margin: 0 }}>
                  Rarities (max 100% — remainder is miss chance)
                </label>
                {editingLuckbox.rarities.length < 6 && (
                  <button className="admin-btn admin-btn-ghost admin-btn-sm"
                    onClick={() => setEditingLuckbox({
                      ...editingLuckbox,
                      rarities: [...editingLuckbox.rarities, { rarity: 'common', percentage: 0 }],
                    })}>
                    + Rarity
                  </button>
                )}
              </div>

              {editingLuckbox.rarities.map((slot, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <select className="admin-select" value={slot.rarity} style={{ flex: 1 }}
                    onChange={e => {
                      const updated = [...editingLuckbox.rarities];
                      updated[i] = { ...updated[i], rarity: e.target.value };
                      setEditingLuckbox({ ...editingLuckbox, rarities: updated });
                    }}>
                    {VALID_RARITIES.map(r => (
                      <option key={r} value={r} style={{ color: RARITY_COLORS[r] }}>{r.toUpperCase()}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input className="admin-form-input" type="number" min={0.1} max={100} step={0.1}
                      style={{ width: '80px' }} value={slot.percentage}
                      onChange={e => {
                        const updated = [...editingLuckbox.rarities];
                        updated[i] = { ...updated[i], percentage: parseFloat(e.target.value) || 0 };
                        setEditingLuckbox({ ...editingLuckbox, rarities: updated });
                      }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>%</span>
                  </div>
                  {editingLuckbox.rarities.length > 1 && (
                    <button className="admin-btn admin-btn-danger admin-btn-sm"
                      onClick={() => {
                        const updated = editingLuckbox.rarities.filter((_, j) => j !== i);
                        setEditingLuckbox({ ...editingLuckbox, rarities: updated });
                      }}>
                      X
                    </button>
                  )}
                </div>
              ))}

              {/* Sum indicator */}
              {(() => {
                const total = editingLuckbox.rarities.reduce((s, r) => s + r.percentage, 0);
                return (
                  <div style={{
                    fontSize: '12px', fontWeight: 600, marginTop: '4px',
                    color: total > 100.01 ? '#f43f5e' : total < 100 ? '#facc15' : '#4ade80',
                  }}>
                    Total: {total}%{total > 100.01 ? ' (exceeds 100!)' : total < 100 ? ` — ${(100 - total).toFixed(1)}% miss chance (refund half)` : ''}
                  </div>
                );
              })()}
            </div>

            {/* Card Overrides — pick specific cards per rarity with custom weights */}
            <div style={{ marginTop: '20px' }}>
              <label className="admin-form-label" style={{ marginBottom: '8px', display: 'block' }}>
                Card Overrides (optional — leave empty to use all cards from each rarity)
              </label>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Pick specific cards and set custom weights for this box only. Cards not listed use default weights.
              </p>

              {editingLuckbox.rarities.map((slot) => {
                const rarity = slot.rarity.toUpperCase();
                const available = cardsCatalog[rarity] ?? [];
                const overrides = editingLuckbox.cardOverrides?.[rarity] ?? [];

                if (available.length === 0) return null;

                return (
                  <div key={rarity} style={{ marginBottom: '12px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: RARITY_COLORS[slot.rarity] ?? '#fff' }}>
                        {rarity} {overrides.length > 0 ? `(${overrides.length} selected)` : '(all cards)'}
                      </span>
                      {overrides.length === 0 ? (
                        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => {
                          setEditingLuckbox({
                            ...editingLuckbox,
                            cardOverrides: {
                              ...editingLuckbox.cardOverrides,
                              [rarity]: available.map(c => ({ name: c.name, weight: c.weight })),
                            },
                          });
                        }}>
                          Customize Cards
                        </button>
                      ) : (
                        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => {
                          const updated = { ...editingLuckbox.cardOverrides };
                          delete updated[rarity];
                          setEditingLuckbox({ ...editingLuckbox, cardOverrides: Object.keys(updated).length > 0 ? updated : undefined });
                        }}>
                          Reset to All
                        </button>
                      )}
                    </div>

                    {overrides.length > 0 && (
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {overrides.map((card, ci) => (
                          <div key={ci} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                            <select className="admin-select" style={{ flex: 1, fontSize: '12px' }}
                              value={card.name}
                              onChange={e => {
                                const updated = [...overrides];
                                updated[ci] = { ...updated[ci], name: e.target.value };
                                setEditingLuckbox({
                                  ...editingLuckbox,
                                  cardOverrides: { ...editingLuckbox.cardOverrides, [rarity]: updated },
                                });
                              }}>
                              {available.map(c => (
                                <option key={c.name} value={c.name}>{c.name}</option>
                              ))}
                            </select>
                            <input className="admin-form-input" type="number" min={0} step={0.1}
                              style={{ width: '70px', fontSize: '12px' }} value={card.weight}
                              title="Weight (higher = more likely to be drawn)"
                              onChange={e => {
                                const updated = [...overrides];
                                updated[ci] = { ...updated[ci], weight: parseFloat(e.target.value) || 0 };
                                setEditingLuckbox({
                                  ...editingLuckbox,
                                  cardOverrides: { ...editingLuckbox.cardOverrides, [rarity]: updated },
                                });
                              }} />
                            <button className="admin-btn admin-btn-danger admin-btn-sm" style={{ fontSize: '11px', padding: '2px 6px' }}
                              onClick={() => {
                                const updated = overrides.filter((_, j) => j !== ci);
                                setEditingLuckbox({
                                  ...editingLuckbox,
                                  cardOverrides: {
                                    ...editingLuckbox.cardOverrides,
                                    [rarity]: updated.length > 0 ? updated : undefined as any,
                                  },
                                });
                                // Clean up empty overrides
                                if (updated.length === 0) {
                                  const cleaned = { ...editingLuckbox.cardOverrides };
                                  delete cleaned[rarity];
                                  setEditingLuckbox({ ...editingLuckbox, cardOverrides: Object.keys(cleaned).length > 0 ? cleaned : undefined });
                                }
                              }}>X</button>
                          </div>
                        ))}
                        <button className="admin-btn admin-btn-ghost admin-btn-sm" style={{ marginTop: '4px', fontSize: '11px' }}
                          onClick={() => {
                            const firstAvailable = available.find(c => !overrides.some(o => o.name === c.name));
                            if (!firstAvailable) return;
                            setEditingLuckbox({
                              ...editingLuckbox,
                              cardOverrides: {
                                ...editingLuckbox.cardOverrides,
                                [rarity]: [...overrides, { name: firstAvailable.name, weight: firstAvailable.weight }],
                              },
                            });
                          }}>
                          + Add Card
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="admin-modal-actions" style={{ marginTop: '20px' }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setEditingLuckbox(null)}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleSaveLuckbox} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </AdminLightbox>

      {/* ── Stone Edit Modal ── */}
      <AdminLightbox
        isOpen={editingStone !== null}
        onClose={() => setEditingStone(null)}
        title={editingStone?.index === -1 ? 'Add Stone' : 'Edit Stone'}
        size="lg"
      >
        {editingStone && (
          <>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="admin-form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="admin-form-label">Name</label>
                <input className="admin-form-input" value={editingStone.stone.name}
                  onChange={e => setEditingStone({ ...editingStone, stone: { ...editingStone.stone, name: e.target.value } })}
                  placeholder="e.g. Lunar Stone" />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Weight (drop rate)</label>
                <input className="admin-form-input" type="number" step="0.01" value={editingStone.stone.weight}
                  onChange={e => setEditingStone({ ...editingStone, stone: { ...editingStone.stone, weight: parseFloat(e.target.value) || 0 } })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Sell Price</label>
                <input className="admin-form-input" type="number" value={editingStone.stone.sell_price}
                  onChange={e => setEditingStone({ ...editingStone, stone: { ...editingStone.stone, sell_price: parseInt(e.target.value) || 0 } })} />
              </div>
              <div className="admin-form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="admin-form-label">Image URL</label>
                <input className="admin-form-input" value={editingStone.stone.imageUrl}
                  onChange={e => setEditingStone({ ...editingStone, stone: { ...editingStone.stone, imageUrl: e.target.value } })}
                  placeholder="https://assets.lunarian.app/stones/..." />
              </div>
            </div>

            <div className="admin-modal-actions" style={{ marginTop: '20px' }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setEditingStone(null)}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleSaveStone} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </AdminLightbox>

      {/* ── Ticket Edit Modal ── */}
      <AdminLightbox
        isOpen={editingTicket !== null}
        onClose={() => setEditingTicket(null)}
        title={editingTicket && ticketPackages.find(p => p.id === editingTicket?.id) ? 'Edit Package' : 'Add Package'}
        size="md"
      >
        {editingTicket && (
          <>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="admin-form-group">
                <label className="admin-form-label">ID</label>
                <input className="admin-form-input" value={editingTicket.id}
                  disabled={!!ticketPackages.find(p => p.id === editingTicket.id)}
                  onChange={e => setEditingTicket({ ...editingTicket, id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                  placeholder="e.g. pack6" />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Name</label>
                <input className="admin-form-input" value={editingTicket.name}
                  onChange={e => setEditingTicket({ ...editingTicket, name: e.target.value })}
                  placeholder="e.g. Dragon Eyes" />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Tickets</label>
                <input className="admin-form-input" type="number" value={editingTicket.tickets}
                  onChange={e => setEditingTicket({ ...editingTicket, tickets: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Price (Lunari)</label>
                <input className="admin-form-input" type="number" value={editingTicket.price}
                  onChange={e => setEditingTicket({ ...editingTicket, price: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="admin-modal-actions" style={{ marginTop: '20px' }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setEditingTicket(null)}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleSaveTicket} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </AdminLightbox>

      {/* ── Confirm Delete ── */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete Item"
          message={`Are you sure you want to delete this ${confirmDelete.type}? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => {
            if (confirmDelete.type === 'luckbox') handleDeleteLuckbox(confirmDelete.id);
            else if (confirmDelete.type === 'stone') handleDeleteStone(parseInt(confirmDelete.id));
            else if (confirmDelete.type === 'ticket') handleDeleteTicket(confirmDelete.id);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
