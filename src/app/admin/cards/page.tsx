'use client';

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useToast } from '../components/Toast';
import AdminLightbox from '../components/AdminLightbox';
import Link from 'next/link';

// Memoized card table -- prevents re-render when modal inputs change
const CardTable = memo(function CardTable({ items, selectedRarity, onEdit, onDelete }: {
  items: CardItem[];
  selectedRarity: string;
  onEdit: (index: number, card: CardItem) => void;
  onDelete: (index: number, name: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="admin-empty">
        <p>No cards configured for {selectedRarity}</p>
      </div>
    );
  }
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Card</th>
            <th>Attack</th>
            <th>Weight</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((card, i) => (
            <tr key={`${card.name}-${i}`}>
              <td>{i + 1}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt={card.name} loading="lazy"
                      style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0, background: 'var(--bg-void)' }} />
                  ) : (
                    <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'var(--bg-void)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px', color: 'var(--text-muted)' }}>?</div>
                  )}
                  <span style={{ fontWeight: 500, color: RARITY_COLORS[selectedRarity] }}>{card.name}</span>
                </div>
              </td>
              <td>{card.attack}</td>
              <td>{card.weight}</td>
              <td>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => onEdit(i, card)}>Edit</button>
                  <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => onDelete(i, card.name)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
import DataTable, { type Column } from '../components/DataTable';

interface CardItem {
  name: string;
  attack: number;
  weight: number;
  imageUrl?: string;
  rarity: string;
}

interface RarityConfig {
  rarity: string;
  items: CardItem[];
}

interface Distribution {
  rarity: string;
  count: number;
  uniqueCount: number;
}

interface FactionCard {
  name: string;
  image: string;
}

interface FactionData {
  name: string;
  emoji: string;
  cards: FactionCard[];
  [key: string]: any;
}

const RARITY_COLORS: Record<string, string> = {
  COMMON: '#00FF99',
  RARE: '#0077FF',
  EPIC: '#B066FF',
  UNIQUE: '#FF3366',
  LEGENDARY: '#FFD54F',
  SECRET: '#FFD27F',
  FORBIDDEN: '#FF0044',
};

const RARITY_ORDER = ['COMMON', 'RARE', 'EPIC', 'UNIQUE', 'LEGENDARY', 'SECRET', 'FORBIDDEN'];

const FACTION_NAMES = ['Beasts', 'Colossals', 'Dragons', 'Knights', 'Lunarians', 'Moon Creatures', 'Mythical Creatures', 'Strange Beings', 'Supernatural', 'Underworld', 'Warriors'] as const;

const TAB_FACTION_WAR = 'FACTION_WAR';

const CARD_TYPE_MAP: Record<string, { label: string; icon: string; color: string }> = {
  card_pull: { label: 'Pull', icon: '\uD83C\uDCCF', color: 'cyan' },
  card_luckbox: { label: 'Luckbox', icon: '\uD83D\uDCE6', color: 'admin-badge-purple' },
  card_seluna: { label: 'Seluna', icon: '\uD83C\uDF19', color: 'admin-badge-warning' },
  card_sell: { label: 'Sold', icon: '\uD83D\uDCB5', color: 'admin-badge-success' },
  card_buy: { label: 'Bought', icon: '\uD83D\uDCB3', color: 'cyan' },
  card_auction: { label: 'Auction', icon: '\uD83D\uDD28', color: 'admin-badge-warning' },
  card_swap: { label: 'Swap', icon: '\uD83D\uDD04', color: 'admin-badge-purple' },
  card_gift: { label: 'Gift', icon: '\uD83C\uDF81', color: 'admin-badge-success' },
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

const cardTxColumns: Column[] = [
  {
    key: 'discordId',
    label: 'User',
    render: (row: any) => (
      <Link href={`/admin/users/${row.discordId}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
        {row.avatar && (
          <img src={row.avatar} alt="" width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0 }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {row.username && (
            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{row.username}</span>
          )}
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)', opacity: 0.7 }}>{row.discordId}</span>
        </div>
      </Link>
    ),
  },
  {
    key: 'type',
    label: 'Type',
    render: (row: any) => {
      const info = CARD_TYPE_MAP[row.type] ?? { label: row.type?.replace('card_', '') ?? 'unknown', icon: '\uD83D\uDD39', color: 'cyan' };
      return (
        <span className={`admin-badge ${info.color}`} style={{ gap: '4px' }}>
          <span style={{ fontSize: '12px' }}>{info.icon}</span>
          {info.label}
        </span>
      );
    },
  },
  {
    key: 'cardName',
    label: 'Card',
    sortable: false,
    render: (row: any) => (
      <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{row.cardName || '\u2014'}</span>
    ),
  },
  {
    key: 'amount',
    label: 'Amount',
    render: (row: any) => (
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
    key: 'source',
    label: 'Source',
    render: (row: any) => (
      <span className={`admin-badge ${row.source === 'web' ? 'admin-badge-success' : 'cyan'}`}>
        {row.source ?? 'discord'}
      </span>
    ),
  },
  {
    key: 'timestamp',
    label: 'Time',
    render: (row: any) => (
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }} title={row.timestamp ? new Date(row.timestamp).toLocaleString() : ''}>
        {row.timestamp ? formatTimeAgo(row.timestamp) : '\u2014'}
      </span>
    ),
  },
];

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function CardsPage() {
  const [rarities, setRarities] = useState<RarityConfig[]>([]);
  const [distribution, setDistribution] = useState<Distribution[]>([]);
  const [totalOwners, setTotalOwners] = useState(0);
  const [selectedRarity, setSelectedRarity] = useState<string>('COMMON');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // FactionWar state
  const [factionWar, setFactionWar] = useState<Record<string, FactionData> | null>(null);
  const [expandedFactions, setExpandedFactions] = useState<Set<string>>(new Set(FACTION_NAMES));

  // FactionWar modals
  const [fwAddModal, setFwAddModal] = useState<{ faction: string } | null>(null);
  const [fwEditModal, setFwEditModal] = useState<{ faction: string; card: FactionCard } | null>(null);
  const [fwDeleteModal, setFwDeleteModal] = useState<{ faction: string; cardName: string } | null>(null);
  const [fwName, setFwName] = useState('');
  const [fwImageUrl, setFwImageUrl] = useState('');
  const [fwDeleteTyped, setFwDeleteTyped] = useState('');
  const fwFileInputRef = useRef<HTMLInputElement>(null);
  const [fwImagePreview, setFwImagePreview] = useState<string | null>(null);
  const [fwImageFile, setFwImageFile] = useState<{ data: string; type: string } | null>(null);

  // Edit modal state
  const [editCard, setEditCard] = useState<{ index: number; card: CardItem } | null>(null);
  const [editName, setEditName] = useState('');
  const [editAttack, setEditAttack] = useState('');
  const [editWeight, setEditWeight] = useState('');

  // Add modal state
  const [addingCard, setAddingCard] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAttack, setNewAttack] = useState('0');
  const [newWeight, setNewWeight] = useState('1');
  const [newImageUrl, setNewImageUrl] = useState('');

  // Image upload state (shared between edit and add modals)
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<{ data: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ index: number; name: string } | null>(null);
  const [deleteTypedName, setDeleteTypedName] = useState('');

  // Recent transactions state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  const { toast } = useToast();

  const isFactionWarTab = selectedRarity === TAB_FACTION_WAR;

  const fetchData = useCallback(async () => {
    try {
      const [configRes, distRes] = await Promise.all([
        fetch('/api/admin/cards/config'),
        fetch('/api/admin/cards/distribution'),
      ]);
      if (configRes.ok) {
        const data = await configRes.json();
        setRarities(data.rarities ?? []);
        setFactionWar(data.factionWar ?? null);
      }
      if (distRes.ok) {
        const data = await distRes.json();
        setDistribution(data.distribution ?? []);
        setTotalOwners(data.totalOwners ?? 0);
      }
    } catch {
      toast('Failed to load card data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cards/transactions?limit=20');
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

  const currentRarity = rarities.find((r) => r.rarity === selectedRarity);
  const currentItems = currentRarity?.items ?? [];

  // Filtered items for search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return currentItems;
    const term = search.toLowerCase();
    return currentItems.filter((card) => card.name.toLowerCase().includes(term));
  }, [currentItems, search]);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('Please select an image file', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('Image too large (max 5MB)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageFile({ data: result.split(',')[1], type: file.type });
    };
    reader.readAsDataURL(file);
  }

  function handleFwImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('Please select an image file', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('Image too large (max 5MB)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFwImagePreview(result);
      setFwImageFile({ data: result.split(',')[1], type: file.type });
    };
    reader.readAsDataURL(file);
  }

  function openEditModal(index: number, card: CardItem) {
    setAddingCard(false);
    setEditCard({ index, card: { ...card } });
    setEditName(card.name);
    setEditAttack(String(card.attack));
    setEditWeight(String(card.weight));
    setImagePreview(null);
    setImageFile(null);
  }

  function closeEditModal() {
    setEditCard(null);
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openAddModal() {
    setEditCard(null);
    setAddingCard(true);
    setNewName('');
    setNewAttack('0');
    setNewWeight('1');
    setNewImageUrl('');
    setImagePreview(null);
    setImageFile(null);
  }

  function closeAddModal() {
    setAddingCard(false);
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleEditSave() {
    if (!editCard) return;
    setSaving(true);

    try {
      const csrf = getCsrfToken();
      const updatedCard: CardItem = {
        ...editCard.card,
        name: editName,
        attack: Number(editAttack),
        weight: Number(editWeight),
      };

      // If a new image was selected, upload it first
      if (imageFile) {
        const imgRes = await fetch('/api/admin/cards/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
          body: JSON.stringify({
            action: 'update_image',
            rarity: selectedRarity,
            cardName: editCard.card.name,
            imageData: imageFile.data,
            contentType: imageFile.type,
          }),
        });

        if (!imgRes.ok) {
          const err = await imgRes.json();
          throw new Error(err.error || 'Failed to upload image');
        }

        const imgData = await imgRes.json();
        updatedCard.imageUrl = imgData.imageUrl;
      }

      // Save the card data via PUT
      const items = [...currentItems];
      items[editCard.index] = updatedCard;

      const res = await fetch('/api/admin/cards/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ rarity: selectedRarity, items }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }

      toast(`Updated "${updatedCard.name}". Deploy Jester to make it live!`, 'success');

      closeEditModal();
      setLoading(true);
      await fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCard(deploy = false) {
    const name = newName.trim();
    if (!name) {
      toast('Card name is required', 'error');
      return;
    }

    setSaving(true);

    try {
      const csrf = getCsrfToken();
      let cardImageUrl = newImageUrl || '';

      // Step 1: Upload image FIRST if provided (get URL before saving card)
      if (imageFile) {
        const imgRes = await fetch('/api/admin/cards/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
          body: JSON.stringify({
            action: 'upload_image_only',
            rarity: selectedRarity,
            cardName: name,
            imageData: imageFile.data,
            contentType: imageFile.type,
          }),
        });

        if (imgRes.ok) {
          const imgData = await imgRes.json();
          cardImageUrl = imgData.imageUrl;
        } else {
          toast('Image upload failed. Card will be saved without image.', 'error');
        }
      }

      // Step 2: Save card data with imageUrl already set
      const card: CardItem = {
        name,
        attack: Number(newAttack),
        weight: Number(newWeight),
        imageUrl: cardImageUrl,
        rarity: selectedRarity,
      };

      const items = [...currentItems, card];
      const res = await fetch('/api/admin/cards/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ rarity: selectedRarity, items, deploy }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }

      const resData = await res.json().catch(() => ({}));
      if (deploy && resData.deployed) {
        toast(`Added "${name}" to ${selectedRarity} — pushed to GitHub and deploying Jester!`, 'success');

      } else if (deploy && resData.pushed === false) {
        toast(`Card saved but git push failed: ${resData.error || 'unknown'}. Try deploying manually.`, 'error');
  
      } else {
        toast(`Added "${name}" to ${selectedRarity}. Deploy Jester to make it live!`, 'success');
  
      }

      closeAddModal();
      setLoading(true);
      await fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to add card', 'error');
    } finally {
      setSaving(false);
    }
  }

  function cancelDelete() {
    setDeleteTarget(null);
    setDeleteTypedName('');
  }

  function handleDeleteCard() {
    if (deleteTarget === null) return;
    const items = currentItems.filter((_, i) => i !== deleteTarget.index);

    setSaving(true);
    fetch('/api/admin/cards/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
      body: JSON.stringify({ rarity: selectedRarity, items }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Delete failed');
        }
        toast(`Deleted "${deleteTarget.name}". Deploy Jester to make it live!`, 'success');
  
        cancelDelete();
        setLoading(true);
        await fetchData();
      })
      .catch((err: any) => {
        toast(err.message || 'Failed to delete card', 'error');
      })
      .finally(() => {
        setSaving(false);
      });
  }

  // ── FactionWar CRUD handlers ──

  function toggleFaction(faction: string) {
    setExpandedFactions((prev) => {
      const next = new Set(prev);
      if (next.has(faction)) next.delete(faction);
      else next.add(faction);
      return next;
    });
  }

  function openFwAddModal(faction: string) {
    setFwAddModal({ faction });
    setFwName('');
    setFwImageUrl('');
    setFwImagePreview(null);
    setFwImageFile(null);
  }

  function closeFwAddModal() {
    setFwAddModal(null);
    setFwImagePreview(null);
    setFwImageFile(null);
    if (fwFileInputRef.current) fwFileInputRef.current.value = '';
  }

  function openFwEditModal(faction: string, card: FactionCard) {
    setFwEditModal({ faction, card });
    setFwName(card.name);
    setFwImageUrl(card.image);
    setFwImagePreview(null);
    setFwImageFile(null);
  }

  function closeFwEditModal() {
    setFwEditModal(null);
    setFwImagePreview(null);
    setFwImageFile(null);
    if (fwFileInputRef.current) fwFileInputRef.current.value = '';
  }

  function openFwDeleteModal(faction: string, cardName: string) {
    setFwDeleteModal({ faction, cardName });
    setFwDeleteTyped('');
  }

  function closeFwDeleteModal() {
    setFwDeleteModal(null);
    setFwDeleteTyped('');
  }

  async function handleFwAdd() {
    if (!fwAddModal) return;
    const name = fwName.trim();
    if (!name) {
      toast('Card name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const csrf = getCsrfToken();
      let image = fwImageUrl;

      // Upload image to R2 if a file was selected
      if (fwImageFile) {
        const imgRes = await fetch('/api/admin/cards/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
          body: JSON.stringify({
            action: 'upload_faction_image',
            faction: fwAddModal.faction,
            cardName: name,
            imageData: fwImageFile.data,
            contentType: fwImageFile.type,
          }),
        });
        if (!imgRes.ok) {
          const err = await imgRes.json();
          throw new Error(err.error || 'Failed to upload image');
        }
        const imgData = await imgRes.json();
        image = imgData.imageUrl;
      }

      const res = await fetch('/api/admin/cards/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({
          action: 'add_faction_card',
          faction: fwAddModal.faction,
          card: { name, image },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add faction card');
      }

      toast(`Added "${name}" to ${fwAddModal.faction}. Deploy Jester to make it live!`, 'success');

      closeFwAddModal();
      setLoading(true);
      await fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to add faction card', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleFwEdit() {
    if (!fwEditModal) return;
    const name = fwName.trim();
    if (!name) {
      toast('Card name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const csrf = getCsrfToken();
      let image = fwImageUrl;

      // Upload image to R2 if a file was selected
      if (fwImageFile) {
        const imgRes = await fetch('/api/admin/cards/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
          body: JSON.stringify({
            action: 'upload_faction_image',
            faction: fwEditModal.faction,
            cardName: name,
            imageData: fwImageFile.data,
            contentType: fwImageFile.type,
          }),
        });
        if (!imgRes.ok) {
          const err = await imgRes.json();
          throw new Error(err.error || 'Failed to upload image');
        }
        const imgData = await imgRes.json();
        image = imgData.imageUrl;
      }

      const res = await fetch('/api/admin/cards/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({
          action: 'update_faction_card',
          faction: fwEditModal.faction,
          oldName: fwEditModal.card.name,
          card: { name, image },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update faction card');
      }

      toast(`Updated "${name}" in ${fwEditModal.faction}. Deploy Jester to make it live!`, 'success');

      closeFwEditModal();
      setLoading(true);
      await fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to update faction card', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleFwDelete() {
    if (!fwDeleteModal) return;

    setSaving(true);
    try {
      const csrf = getCsrfToken();
      const res = await fetch('/api/admin/cards/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({
          action: 'delete_faction_card',
          faction: fwDeleteModal.faction,
          cardName: fwDeleteModal.cardName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete faction card');
      }

      toast(`Deleted "${fwDeleteModal.cardName}" from ${fwDeleteModal.faction}. Deploy Jester to make it live!`, 'success');

      closeFwDeleteModal();
      setLoading(true);
      await fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to delete faction card', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title">Cards</h1>
          <p className="admin-page-subtitle">Card catalog editor and distribution stats</p>
        </div>
        <div className="admin-loading"><div className="admin-spinner" />Loading card data...</div>
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Cards</h1>
        <p className="admin-page-subtitle">Card catalog editor and distribution stats</p>
      </div>

      {/* Info banner */}
      <div className="admin-alert admin-alert-info" style={{ marginBottom: '24px' }}>
        Cards added here are automatically available in Luna Fantasy, Grand Fantasy, luckboxes, and card pulls.
        The weight controls drop probability &mdash; 0 means the card never drops randomly, higher values mean more common.
      </div>

      {/* Distribution overview */}
      <div className="admin-card" style={{ marginBottom: '24px' }}>
        <h3 className="admin-card-title">Distribution Overview</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
          {totalOwners} total card owners across all rarities
        </p>
        <div className="admin-stats-grid">
          {RARITY_ORDER.map((rarity) => {
            const dist = distribution.find((d) => d.rarity === rarity);
            const config = rarities.find((r) => r.rarity === rarity);
            return (
              <div
                key={rarity}
                className="admin-stat-card"
                style={{ borderColor: RARITY_COLORS[rarity] ?? '#666', cursor: 'pointer', opacity: selectedRarity === rarity ? 1 : 0.7 }}
                onClick={() => setSelectedRarity(rarity)}
              >
                <div className="admin-stat-label" style={{ color: RARITY_COLORS[rarity] }}>{rarity}</div>
                <div className="admin-stat-value">{config?.items?.length ?? 0} cards</div>
                <div className="admin-stat-sub">
                  {dist ? `${dist.count} owned (${dist.uniqueCount} unique)` : 'No ownership data'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rarity selector tabs + Faction War tab */}
      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {RARITY_ORDER.map((rarity) => (
              <button
                key={rarity}
                className={`admin-btn ${selectedRarity === rarity ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                style={selectedRarity === rarity ? { backgroundColor: RARITY_COLORS[rarity], borderColor: RARITY_COLORS[rarity], color: '#000' } : {}}
                onClick={() => setSelectedRarity(rarity)}
              >
                {rarity} ({rarities.find((r) => r.rarity === rarity)?.items?.length ?? 0})
              </button>
            ))}
            <button
              className={`admin-btn ${isFactionWarTab ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
              style={isFactionWarTab ? { backgroundColor: '#6366f1', borderColor: '#6366f1', color: '#fff' } : {}}
              onClick={() => setSelectedRarity(TAB_FACTION_WAR)}
            >
              FACTION WAR
            </button>
          </div>
          {!isFactionWarTab && (
            <button className="admin-btn admin-btn-primary" onClick={openAddModal}>
              + Add Card
            </button>
          )}
        </div>

        {/* Search bar (for rarity tabs only) */}
        {!isFactionWarTab && (
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              className="admin-form-input"
              placeholder="Search cards by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: '360px' }}
            />
          </div>
        )}

        {/* Content area */}
        {isFactionWarTab ? (
          <FactionWarView
            factionWar={factionWar}
            expandedFactions={expandedFactions}
            onToggle={toggleFaction}
            onAdd={openFwAddModal}
            onEdit={openFwEditModal}
            onDelete={openFwDeleteModal}
          />
        ) : (
          <CardTable
            items={filteredItems}
            selectedRarity={selectedRarity}
            onEdit={openEditModal}
            onDelete={(i, name) => { setDeleteTarget({ index: i, name }); setDeleteTypedName(''); }}
          />
        )}
      </div>

      {/* Recent Card Transactions */}
      {txLoading ? (
        <div className="admin-card" style={{ marginTop: '24px', textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading transactions...</div>
      ) : (
        <div style={{ marginTop: '24px' }}>
          <DataTable
            title="Recent Card Transactions"
            columns={cardTxColumns}
            data={transactions}
            pageSize={15}
          />
        </div>
      )}

      {/* Edit Card Modal */}
      <AdminLightbox isOpen={editCard !== null} onClose={closeEditModal} title="Edit Card" size="md">
        {editCard && (
          <>

            {/* Image preview + upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '8px',
                background: 'var(--bg-void)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                border: '1px solid var(--border-subtle)',
              }}>
                {(imagePreview || editCard.card.imageUrl) ? (
                  <img
                    src={imagePreview || editCard.card.imageUrl}
                    alt={editCard.card.name}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ fontSize: '32px', color: 'var(--text-muted)' }}>?</span>
                )}
              </div>
              <div>
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload New Image
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  PNG recommended. Max 5MB. Uploaded to R2.
                </p>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Name</label>
              <input
                className="admin-form-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Card name"
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Attack</label>
              <input
                type="number"
                className="admin-form-input"
                value={editAttack}
                onChange={(e) => setEditAttack(e.target.value)}
                min="0"
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Weight</label>
              <input
                type="number"
                className="admin-form-input"
                value={editWeight}
                onChange={(e) => setEditWeight(e.target.value)}
                step="0.01"
                min="0"
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Higher weight = more common drop.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="admin-btn admin-btn-ghost" onClick={closeEditModal} disabled={saving}>
                Cancel
              </button>
              <button className="admin-btn admin-btn-primary" onClick={handleEditSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </AdminLightbox>

      {/* Add Card Modal (with live preview) */}
      <AdminLightbox isOpen={addingCard} onClose={closeAddModal} title={`Add New ${selectedRarity} Card`} size="md">

            {/* Image upload or URL */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '8px',
                background: 'var(--bg-void)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                border: '1px solid var(--border-subtle)',
              }}>
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : newImageUrl ? (
                  <img
                    src={newImageUrl}
                    alt="Preview"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ fontSize: '32px', color: 'var(--text-muted)' }}>?</span>
                )}
              </div>
              <div>
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Image
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  PNG recommended. Max 5MB. Uploaded to R2.
                </p>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Image URL (optional, ignored if uploading)</label>
              <input
                className="admin-form-input"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="https://..."
                disabled={!!imageFile}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Name</label>
              <input
                className="admin-form-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Card name"
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Attack</label>
              <input
                type="number"
                className="admin-form-input"
                value={newAttack}
                onChange={(e) => setNewAttack(e.target.value)}
                min="0"
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Weight</label>
              <input
                type="number"
                className="admin-form-input"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>

            {/* Live card preview */}
            {newName.trim() && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                borderRadius: '8px',
                background: 'var(--bg-void)',
                border: '1px solid var(--border-subtle)',
              }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Preview</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    border: `1px solid ${RARITY_COLORS[selectedRarity] ?? '#666'}`,
                  }}>
                    {(imagePreview || newImageUrl) ? (
                      <img src={imagePreview || newImageUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: '20px', color: 'var(--text-muted)' }}>?</span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: RARITY_COLORS[selectedRarity] ?? '#ccc', fontSize: '15px' }}>
                      {newName.trim()}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      ATK: {newAttack || 0}
                    </div>
                    <div style={{ fontSize: '11px', color: RARITY_COLORS[selectedRarity] ?? '#666', marginTop: '1px', fontWeight: 500 }}>
                      {selectedRarity}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="admin-btn admin-btn-ghost" onClick={closeAddModal} disabled={saving}>
                Cancel
              </button>
              <button className="admin-btn admin-btn-ghost" onClick={() => handleAddCard(false)} disabled={saving}>
                {saving ? 'Saving...' : 'Save Only'}
              </button>
              <button className="admin-btn admin-btn-primary" onClick={() => handleAddCard(true)} disabled={saving}>
                {saving ? 'Deploying...' : 'Save & Deploy'}
              </button>
            </div>
      </AdminLightbox>

      {/* Delete Confirmation */}
      <AdminLightbox isOpen={deleteTarget !== null} onClose={cancelDelete} title="Delete Card" size="sm">
        {deleteTarget && (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
              Type the card name to confirm deletion:
            </p>
            <p style={{ color: RARITY_COLORS[selectedRarity], fontWeight: 600, marginBottom: '12px', fontSize: '15px' }}>
              {deleteTarget.name}
            </p>
            <input
              className="admin-form-input"
              value={deleteTypedName}
              onChange={(e) => setDeleteTypedName(e.target.value)}
              placeholder="Type card name here..."
              autoFocus
              style={{ marginBottom: '20px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="admin-btn admin-btn-ghost" onClick={cancelDelete} disabled={saving}>Cancel</button>
              <button
                className="admin-btn admin-btn-danger"
                disabled={deleteTypedName !== deleteTarget.name || saving}
                onClick={handleDeleteCard}
              >
                {saving ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </>
        )}
      </AdminLightbox>

      {/* FactionWar Add Card Modal */}
      <AdminLightbox isOpen={fwAddModal !== null} onClose={closeFwAddModal} title={fwAddModal ? `Add Card to ${fwAddModal.faction}` : ''} size="md">
        {fwAddModal && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '8px',
                background: 'var(--bg-void)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                border: '1px solid var(--border-subtle)',
              }}>
                {fwImagePreview ? (
                  <img src={fwImagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : fwImageUrl ? (
                  <img src={fwImageUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '32px', color: 'var(--text-muted)' }}>?</span>
                )}
              </div>
              <div>
                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => fwFileInputRef.current?.click()}>
                  Upload Image
                </button>
                <input ref={fwFileInputRef} type="file" accept="image/*" onChange={handleFwImageSelect} style={{ display: 'none' }} />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>PNG recommended. Max 5MB.</p>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Image URL (optional, ignored if uploading)</label>
              <input
                className="admin-form-input"
                value={fwImageUrl}
                onChange={(e) => setFwImageUrl(e.target.value)}
                placeholder="https://..."
                disabled={!!fwImageFile}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Card Name</label>
              <input
                className="admin-form-input"
                value={fwName}
                onChange={(e) => setFwName(e.target.value)}
                placeholder="Card name"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="admin-btn admin-btn-ghost" onClick={closeFwAddModal} disabled={saving}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleFwAdd} disabled={saving}>
                {saving ? 'Adding...' : 'Add Card'}
              </button>
            </div>
          </>
        )}
      </AdminLightbox>

      {/* FactionWar Edit Card Modal */}
      <AdminLightbox isOpen={fwEditModal !== null} onClose={closeFwEditModal} title={fwEditModal ? `Edit Card in ${fwEditModal.faction}` : ''} size="md">
        {fwEditModal && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '8px',
                background: 'var(--bg-void)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                border: '1px solid var(--border-subtle)',
              }}>
                {fwImagePreview ? (
                  <img src={fwImagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : fwImageUrl ? (
                  <img src={fwImageUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '32px', color: 'var(--text-muted)' }}>?</span>
                )}
              </div>
              <div>
                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => fwFileInputRef.current?.click()}>
                  Upload New Image
                </button>
                <input ref={fwFileInputRef} type="file" accept="image/*" onChange={handleFwImageSelect} style={{ display: 'none' }} />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>PNG recommended. Max 5MB.</p>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Image URL</label>
              <input
                className="admin-form-input"
                value={fwImageUrl}
                onChange={(e) => setFwImageUrl(e.target.value)}
                placeholder="https://..."
                disabled={!!fwImageFile}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Card Name</label>
              <input
                className="admin-form-input"
                value={fwName}
                onChange={(e) => setFwName(e.target.value)}
                placeholder="Card name"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="admin-btn admin-btn-ghost" onClick={closeFwEditModal} disabled={saving}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleFwEdit} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </AdminLightbox>

      {/* FactionWar Delete Confirmation */}
      <AdminLightbox isOpen={fwDeleteModal !== null} onClose={closeFwDeleteModal} title="Delete Faction Card" size="sm">
        {fwDeleteModal && (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
              Type the card name to confirm deletion from <strong>{fwDeleteModal.faction}</strong>:
            </p>
            <p style={{ color: '#6366f1', fontWeight: 600, marginBottom: '12px', fontSize: '15px' }}>
              {fwDeleteModal.cardName}
            </p>
            <input
              className="admin-form-input"
              value={fwDeleteTyped}
              onChange={(e) => setFwDeleteTyped(e.target.value)}
              placeholder="Type card name here..."
              autoFocus
              style={{ marginBottom: '20px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="admin-btn admin-btn-ghost" onClick={closeFwDeleteModal} disabled={saving}>Cancel</button>
              <button
                className="admin-btn admin-btn-danger"
                disabled={fwDeleteTyped !== fwDeleteModal.cardName || saving}
                onClick={handleFwDelete}
              >
                {saving ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </>
        )}
      </AdminLightbox>
    </>
  );
}

// ── FactionWar collapsible view component ──

function FactionWarView({
  factionWar,
  expandedFactions,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
}: {
  factionWar: Record<string, FactionData> | null;
  expandedFactions: Set<string>;
  onToggle: (faction: string) => void;
  onAdd: (faction: string) => void;
  onEdit: (faction: string, card: FactionCard) => void;
  onDelete: (faction: string, cardName: string) => void;
}) {
  if (!factionWar) {
    return (
      <div className="admin-empty">
        <p>FactionWar data not available. Check Jester config.ts for a valid FactionWar block with factions.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {FACTION_NAMES.map((factionName) => {
        const faction = factionWar[factionName];
        if (!faction) return null;

        const cards: FactionCard[] = Array.isArray(faction.cards) ? faction.cards : [];
        const isExpanded = expandedFactions.has(factionName);

        return (
          <div
            key={factionName}
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              overflow: 'hidden',
              background: 'var(--bg-surface)',
            }}
          >
            {/* Faction header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                cursor: 'pointer',
                background: isExpanded ? 'var(--bg-void)' : 'transparent',
                transition: 'background 0.15s',
                userSelect: 'none',
              }}
              onClick={() => onToggle(factionName)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                  {factionName}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  ({cards.length} card{cards.length !== 1 ? 's' : ''})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  onClick={(e) => { e.stopPropagation(); onAdd(factionName); }}
                >
                  + Add Card
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px', transition: 'transform 0.15s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>
                  &#9660;
                </span>
              </div>
            </div>

            {/* Faction cards grid */}
            {isExpanded && (
              <div style={{ padding: '16px' }}>
                {cards.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
                    No cards in this faction yet.
                  </p>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '12px',
                  }}>
                    {cards.map((card) => (
                      <div
                        key={card.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          background: 'var(--bg-void)',
                          border: '1px solid var(--border-subtle)',
                          transition: 'border-color 0.15s',
                        }}
                      >
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          background: 'var(--bg-surface)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {card.image ? (
                            <img src={`https://assets.lunarian.app/LunaPairs/${card.image}`} alt={card.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>?</span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {card.name}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => onEdit(factionName, card)} style={{ padding: '2px 6px', fontSize: '11px' }}>Edit</button>
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => onDelete(factionName, card.name)} style={{ padding: '2px 6px', fontSize: '11px' }}>Del</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
