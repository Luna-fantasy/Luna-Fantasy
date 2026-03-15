'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../components/Toast';
import AdminLightbox from '../components/AdminLightbox';
import Link from 'next/link';
import DataTable, { type Column } from '../components/DataTable';

interface StoneInfo {
  name: string;
  weight: number;
  sell_price: number;
  imageUrl: string;
  emoji_id: string;
  dropPercent: number;
}

interface ForbiddenStone {
  name: string;
  imageUrl: string;
  weight: number;
  hint: string;
  sell_price: number;
  gift_role_id: string;
  emoji_id: string;
  give_command: string[];
  giver_title: string;
}

interface StoneDistribution {
  name: string;
  count: number;
  ownerCount: number;
}

interface StoneTx {
  _id: string;
  discordId: string;
  type: string;
  stoneName: string;
  amount: number;
  source: string;
  timestamp: string;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function getRarityLabel(weight: number): string {
  if (weight >= 15) return 'COMMON';
  if (weight >= 5) return 'UNCOMMON';
  if (weight >= 1) return 'RARE';
  if (weight >= 0.1) return 'EPIC';
  if (weight > 0) return 'LEGENDARY';
  return 'SPECIAL';
}

function getRarityColor(weight: number): string {
  if (weight >= 15) return '#00FF99';
  if (weight >= 5) return '#66BBFF';
  if (weight >= 1) return '#0077FF';
  if (weight >= 0.1) return '#B066FF';
  if (weight > 0) return '#FFD54F';
  return '#FFD27F';
}

const STONE_TYPE_MAP: Record<string, { label: string; icon: string; color: string }> = {
  stone_chest: { label: 'Chest', icon: '\uD83D\uDCE6', color: 'admin-badge-purple' },
  stone_seluna: { label: 'Seluna', icon: '\uD83C\uDF19', color: 'admin-badge-warning' },
  stone_sell: { label: 'Sold', icon: '\uD83D\uDCB5', color: 'admin-badge-success' },
  stone_buy: { label: 'Bought', icon: '\uD83D\uDCB3', color: 'cyan' },
  stone_auction: { label: 'Auction', icon: '\uD83D\uDD28', color: 'admin-badge-warning' },
  stone_swap: { label: 'Swap', icon: '\uD83D\uDD04', color: 'admin-badge-purple' },
  stone_gift: { label: 'Gift', icon: '\uD83C\uDF81', color: 'admin-badge-success' },
  stone_forbidden_gift: { label: 'Forbidden', icon: '\uD83D\uDD2E', color: 'admin-badge-purple' },
};

function formatTimeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  if (isNaN(then)) return '\u2014';
  const diff = now - then;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function StonesPage() {
  const [stones, setStones] = useState<StoneInfo[]>([]);
  const [forbiddenStones, setForbiddenStones] = useState<ForbiddenStone[]>([]);
  const [distribution, setDistribution] = useState<StoneDistribution[]>([]);
  const [totalOwners, setTotalOwners] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editStone, setEditStone] = useState<{ name: string; imageUrl: string; weight: number; sell_price: number; emoji_id: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Recent transactions state
  const [transactions, setTransactions] = useState<StoneTx[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  // Edit form state
  const [editWeight, setEditWeight] = useState('');
  const [editSellPrice, setEditSellPrice] = useState('');
  const [editEmojiId, setEditEmojiId] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<{ data: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add stone modal state
  const [addingStone, setAddingStone] = useState(false);
  const [newStoneName, setNewStoneName] = useState('');
  const [newStoneWeight, setNewStoneWeight] = useState('1');
  const [newStoneSellPrice, setNewStoneSellPrice] = useState('0');
  const [newStoneEmojiId, setNewStoneEmojiId] = useState('');
  const [newStoneType, setNewStoneType] = useState<'regular' | 'forbidden'>('regular');
  const [newStoneImagePreview, setNewStoneImagePreview] = useState<string | null>(null);
  const [newStoneImageFile, setNewStoneImageFile] = useState<{ data: string; type: string } | null>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteTypedName, setDeleteTypedName] = useState('');

  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stones/config');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setStones(data.stones ?? []);
      setForbiddenStones(data.forbiddenStones ?? []);
      setDistribution(data.distribution ?? []);
      setTotalOwners(data.totalOwners ?? 0);
    } catch {
      toast('Failed to load stone data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stones/transactions?limit=20');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions ?? []);
      }
    } catch {} finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); fetchTransactions(); }, [fetchData, fetchTransactions]);

  // Auto-refresh transactions every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchTransactions, 30_000);
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  function getDistForStone(name: string): StoneDistribution | undefined {
    return distribution.find((d) => d.name === name);
  }

  function openEditModal(stone: { name: string; imageUrl: string; weight: number; sell_price: number; emoji_id: string }) {
    setEditStone(stone);
    setEditWeight(String(stone.weight));
    setEditSellPrice(String(stone.sell_price));
    setEditEmojiId(stone.emoji_id || '');
    setImagePreview(null);
    setImageFile(null);
  }

  function closeEditModal() {
    setEditStone(null);
    setImagePreview(null);
    setImageFile(null);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageFile({ data: result.split(',')[1], type: file.type });
    };
    reader.readAsDataURL(file);
  }

  function openAddModal() {
    setAddingStone(true);
    setNewStoneName('');
    setNewStoneWeight('1');
    setNewStoneSellPrice('0');
    setNewStoneEmojiId('');
    setNewStoneType('regular');
    setNewStoneImagePreview(null);
    setNewStoneImageFile(null);
  }

  function closeAddModal() {
    setAddingStone(false);
    setNewStoneImagePreview(null);
    setNewStoneImageFile(null);
    if (addFileInputRef.current) addFileInputRef.current.value = '';
  }

  function handleAddImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setNewStoneImagePreview(result);
      setNewStoneImageFile({ data: result.split(',')[1], type: file.type });
    };
    reader.readAsDataURL(file);
  }

  function getWeightRarityHint(weight: number): string {
    if (weight >= 15) return 'COMMON';
    if (weight >= 5) return 'UNCOMMON';
    if (weight >= 1) return 'RARE';
    if (weight >= 0.1) return 'EPIC';
    if (weight > 0) return 'LEGENDARY';
    return 'SPECIAL';
  }

  async function handleAddStone() {
    const name = newStoneName.trim();
    if (!name) { toast('Stone name is required', 'error'); return; }

    setSaving(true);
    try {
      const csrf = getCsrfToken();

      // Create the stone via API
      const res = await fetch('/api/admin/stones/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({
          action: 'add_stone',
          stone: {
            name,
            weight: Number(newStoneWeight),
            sell_price: Number(newStoneSellPrice),
            emoji_id: newStoneEmojiId,
            type: newStoneType,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add stone');
      }

      // If an image was selected, upload it
      if (newStoneImageFile) {
        const imgRes = await fetch('/api/admin/stones/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
          body: JSON.stringify({
            action: 'update_image',
            name,
            imageData: newStoneImageFile.data,
            contentType: newStoneImageFile.type,
          }),
        });
        if (!imgRes.ok) {
          const err = await imgRes.json();
          toast(`Stone added but image upload failed: ${err.error || 'Unknown error'}`, 'error');
        }
      }

      toast(`Added "${name}" to ${newStoneType === 'forbidden' ? 'forbidden stones' : 'moon stones'}`, 'success');

      closeAddModal();
      setLoading(true);
      await fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to add stone', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!editStone) return;
    setSaving(true);
    try {
      const csrf = getCsrfToken();
      const res = await fetch('/api/admin/stones/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({
          action: 'update_stone',
          name: editStone.name,
          weight: Number(editWeight),
          sell_price: Number(editSellPrice),
          emoji_id: editEmojiId,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to update stone'); }

      if (imageFile) {
        const imgRes = await fetch('/api/admin/stones/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
          body: JSON.stringify({ action: 'update_image', name: editStone.name, imageData: imageFile.data, contentType: imageFile.type }),
        });
        if (!imgRes.ok) { const err = await imgRes.json(); throw new Error(err.error || 'Failed to upload image'); }
      }

      toast(`Updated ${editStone.name}`, 'success');

      closeEditModal();
      setLoading(true);
      await fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const csrf = getCsrfToken();
      const res = await fetch('/api/admin/stones/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ action: 'delete_stone', name: deleteTarget }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to delete stone'); }
      toast(`Deleted ${deleteTarget}`, 'success');

      setDeleteTarget(null);
      setDeleteTypedName('');
      setLoading(true);
      await fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to delete stone', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Transaction table columns
  const txColumns: Column<StoneTx>[] = [
    {
      key: 'discordId',
      label: 'User',
      render: (row: StoneTx) => (
        <Link href={`/admin/users/${row.discordId}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
          {(row as any).avatar && (
            <img src={(row as any).avatar} alt="" width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0 }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {(row as any).username && (
              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{(row as any).username}</span>
            )}
            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)', opacity: 0.7 }}>{row.discordId}</span>
          </div>
        </Link>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row: StoneTx) => {
        const info = STONE_TYPE_MAP[row.type] ?? { label: row.type?.replace('stone_', '') ?? 'unknown', icon: '\uD83D\uDD39', color: 'cyan' };
        return (
          <span className={`admin-badge ${info.color}`} style={{ gap: '4px' }}>
            <span style={{ fontSize: '12px' }}>{info.icon}</span>
            {info.label}
          </span>
        );
      },
    },
    {
      key: 'stoneName' as any,
      label: 'Stone',
      sortable: false,
      render: (row: StoneTx) => (
        <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{row.stoneName || '\u2014'}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row: StoneTx) => (
        <span style={{
          color: row.amount >= 0 ? 'var(--common)' : '#f43f5e',
          fontWeight: 700,
          fontSize: '14px',
        }}>
          {row.amount >= 0 ? '+' : ''}{row.amount?.toLocaleString() ?? 0}
        </span>
      ),
    },
    {
      key: 'source' as any,
      label: 'Source',
      render: (row: StoneTx) => (
        <span className={`admin-badge ${row.source === 'web' ? 'admin-badge-success' : 'cyan'}`}>
          {row.source ?? 'discord'}
        </span>
      ),
    },
    {
      key: 'timestamp',
      label: 'Time',
      render: (row: StoneTx) => (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }} title={row.timestamp ? new Date(row.timestamp).toLocaleString() : ''}>
          {row.timestamp ? formatTimeAgo(row.timestamp) : '\u2014'}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title">Moon Stones</h1>
          <p className="admin-page-subtitle">Stone catalog, drop rates, ownership, and configuration</p>
        </div>
        <div className="admin-loading"><div className="admin-spinner" />Loading stone data...</div>
      </>
    );
  }

  const totalOwned = distribution.reduce((s, d) => s + d.count, 0);
  const drawableStones = stones.filter((s) => s.weight > 0);
  const specialStones = stones.filter((s) => s.weight === 0);

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Moon Stones</h1>
        <p className="admin-page-subtitle">Stone catalog, drop rates, ownership, and configuration</p>
      </div>

      {/* Summary stats */}
      <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Total Stones</div>
          <div className="admin-stat-value">{stones.length}</div>
          <div className="admin-stat-sub">{drawableStones.length} drawable, {specialStones.length} special</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Forbidden Stones</div>
          <div className="admin-stat-value">{forbiddenStones.length}</div>
          <div className="admin-stat-sub">Staff gifts only</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Stone Owners</div>
          <div className="admin-stat-value">{totalOwners.toLocaleString()}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Total Owned</div>
          <div className="admin-stat-value">{totalOwned.toLocaleString()}</div>
        </div>
      </div>

      {/* Moon Stones Grid */}
      <div className="admin-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 className="admin-card-title" style={{ margin: 0 }}>Moon Stones</h3>
          <button className="admin-btn admin-btn-primary" onClick={openAddModal}>
            + Add New Stone
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {stones.map((stone) => {
            const dist = getDistForStone(stone.name);
            const rarity = getRarityLabel(stone.weight);
            const color = getRarityColor(stone.weight);
            return (
              <div
                key={stone.name}
                style={{
                  border: `1px solid ${color}33`,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: 'var(--bg-deep)',
                  transition: 'border-color 0.2s, transform 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${color}88`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${color}33`; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-void)', padding: '8px' }}>
                  {stone.imageUrl ? (
                    <img src={stone.imageUrl} alt={stone.name} style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain' }} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: '40px', color: 'var(--text-muted)' }}>&#128142;</span>
                  )}
                </div>
                <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{stone.name}</p>
                  <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: `${color}22`, color, marginBottom: '6px', width: 'fit-content' }}>
                    {rarity}
                  </span>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                    <span>Weight: {stone.weight}</span>
                    <span>Drop: {stone.dropPercent > 0 ? `${stone.dropPercent}%` : 'Admin only'}</span>
                    <span>Sell: {stone.sell_price > 0 ? `${stone.sell_price.toLocaleString()} L` : 'N/A'}</span>
                    <span>Owned: {dist ? `${dist.count} (${dist.ownerCount} users)` : '0'}</span>
                  </div>
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '4px' }}>
                    <button className="admin-btn admin-btn-ghost admin-btn-sm" style={{ flex: 1 }} onClick={() => openEditModal(stone)}>Edit</button>
                    <button className="admin-btn admin-btn-danger admin-btn-sm" style={{ flex: 1 }} onClick={() => { setDeleteTarget(stone.name); setDeleteTypedName(''); }}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Forbidden Stones */}
      {forbiddenStones.length > 0 && (
        <div className="admin-card" style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 className="admin-card-title">Forbidden Stones</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Staff-only gifts. These cannot be obtained through normal gameplay.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {forbiddenStones.map((stone) => {
              const dist = getDistForStone(stone.name);
              return (
                <div
                  key={stone.name}
                  style={{
                    border: '1px solid rgba(255, 210, 127, 0.2)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: 'var(--bg-deep)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'border-color 0.2s, transform 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 210, 127, 0.5)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 210, 127, 0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-void)', padding: '8px' }}>
                    {stone.imageUrl ? (
                      <img src={stone.imageUrl} alt={stone.name} style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain' }} loading="lazy" />
                    ) : (
                      <span style={{ fontSize: '40px', color: 'var(--text-muted)' }}>&#128142;</span>
                    )}
                  </div>
                  <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{stone.name}</p>
                    <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#FFD27F22', color: '#FFD27F', marginBottom: '6px', width: 'fit-content' }}>
                      FORBIDDEN
                    </span>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                      <span>Hint: {stone.hint}</span>
                      <span>Given by: {stone.giver_title}</span>
                      <span>Owned: {dist ? `${dist.count} (${dist.ownerCount} users)` : '0'}</span>
                    </div>
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '4px' }}>
                      <button className="admin-btn admin-btn-ghost admin-btn-sm" style={{ flex: 1 }} onClick={() => openEditModal(stone)}>Edit</button>
                      <button className="admin-btn admin-btn-danger admin-btn-sm" style={{ flex: 1 }} onClick={() => { setDeleteTarget(stone.name); setDeleteTypedName(''); }}>Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Stone Transactions */}
      {txLoading ? (
        <div className="admin-card" style={{ marginTop: '24px', textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading transactions...</div>
      ) : (
        <div style={{ marginTop: '24px' }}>
          <DataTable title="Recent Stone Transactions" columns={txColumns} data={transactions} pageSize={15} />
        </div>
      )}

      {/* Edit Modal */}
      <AdminLightbox isOpen={editStone !== null} onClose={closeEditModal} title={editStone ? `Edit: ${editStone.name}` : ''} size="md">
        {editStone && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '8px', background: 'var(--bg-void)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                <img src={imagePreview || editStone.imageUrl} alt={editStone.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => fileInputRef.current?.click()}>Upload New Image</button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>PNG recommended. Max 5MB.</p>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">
                Weight
                <span className="admin-tooltip-trigger" data-tooltip="Drop rarity: ≥15=Common, ≥5=Uncommon, ≥1=Rare, ≥0.1=Epic, >0=Legendary, 0=Special">?</span>
              </label>
              <input type="number" className="admin-form-input" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} step="0.01" min="0" />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Higher weight = more common drop. 0 = not drawable.</p>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Sell Price (Lunari)</label>
              <input type="number" className="admin-form-input" value={editSellPrice} onChange={(e) => setEditSellPrice(e.target.value)} min="0" step="1" />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Emoji ID</label>
              <input type="text" className="admin-form-input" value={editEmojiId} onChange={(e) => setEditEmojiId(e.target.value)} placeholder="Discord emoji ID" />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="admin-btn admin-btn-ghost" onClick={closeEditModal} disabled={saving}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </>
        )}
      </AdminLightbox>

      {/* Delete Confirmation Modal */}
      <AdminLightbox isOpen={deleteTarget !== null} onClose={() => { setDeleteTarget(null); setDeleteTypedName(''); }} title="Delete Stone" size="sm">
        {deleteTarget && (
          <>
            <p className="admin-modal-message">
              This will permanently remove <strong>{deleteTarget}</strong> from the config. Type the stone name to confirm.
            </p>
            <input
              type="text"
              className="admin-form-input"
              value={deleteTypedName}
              onChange={(e) => setDeleteTypedName(e.target.value)}
              placeholder={deleteTarget}
              style={{ marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => { setDeleteTarget(null); setDeleteTypedName(''); }} disabled={saving}>Cancel</button>
              <button className="admin-btn admin-btn-danger" onClick={handleDelete} disabled={saving || deleteTypedName !== deleteTarget}>
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </>
        )}
      </AdminLightbox>


      {/* Add New Stone Modal */}
      <AdminLightbox isOpen={addingStone} onClose={closeAddModal} title="Add New Stone" size="md">
        {/* Image upload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '8px', background: 'var(--bg-void)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border-subtle)' }}>
            {newStoneImagePreview ? (
              <img src={newStoneImagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '32px', color: 'var(--text-muted)' }}>&#128142;</span>
            )}
          </div>
          <div>
            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => addFileInputRef.current?.click()}>
              Upload Image
            </button>
            <input ref={addFileInputRef} type="file" accept="image/*" onChange={handleAddImageSelect} style={{ display: 'none' }} />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              PNG recommended. Max 5MB. Uploaded to R2.
            </p>
          </div>
        </div>

        {/* Stone Name */}
        <div className="admin-form-group">
          <label className="admin-form-label">Stone Name</label>
          <input
            className="admin-form-input"
            value={newStoneName}
            onChange={(e) => setNewStoneName(e.target.value)}
            placeholder="e.g. Crystal Shard"
          />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            The display name shown to players. Must be unique.
          </p>
        </div>

        {/* Stone Type */}
        <div className="admin-form-group">
          <label className="admin-form-label">Stone Type</label>
          <select
            className="admin-form-input"
            value={newStoneType}
            onChange={(e) => setNewStoneType(e.target.value as 'regular' | 'forbidden')}
          >
            <option value="regular">Regular - Can drop from chests</option>
            <option value="forbidden">Forbidden - Staff gift only</option>
          </select>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Regular stones drop from chests. Forbidden stones can only be given by staff.
          </p>
        </div>

        {/* Weight */}
        <div className="admin-form-group">
          <label className="admin-form-label">
            Weight
          </label>
          <input
            type="number"
            className="admin-form-input"
            value={newStoneWeight}
            onChange={(e) => setNewStoneWeight(e.target.value)}
            step="0.01"
            min="0"
          />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Controls drop rarity. Higher = more common.
            {Number(newStoneWeight) >= 0 && (
              <span style={{ color: getRarityColor(Number(newStoneWeight)), fontWeight: 600, marginLeft: '6px' }}>
                {getWeightRarityHint(Number(newStoneWeight))}
              </span>
            )}
          </p>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', padding: '6px 8px', background: 'var(--bg-void)', borderRadius: '6px', lineHeight: 1.6 }}>
            15+ = Common &middot; 5+ = Uncommon &middot; 1+ = Rare &middot; 0.1+ = Epic &middot; {'>'} 0 = Legendary &middot; 0 = Special (not drawable)
          </div>
        </div>

        {/* Sell Price */}
        <div className="admin-form-group">
          <label className="admin-form-label">Sell Price (Lunari)</label>
          <input
            type="number"
            className="admin-form-input"
            value={newStoneSellPrice}
            onChange={(e) => setNewStoneSellPrice(e.target.value)}
            min="0"
            step="1"
          />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            How much Lunari a player receives when selling this stone. Set to 0 if not sellable.
          </p>
        </div>

        {/* Emoji ID */}
        <div className="admin-form-group">
          <label className="admin-form-label">Emoji ID (optional)</label>
          <input
            type="text"
            className="admin-form-input"
            value={newStoneEmojiId}
            onChange={(e) => setNewStoneEmojiId(e.target.value)}
            placeholder="e.g. 1234567890123456789"
          />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            The Discord emoji ID used to display this stone in chat. Leave empty if none.
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="admin-btn admin-btn-ghost" onClick={closeAddModal} disabled={saving}>
            Cancel
          </button>
          <button className="admin-btn admin-btn-primary" onClick={handleAddStone} disabled={saving || !newStoneName.trim()}>
            {saving ? 'Adding...' : 'Add Stone'}
          </button>
        </div>
      </AdminLightbox>
    </>
  );
}
