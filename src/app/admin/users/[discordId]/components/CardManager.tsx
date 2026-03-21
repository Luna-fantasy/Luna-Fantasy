'use client';

import { useState, useMemo, useEffect } from 'react';
import AdminLightbox from '../../../components/AdminLightbox';
import ConfirmModal from '../../../components/ConfirmModal';

interface Props {
  cards: any[];
  discordId: string;
  onRefresh: () => void;
}

const CARDS_PER_PAGE = 12;
const RARITIES = ['all', 'common', 'rare', 'epic', 'unique', 'legendary', 'secret'];

export default function CardManager({ cards, discordId, onRefresh }: Props) {
  const [removing, setRemoving] = useState('');
  const [result, setResult] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<{ cardId: string; cardName: string } | null>(null);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState('all');

  const getCsrfToken = () => {
    const match = document.cookie.match(/bazaar_csrf=([^;]+)/);
    return match?.[1] ?? '';
  };

  const removeCard = async (cardId: string, cardName: string) => {
    setRemoving(cardId);
    setResult('');
    try {
      const res = await fetch(`/api/admin/users/${discordId}/cards`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ cardId, reason: 'Admin removed card' }),
      });
      const data = await res.json();
      if (!res.ok) { setResult(`Error: ${data.error}`); return; }
      setResult(`Removed "${cardName}"`);
      setSelectedCard(null);
      onRefresh();
    } catch {
      setResult('Error removing card');
    } finally {
      setRemoving('');
    }
  };

  const filteredCards = useMemo(() => {
    let filtered = cards;
    if (rarityFilter !== 'all') {
      filtered = filtered.filter((c: any) => c.rarity?.toLowerCase() === rarityFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter((c: any) => (c.name ?? '').toLowerCase().includes(q));
    }
    return filtered;
  }, [cards, rarityFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / CARDS_PER_PAGE));
  const pageCards = filteredCards.slice((page - 1) * CARDS_PER_PAGE, page * CARDS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, rarityFilter]);

  // Clamp page when items are removed
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const getDropPercent = (card: any) => {
    if (card.weight == null) return null;
    const sameRarity = cards.filter((c: any) => c.rarity?.toUpperCase() === card.rarity?.toUpperCase());
    const totalW = sameRarity.reduce((sum: number, c: any) => sum + (c.weight ?? 0), 0);
    return totalW > 0 ? ((card.weight / totalW) * 100).toFixed(1) : '0.0';
  };

  if (cards.length === 0) {
    return <div className="admin-empty"><p>This user has no cards</p></div>;
  }

  return (
    <div>
      {result && (
        <p className={`admin-inline-result ${result.startsWith('Error') ? 'error' : 'success'} admin-mb-16`}>{result}</p>
      )}

      {/* Toolbar */}
      <div className="admin-collection-toolbar">
        <input
          type="text"
          className="admin-input admin-collection-search"
          placeholder="Search cards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="admin-select admin-collection-filter"
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value)}
        >
          {RARITIES.map((r) => (
            <option key={r} value={r}>{r === 'all' ? 'All Rarities' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
        <span className="admin-collection-count">
          {filteredCards.length} of {cards.length} cards
        </span>
      </div>

      {/* Grid */}
      {filteredCards.length === 0 ? (
        <div className="admin-empty"><p>No cards match your filter</p></div>
      ) : (
        <>
          <div className="admin-collection-grid">
            {pageCards.map((card: any, i: number) => {
              const rarityKey = card.rarity?.toLowerCase() ?? 'common';
              return (
                <div
                  key={card.id ?? i}
                  className={`admin-collection-card admin-collection-card-clickable rarity-${rarityKey}`}
                  onClick={() => setSelectedCard(card)}
                >
                  <div className="admin-collection-card-header">
                    <div>
                      <div className="admin-collection-card-name">{card.name ?? 'Unknown'}</div>
                      <span className={`admin-rarity-pill rarity-${rarityKey}`}>
                        {card.rarity ?? 'unknown'}
                      </span>
                    </div>
                    {card.imageUrl && (
                      <img src={card.imageUrl} alt="" className="admin-collection-card-image" />
                    )}
                  </div>
                  <div className="admin-collection-card-stats">
                    {card.attack != null && <span>ATK: {card.attack}</span>}
                    {card.attack != null && (card.weight != null || card.source) && <span className="admin-collection-card-stat-sep" />}
                    {card.weight != null && <span>Drop: {getDropPercent(card)}%</span>}
                    {card.weight != null && card.source && <span className="admin-collection-card-stat-sep" />}
                    {card.source && <span>Source: {card.source}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="admin-pagination">
              <div className="admin-pagination-buttons">
                <button
                  className="admin-pagination-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </button>
                <button
                  className="admin-pagination-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </div>
              <span className="admin-pagination-info">
                Page {page} of {totalPages} ({filteredCards.length} total)
              </span>
            </div>
          )}
        </>
      )}

      {/* Detail Lightbox */}
      {selectedCard && (
        <AdminLightbox isOpen={true} onClose={() => setSelectedCard(null)} title={selectedCard.name ?? 'Card Details'} size="md">
          {selectedCard.imageUrl && (
            <div className="admin-detail-image-wrap">
              <img src={selectedCard.imageUrl} alt="" className="admin-detail-image" />
            </div>
          )}

          <div className="admin-detail-meta">
            <div className="admin-detail-row">
              <span className="admin-detail-row-label">Rarity</span>
              <span className={`admin-rarity-pill rarity-${(selectedCard.rarity ?? 'common').toLowerCase()}`}>
                {selectedCard.rarity ?? 'unknown'}
              </span>
            </div>
            {selectedCard.attack != null && (
              <div className="admin-detail-row">
                <span className="admin-detail-row-label">ATK</span>
                <span className="admin-detail-row-value">{selectedCard.attack}</span>
              </div>
            )}
            {selectedCard.weight != null && (
              <div className="admin-detail-row">
                <span className="admin-detail-row-label">Drop %</span>
                <span className="admin-detail-row-value">{getDropPercent(selectedCard)}%</span>
              </div>
            )}
            {selectedCard.source && (
              <div className="admin-detail-row">
                <span className="admin-detail-row-label">Source</span>
                <span className="admin-detail-row-value">{selectedCard.source}</span>
              </div>
            )}
            <div className="admin-detail-row">
              <span className="admin-detail-row-label">Card ID</span>
              <span className="admin-detail-row-value" style={{ fontSize: 12, opacity: 0.7 }}>{selectedCard.id ?? '—'}</span>
            </div>
          </div>

          <div className="admin-detail-actions">
            <button className="admin-btn admin-btn-ghost" disabled title="Coming soon">
              Modify
            </button>
            <button
              className="admin-btn admin-btn-danger"
              onClick={() => setConfirmRemove({ cardId: selectedCard.id, cardName: selectedCard.name })}
              disabled={removing === selectedCard.id}
            >
              {removing === selectedCard.id ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </AdminLightbox>
      )}

      {/* Confirm Modal */}
      {confirmRemove && (
        <ConfirmModal
          title="Remove Card"
          message={`Remove card "${confirmRemove.cardName}" from this user?`}
          confirmLabel="Remove"
          variant="danger"
          onConfirm={() => {
            const { cardId, cardName } = confirmRemove;
            setConfirmRemove(null);
            removeCard(cardId, cardName);
          }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
