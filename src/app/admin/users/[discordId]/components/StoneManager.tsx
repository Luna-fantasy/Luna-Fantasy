'use client';

import { useState, useMemo, useEffect } from 'react';
import AdminLightbox from '../../../components/AdminLightbox';
import ConfirmModal from '../../../components/ConfirmModal';

interface Props {
  stones: any[];
  discordId: string;
  onRefresh: () => void;
}

interface GroupedStone {
  name: string;
  imageUrl?: string;
  count: number;
  ids: string[];
  firstAcquired: string | null;
  lastAcquired: string | null;
}

const STONES_PER_PAGE = 12;

export default function StoneManager({ stones, discordId, onRefresh }: Props) {
  const [removing, setRemoving] = useState('');
  const [result, setResult] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<{ stoneId: string; stoneName: string } | null>(null);
  const [selectedStone, setSelectedStone] = useState<GroupedStone | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const getCsrfToken = () => {
    const match = document.cookie.match(/bazaar_csrf=([^;]+)/);
    return match?.[1] ?? '';
  };

  const removeStone = async (stoneId: string, stoneName: string) => {
    setRemoving(stoneId);
    setResult('');
    try {
      const res = await fetch(`/api/admin/users/${discordId}/stones`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ stoneId, reason: 'Admin removed stone' }),
      });
      const data = await res.json();
      if (!res.ok) { setResult(`Error: ${data.error}`); return; }
      setResult(`Removed 1x "${stoneName}"`);
      setSelectedStone(null);
      onRefresh();
    } catch {
      setResult('Error removing stone');
    } finally {
      setRemoving('');
    }
  };

  // Group stones by name, aggregate count and dates
  const groupedStones = useMemo(() => {
    const map = new Map<string, GroupedStone>();
    for (const s of stones) {
      const key = (s.name ?? 'Unknown').toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        existing.ids.push(s.id);
        if (s.acquiredAt) {
          const ts = new Date(s.acquiredAt).getTime();
          if (!existing.firstAcquired || ts < new Date(existing.firstAcquired).getTime()) {
            existing.firstAcquired = s.acquiredAt;
          }
          if (!existing.lastAcquired || ts > new Date(existing.lastAcquired).getTime()) {
            existing.lastAcquired = s.acquiredAt;
          }
        }
      } else {
        map.set(key, {
          name: s.name ?? 'Unknown',
          imageUrl: s.imageUrl,
          count: 1,
          ids: [s.id],
          firstAcquired: s.acquiredAt ?? null,
          lastAcquired: s.acquiredAt ?? null,
        });
      }
    }
    return Array.from(map.values());
  }, [stones]);

  const filteredStones = useMemo(() => {
    if (!search.trim()) return groupedStones;
    const q = search.toLowerCase().trim();
    return groupedStones.filter((s) => s.name.toLowerCase().includes(q));
  }, [groupedStones, search]);

  const totalPages = Math.max(1, Math.ceil(filteredStones.length / STONES_PER_PAGE));
  const pageStones = filteredStones.slice((page - 1) * STONES_PER_PAGE, page * STONES_PER_PAGE);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [search]);

  // Clamp page when items are removed
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (stones.length === 0) {
    return <div className="admin-empty"><p>This user has no stones</p></div>;
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
          placeholder="Search stones..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="admin-collection-count">
          {filteredStones.length} unique ({stones.length} total)
        </span>
      </div>

      {/* Grid */}
      {filteredStones.length === 0 ? (
        <div className="admin-empty"><p>No stones match your search</p></div>
      ) : (
        <>
          <div className="admin-collection-grid">
            {pageStones.map((group, i) => (
              <div
                key={group.name + i}
                className="admin-collection-card admin-collection-card-clickable"
                onClick={() => setSelectedStone(group)}
              >
                <div className="admin-collection-card-header">
                  <div>
                    <div className="admin-collection-card-name">{group.name}</div>
                    {group.count > 1 && (
                      <span className="admin-rarity-pill rarity-rare">x{group.count}</span>
                    )}
                  </div>
                  {group.imageUrl && (
                    <img src={group.imageUrl} alt="" className="admin-collection-card-image" />
                  )}
                </div>
                {group.firstAcquired && (
                  <div className="admin-collection-card-stats">
                    <span>Acquired: {new Date(group.firstAcquired).toLocaleDateString('en-GB')}</span>
                  </div>
                )}
              </div>
            ))}
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
                Page {page} of {totalPages} ({filteredStones.length} unique)
              </span>
            </div>
          )}
        </>
      )}

      {/* Detail Lightbox */}
      {selectedStone && (
        <AdminLightbox isOpen={true} onClose={() => setSelectedStone(null)} title={selectedStone.name} size="md">
          {selectedStone.imageUrl && (
            <div className="admin-detail-image-wrap">
              <img src={selectedStone.imageUrl} alt="" className="admin-detail-image" />
            </div>
          )}

          <div className="admin-detail-meta">
            <div className="admin-detail-row">
              <span className="admin-detail-row-label">Owned</span>
              <span className="admin-detail-row-value">{selectedStone.count}x</span>
            </div>
            {selectedStone.firstAcquired && (
              <div className="admin-detail-row">
                <span className="admin-detail-row-label">First Acquired</span>
                <span className="admin-detail-row-value">{new Date(selectedStone.firstAcquired).toLocaleDateString('en-GB')}</span>
              </div>
            )}
            {selectedStone.count > 1 && selectedStone.lastAcquired && (
              <div className="admin-detail-row">
                <span className="admin-detail-row-label">Last Acquired</span>
                <span className="admin-detail-row-value">{new Date(selectedStone.lastAcquired).toLocaleDateString('en-GB')}</span>
              </div>
            )}
          </div>

          <div className="admin-detail-actions">
            <button className="admin-btn admin-btn-ghost" disabled title="Coming soon">
              Modify
            </button>
            <button
              className="admin-btn admin-btn-danger"
              onClick={() => setConfirmRemove({ stoneId: selectedStone.ids[0], stoneName: selectedStone.name })}
              disabled={removing !== ''}
            >
              {removing ? 'Removing...' : `Remove 1x`}
            </button>
          </div>
        </AdminLightbox>
      )}

      {/* Confirm Modal */}
      {confirmRemove && (
        <ConfirmModal
          title="Remove Stone"
          message={`Remove 1x "${confirmRemove.stoneName}" from this user? (They have ${groupedStones.find(g => g.ids.includes(confirmRemove.stoneId))?.count ?? 1} total)`}
          confirmLabel="Remove 1"
          variant="danger"
          onConfirm={() => {
            const { stoneId, stoneName } = confirmRemove;
            setConfirmRemove(null);
            removeStone(stoneId, stoneName);
          }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
