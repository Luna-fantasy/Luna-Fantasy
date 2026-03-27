'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ConfirmModal from '../components/ConfirmModal';

const VendorsSection = dynamic(() => import('./VendorsSection'), { ssr: false });
import AdminLightbox from '../components/AdminLightbox';
import ImagePicker from '../components/ImagePicker';
import RichTextArea from '../components/RichTextArea';
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

interface MellsItem {
  id: string;
  name: string;
  description: string;
  price: number;
  roleId: string;
  backgroundUrl: string;
  type: 'profile' | 'rank';
  exclusive?: boolean;
  enabled?: boolean;
}

type ShopTab = 'seluna' | 'mells' | 'luckbox' | 'stonebox' | 'tickets' | 'brimor' | 'broker';

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
  const [activeTab, setActiveTab] = useState<ShopTab>('seluna');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data
  const [luckboxTiers, setLuckboxTiers] = useState<LuckboxBox[]>([]);
  const [stoneBox, setStoneBox] = useState<StoneBoxConfig>({ price: 2000, refundAmount: 1000, stones: [] });
  const [ticketPackages, setTicketPackages] = useState<TicketPackage[]>([]);

  // Mells Selvair state
  const [mellsItems, setMellsItems] = useState<MellsItem[]>([]);
  const [mellsOriginal, setMellsOriginal] = useState<MellsItem[]>([]);
  const [mellsSaving, setMellsSaving] = useState(false);
  const [editingMellsItem, setEditingMellsItem] = useState<MellsItem | null>(null);
  const [mellsSubTab, setMellsSubTab] = useState<'profile' | 'rank'>('profile');

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

  // Trade config
  const [auctionDurationHours, setAuctionDurationHours] = useState(24);
  const [auctionDurationOrig, setAuctionDurationOrig] = useState(24);
  const [tradeSaving, setTradeSaving] = useState(false);

  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shops/config');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setLuckboxTiers(data.luckbox ?? []);
      if (data.stonebox) setStoneBox(data.stonebox);
      setTicketPackages(data.tickets ?? []);
      if (data.mells) {
        setMellsItems(data.mells);
        setMellsOriginal(data.mells);
      }
      // Load trade config from Jester config
      try {
        const jesterRes = await fetch('/api/admin/config/jester');
        if (jesterRes.ok) {
          const jesterData = await jesterRes.json();
          const tradeSection = jesterData.sections?.trade;
          if (tradeSection?.auction_duration_ms) {
            const hours = Math.round(tradeSection.auction_duration_ms / 3_600_000);
            setAuctionDurationHours(hours);
            setAuctionDurationOrig(hours);
          }
        }
      } catch { /* trade config is optional */ }
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
        .catch(() => { setCardsLoaded(true); });
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
      toast('Saved! Changes take effect within 30 seconds.', 'success');
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
      toast('Saved! Changes take effect within 30 seconds.', 'success');
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
      toast('Saved! Changes take effect within 30 seconds.', 'success');
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
    if (Math.abs(totalPct - 100) > 0.1) {
      toast(`Rarity percentages must total 100% (currently ${totalPct.toFixed(1)}%)`, 'error');
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
    const parsedPrice = parseInt(stonePriceInput, 10);
    const price = isNaN(parsedPrice) ? stoneBox.price : parsedPrice;
    const parsedRefund = parseInt(stoneRefundInput, 10);
    const refundAmount = isNaN(parsedRefund) ? stoneBox.refundAmount : parsedRefund;
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
          <h1 className="admin-page-title"><span className="emoji-float">🛒</span> Shops</h1>
          <p className="admin-page-subtitle">Manage luckbox tiers, stone boxes, and ticket packages</p>
        </div>
        <div className="admin-loading"><div className="admin-spinner" />Loading...</div>
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">🛒</span> Shops</h1>
        <p className="admin-page-subtitle">Manage luckbox tiers, stone boxes, and ticket packages</p>
      </div>

      {/* Tabs */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="admin-tabs" style={{ paddingLeft: '24px' }}>
          {([
            { id: 'seluna' as const, label: 'Seluna' },
            { id: 'mells' as const, label: 'Mells Selvair' },
            { id: 'luckbox' as const, label: 'Kael (Luckboxes)' },
            { id: 'stonebox' as const, label: 'Meluna (Stone Boxes)' },
            { id: 'tickets' as const, label: 'Zoldar (Tickets)' },
            { id: 'brimor' as const, label: 'Brimor' },
            { id: 'broker' as const, label: 'Broker' },
          ]).map(t => (
            <button key={t.id} className={`admin-tab ${activeTab === t.id ? 'admin-tab-active' : ''}`}
              onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px' }}>
          {/* ── Mells Selvair Tab ── */}
          {activeTab === 'mells' && (
            <div>
              {/* Stat summary */}
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {mellsItems.length} {mellsItems.length === 1 ? 'item' : 'items'} configured
              </div>

              {/* Sub-tabs for Profile vs Rank */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`admin-btn admin-btn-sm ${mellsSubTab === 'profile' ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                    onClick={() => setMellsSubTab('profile')}
                  >
                    Profile Backgrounds ({mellsItems.filter(i => (i.type ?? 'profile') === 'profile').length})
                  </button>
                  <button
                    className={`admin-btn admin-btn-sm ${mellsSubTab === 'rank' ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                    onClick={() => setMellsSubTab('rank')}
                  >
                    Rank Backgrounds ({mellsItems.filter(i => i.type === 'rank').length})
                  </button>
                </div>
                <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => {
                  setEditingMellsItem({
                    id: `bg_${mellsSubTab}_${Date.now()}`,
                    name: '',
                    description: '',
                    price: 5000,
                    backgroundUrl: '',
                    roleId: '',
                    type: mellsSubTab,
                    exclusive: false,
                    enabled: true,
                  });
                }}>+ Add {mellsSubTab === 'profile' ? 'Profile' : 'Rank'} Background</button>
              </div>

              {/* Filtered items grid */}
              {(() => {
                const filtered = mellsItems.filter(i => (i.type ?? 'profile') === mellsSubTab);
                if (filtered.length === 0) {
                  return (
                    <div className="admin-empty">
                      <div className="admin-empty-icon">{mellsSubTab === 'profile' ? '\uD83D\uDDBC\uFE0F' : '\uD83C\uDFC5'}</div>
                      <p>No {mellsSubTab} backgrounds configured</p>
                      <p className="admin-empty-hint">Click &quot;Add {mellsSubTab === 'profile' ? 'Profile' : 'Rank'} Background&quot; to create one</p>
                    </div>
                  );
                }
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                    {filtered.map((item) => (
                      <div key={item.id} style={{
                        border: item.exclusive
                          ? '1px solid rgba(255, 213, 79, 0.3)'
                          : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: 'var(--bg-deep)',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s, transform 0.15s',
                        opacity: item.enabled === false ? 0.5 : 1,
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = item.exclusive ? 'rgba(255, 213, 79, 0.6)' : 'rgba(255,255,255,0.2)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = item.exclusive ? 'rgba(255, 213, 79, 0.3)' : 'rgba(255,255,255,0.08)'; }}
                      onClick={() => setEditingMellsItem({ ...item })}
                      >
                        {/* Image preview with aspect ratio */}
                        <div style={{
                          height: mellsSubTab === 'profile' ? '160px' : '80px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--bg-void)',
                          position: 'relative',
                          overflow: 'hidden',
                        }}>
                          {item.backgroundUrl ? (
                            <img src={item.backgroundUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                          ) : (
                            <span style={{ fontSize: '32px', color: 'var(--text-muted)' }}>&#x1F5BC;&#xFE0F;</span>
                          )}
                          {/* Dark gradient overlay */}
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '50%',
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                            pointerEvents: 'none',
                          }} />
                          {/* Disabled badge */}
                          {item.enabled === false && (
                            <div style={{
                              position: 'absolute',
                              top: '6px',
                              right: '6px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(244, 63, 94, 0.8)',
                              color: '#fff',
                              fontSize: '10px',
                              fontWeight: 700,
                            }}>DISABLED</div>
                          )}
                          {/* Exclusive badge */}
                          {item.exclusive && (
                            <div style={{
                              position: 'absolute',
                              top: '6px',
                              left: '6px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(255, 213, 79, 0.15)',
                              border: '1px solid rgba(255, 213, 79, 0.4)',
                              color: '#FFD54F',
                              fontSize: '10px',
                              fontWeight: 700,
                            }}>EXCLUSIVE</div>
                          )}
                        </div>
                        {/* Info */}
                        <div style={{ padding: '10px' }}>
                          <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{item.name || 'Unnamed'}</p>
                          <p style={{ fontSize: '12px', color: '#FFD54F', fontWeight: 600 }}>{(item.price ?? 0).toLocaleString()} Lunari</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Mells Save Bar */}
              {JSON.stringify(mellsItems) !== JSON.stringify(mellsOriginal) && (
                <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="admin-btn admin-btn-ghost" onClick={() => setMellsItems(mellsOriginal)}>Discard</button>
                  <button className="admin-btn admin-btn-primary" disabled={mellsSaving} onClick={async () => {
                    setMellsSaving(true);
                    try {
                      const res = await fetch('/api/admin/shops/config', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
                        body: JSON.stringify({ shop: 'mells', config: mellsItems }),
                      });
                      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
                      setMellsOriginal([...mellsItems]);
                      toast('Saved! Changes take effect within 30 seconds.', 'success');
                    } catch (err: any) {
                      toast(err.message || 'Save failed', 'error');
                    } finally {
                      setMellsSaving(false);
                    }
                  }}>
                    {mellsSaving ? 'Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Mells Edit Modal ── */}
          {editingMellsItem && (
            <AdminLightbox isOpen={true} title={mellsItems.some(i => i.id === editingMellsItem.id) ? 'Edit Background' : 'Add Background'} onClose={() => setEditingMellsItem(null)} size="md">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Image Preview */}
                <div style={{
                  height: editingMellsItem.type === 'rank' ? '100px' : '200px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: 'var(--bg-void)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {editingMellsItem.backgroundUrl ? (
                    <img src={editingMellsItem.backgroundUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '32px', color: 'var(--text-muted)' }}>&#x1F5BC;&#xFE0F;</span>
                  )}
                </div>

                {/* Two-column layout for ID + Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="admin-form-group" style={{ margin: 0 }}>
                    <label className="admin-form-label">✏️ ID</label>
                    <input className="admin-form-input" value={editingMellsItem.id ?? ''} onChange={(e) => setEditingMellsItem({ ...editingMellsItem, id: e.target.value })} placeholder="bg_my_background" />
                  </div>
                  <div className="admin-form-group" style={{ margin: 0 }}>
                    <label className="admin-form-label">✏️ Name</label>
                    <input className="admin-form-input" value={editingMellsItem.name ?? ''} onChange={(e) => setEditingMellsItem({ ...editingMellsItem, name: e.target.value })} />
                  </div>
                </div>

                <RichTextArea
                  label="📝 Description"
                  value={editingMellsItem.description ?? ''}
                  onChange={(v) => setEditingMellsItem({ ...editingMellsItem, description: v })}
                  rows={3}
                  minHeight="100px"
                />

                {/* Two-column: Price + Role ID */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="admin-form-group" style={{ margin: 0 }}>
                    <label className="admin-form-label">💰 Price (Lunari)</label>
                    <input className="admin-form-input" type="number" value={editingMellsItem.price ?? 0} onChange={(e) => setEditingMellsItem({ ...editingMellsItem, price: parseInt(e.target.value) || 0 })} min={0} />
                    <span className="admin-number-input-desc">How much this item costs to buy</span>
                  </div>
                  <div className="admin-form-group" style={{ margin: 0 }}>
                    <label className="admin-form-label">🛡️ Role ID</label>
                    <input className="admin-form-input" value={editingMellsItem.roleId ?? ''} onChange={(e) => setEditingMellsItem({ ...editingMellsItem, roleId: e.target.value })} placeholder="Discord role ID" />
                  </div>
                </div>

                {/* Background URL */}
                <ImagePicker
                  label="🖼️ Background Image"
                  value={editingMellsItem.backgroundUrl ?? ''}
                  onChange={(url) => setEditingMellsItem({ ...editingMellsItem, backgroundUrl: url })}
                  uploadPrefix="profiles/"
                />

                {/* Type selector */}
                <div className="admin-form-group" style={{ margin: 0 }}>
                  <label className="admin-form-label">🔵 Type</label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="radio" name="mells-type" checked={editingMellsItem.type === 'profile'} onChange={() => setEditingMellsItem({ ...editingMellsItem, type: 'profile' })} />
                      Profile Background
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="radio" name="mells-type" checked={editingMellsItem.type === 'rank'} onChange={() => setEditingMellsItem({ ...editingMellsItem, type: 'rank' })} />
                      Rank Background
                    </label>
                  </div>
                </div>

                {/* Toggles row */}
                <div style={{ display: 'flex', gap: 24 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={editingMellsItem.exclusive ?? false}
                      onChange={(e) => setEditingMellsItem({ ...editingMellsItem, exclusive: e.target.checked })} />
                    <div>
                      <span style={{ fontWeight: 600, color: '#FFD54F' }}>⚡ Mastermind Only</span>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Hidden from public shop</p>
                    </div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={editingMellsItem.enabled !== false}
                      onChange={(e) => setEditingMellsItem({ ...editingMellsItem, enabled: e.target.checked })} />
                    <div>
                      <span style={{ fontWeight: 600 }}>⚡ Enabled</span>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Visible and purchasable</p>
                    </div>
                  </label>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
                  <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => {
                    setMellsItems(prev => prev.filter(i => i.id !== editingMellsItem.id));
                    setEditingMellsItem(null);
                  }}>
                    Delete Item
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="admin-btn admin-btn-ghost" onClick={() => setEditingMellsItem(null)}>Cancel</button>
                    <button className="admin-btn admin-btn-primary" onClick={() => {
                      const existing = mellsItems.findIndex(i => i.id === editingMellsItem.id);
                      if (existing >= 0) {
                        setMellsItems(prev => prev.map(i => i.id === editingMellsItem.id ? editingMellsItem : i));
                      } else {
                        setMellsItems(prev => [...prev, editingMellsItem]);
                      }
                      setEditingMellsItem(null);
                    }}>
                      {mellsItems.some(i => i.id === editingMellsItem.id) ? 'Update' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
            </AdminLightbox>
          )}

          {/* ── Luckbox Tab ── */}
          {activeTab === 'luckbox' && (
            <>
              {/* Stat summary */}
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {luckboxTiers.length} {luckboxTiers.length === 1 ? 'tier' : 'tiers'} configured
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 className="admin-section-title" style={{ margin: 0 }}>
                      Luckbox Tiers
                    </h3>
                    <span className="admin-badge admin-badge-muted">{luckboxTiers.length}</span>
                  </div>
                  <p className="admin-section-desc" style={{ marginBottom: 0, marginTop: '4px' }}>
                    Each box can contain cards from one or multiple rarities with custom percentages.
                  </p>
                </div>
                <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={handleAddLuckbox}>
                  + Add Box
                </button>
              </div>

              {luckboxTiers.length > 0 ? (
                <div className="vendor-items-grid">
                  {luckboxTiers.map((box) => {
                    // Determine the primary rarity color for the left border accent
                    const primaryRarity = box.rarities.reduce((best, r) => r.percentage > best.percentage ? r : best, box.rarities[0]);
                    const accentColor = primaryRarity ? (RARITY_COLORS[primaryRarity.rarity] ?? 'rgba(0, 212, 255, 0.3)') : 'rgba(0, 212, 255, 0.3)';

                    return (
                      <div key={box.id} className={`admin-stat-card ${!box.enabled ? 'vendor-item-disabled' : ''}`}
                        style={{
                          borderLeft: `3px solid ${accentColor}`,
                          opacity: box.enabled ? 1 : 0.5,
                          padding: '18px',
                        }}>
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
                    );
                  })}
                </div>
              ) : (
                <div className="admin-empty">
                  <div className="admin-empty-icon">{'\uD83C\uDFB0'}</div>
                  <p>No luckbox tiers configured</p>
                  <p className="admin-empty-hint">Click &quot;Add Box&quot; to create one, or the default hardcoded tiers will be used</p>
                </div>
              )}
            </>
          )}

          {/* ── Stonebox Tab ── */}
          {activeTab === 'stonebox' && (
            <>
              {/* Stat summary */}
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {stoneBox.stones.length} {stoneBox.stones.length === 1 ? 'stone' : 'stones'} configured
              </div>

              {/* Price config */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 className="admin-section-title" style={{ margin: 0 }}>
                      Stone Box Configuration
                    </h3>
                    <span className="admin-badge admin-badge-muted">{stoneBox.stones.length}</span>
                  </div>
                  <p className="admin-section-desc" style={{ marginBottom: 0, marginTop: '4px' }}>
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
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                    <div className="admin-form-group" style={{ margin: 0, flex: 1 }}>
                      <label className="admin-form-label">Box Price</label>
                      <input className="admin-form-input" type="number" value={stonePriceInput} min={0}
                        onChange={e => setStonePriceInput(e.target.value)} />
                      <span className="admin-number-input-desc">Price to open a stone box (Lunari)</span>
                    </div>
                    <div className="admin-form-group" style={{ margin: 0, flex: 1 }}>
                      <label className="admin-form-label">Refund Amount (on miss)</label>
                      <input className="admin-form-input" type="number" value={stoneRefundInput} min={0}
                        onChange={e => setStoneRefundInput(e.target.value)} />
                      <span className="admin-number-input-desc">Lunari refunded when getting a duplicate stone</span>
                    </div>
                    <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={handleSaveStonePrices} disabled={saving}>
                      💾 Save
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
                <div className="admin-empty">
                  <div className="admin-empty-icon">{'\uD83D\uDC8E'}</div>
                  <p>No stones configured</p>
                  <p className="admin-empty-hint">Click &quot;Add Stone&quot; to create one, or the default hardcoded stones will be used</p>
                </div>
              )}
            </>
          )}

          {/* ── Tickets Tab ── */}
          {activeTab === 'tickets' && (
            <>
              {/* Stat summary */}
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {ticketPackages.length} {ticketPackages.length === 1 ? 'package' : 'packages'} configured
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 className="admin-section-title" style={{ margin: 0 }}>
                      Ticket Packages
                    </h3>
                    <span className="admin-badge admin-badge-muted">{ticketPackages.length}</span>
                  </div>
                  <p className="admin-section-desc" style={{ marginBottom: 0, marginTop: '4px' }}>
                    Manage Zoldar&apos;s ticket packages: name, price, and ticket count.
                  </p>
                </div>
                <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={handleAddTicket}>
                  + Add Package
                </button>
              </div>

              {ticketPackages.length > 0 ? (
                <div className="vendor-items-grid">
                  {ticketPackages.map((pkg) => (
                    <div key={pkg.id} className="admin-stat-card" style={{ padding: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '20px' }}>{'\uD83C\uDFAB'}</span>
                        <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{pkg.name}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Tickets</span>
                          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-primary)' }}>{pkg.tickets}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Price</span>
                          <span className="vendor-price" style={{ fontSize: '16px', fontWeight: 600 }}>{formatLunari(pkg.price)}</span>
                        </div>
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '12px' }}>
                        ID: {pkg.id}
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="admin-btn admin-btn-ghost admin-btn-sm"
                          onClick={() => setEditingTicket({ ...pkg })}>
                          Edit
                        </button>
                        <button className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={() => setConfirmDelete({ type: 'ticket', id: pkg.id })}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-empty">
                  <div className="admin-empty-icon">{'\uD83C\uDFAB'}</div>
                  <p>No ticket packages configured</p>
                  <p className="admin-empty-hint">Click &quot;Add Package&quot; to create one, or the default hardcoded packages will be used</p>
                </div>
              )}
            </>
          )}

          {/* ── Trade Config Tab ── */}
          {activeTab === 'seluna' && <VendorsSection vendorTab="seluna" />}
          {activeTab === 'brimor' && <VendorsSection vendorTab="brimor" />}
          {activeTab === 'broker' && <VendorsSection vendorTab="broker" />}

          {/* Trade Config moved to Settings page */}

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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                <input className="admin-form-input" type="number" value={editingLuckbox.price} min={0}
                  onChange={e => setEditingLuckbox({ ...editingLuckbox, price: parseInt(e.target.value) || 0 })} />
                <span className="admin-number-input-desc">How much this luckbox costs to open</span>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Order</label>
                <input className="admin-form-input" type="number" value={editingLuckbox.order}
                  onChange={e => setEditingLuckbox({ ...editingLuckbox, order: parseInt(e.target.value) || 0 })} />
                <span className="admin-number-input-desc">Display order (lower number = shows first)</span>
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
                              style={{ width: '80px', fontSize: '12px' }} value={card.weight}
                              title="Weight (higher = more likely to be drawn)"
                              onChange={e => {
                                const updated = [...overrides];
                                updated[ci] = { ...updated[ci], weight: parseFloat(e.target.value) || 0 };
                                setEditingLuckbox({
                                  ...editingLuckbox,
                                  cardOverrides: { ...editingLuckbox.cardOverrides, [rarity]: updated },
                                });
                              }} />
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {(() => {
                                const totalW = overrides.reduce((s, c) => s + c.weight, 0);
                                return totalW > 0 ? `${((card.weight / totalW) * 100).toFixed(1)}%` : '\u2014';
                              })()}
                            </span>
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
                {saving ? 'Saving...' : '💾 Save'}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="admin-form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="admin-form-label">Name</label>
                <input className="admin-form-input" value={editingStone.stone.name}
                  onChange={e => setEditingStone({ ...editingStone, stone: { ...editingStone.stone, name: e.target.value } })}
                  placeholder="e.g. Lunar Stone" />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Weight (drop rate)</label>
                <input className="admin-form-input" type="number" step="0.01" min={0} value={editingStone.stone.weight}
                  onChange={e => setEditingStone({ ...editingStone, stone: { ...editingStone.stone, weight: parseFloat(e.target.value) || 0 } })} />
                <span className="admin-number-input-desc">Higher weight = drops more often</span>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Sell Price</label>
                <input className="admin-form-input" type="number" min={0} value={editingStone.stone.sell_price}
                  onChange={e => setEditingStone({ ...editingStone, stone: { ...editingStone.stone, sell_price: parseInt(e.target.value) || 0 } })} />
                <span className="admin-number-input-desc">Lunari earned when selling this stone</span>
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
                {saving ? 'Saving...' : '💾 Save'}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                <input className="admin-form-input" type="number" min={1} value={editingTicket.tickets}
                  onChange={e => setEditingTicket({ ...editingTicket, tickets: parseInt(e.target.value) || 1 })} />
                <span className="admin-number-input-desc">Number of game tickets in this package</span>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Price (Lunari)</label>
                <input className="admin-form-input" type="number" min={0} value={editingTicket.price}
                  onChange={e => setEditingTicket({ ...editingTicket, price: parseInt(e.target.value) || 0 })} />
                <span className="admin-number-input-desc">How much this ticket package costs</span>
              </div>
            </div>

            <div className="admin-modal-actions" style={{ marginTop: '20px' }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setEditingTicket(null)}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleSaveTicket} disabled={saving}>
                {saving ? 'Saving...' : '💾 Save'}
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
