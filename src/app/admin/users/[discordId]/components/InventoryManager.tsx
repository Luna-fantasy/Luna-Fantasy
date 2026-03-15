'use client';

import { useState } from 'react';
import { useToast } from '../../../components/Toast';

interface InventoryItem {
  id: string;
  name: string;
  shopId?: string;
  price?: number;
  purchasedAt?: number | string;
  backgroundUrl?: string;
  rankBackgroundUrl?: string;
  roleId?: string;
}

interface InventoryManagerProps {
  items: InventoryItem[];
  discordId: string;
  onUpdate: () => Promise<void>;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function InventoryManager({ items, discordId, onUpdate }: InventoryManagerProps) {
  const [loading, setLoading] = useState('');
  const { toast } = useToast();

  const handleRevoke = async (itemId: string, itemName: string, refund: boolean) => {
    if (!confirm(`${refund ? 'Revoke and refund' : 'Revoke'} "${itemName}"?`)) return;
    setLoading(itemId);
    try {
      const res = await fetch(`/api/admin/users/${discordId}/inventory`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ itemId, refund, reason: 'Admin revoked' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to revoke item');
      }
      toast(`${refund ? 'Revoked and refunded' : 'Revoked'}: ${itemName}`, 'success');
      await onUpdate();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading('');
    }
  };

  if (items.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        This user has no inventory items.
      </div>
    );
  }

  return (
    <div className="admin-table-container">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Shop</th>
            <th>Price</th>
            <th>Purchased</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.backgroundUrl && (
                    <img src={item.backgroundUrl} alt="" width={32} height={32} style={{ borderRadius: '4px', objectFit: 'cover' }} />
                  )}
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{item.name}</span>
                </div>
              </td>
              <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.shopId || '—'}</td>
              <td style={{ fontWeight: 600, color: 'var(--accent-legendary)' }}>
                {item.price ? item.price.toLocaleString() : '—'}
              </td>
              <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {item.purchasedAt
                  ? new Date(item.purchasedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—'}
              </td>
              <td>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className="admin-btn admin-btn-ghost"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    disabled={loading === item.id}
                    onClick={() => handleRevoke(item.id, item.name, false)}
                  >
                    Revoke
                  </button>
                  {item.price && item.price > 0 && (
                    <button
                      className="admin-btn admin-btn-ghost"
                      style={{ padding: '2px 8px', fontSize: 11, color: 'var(--common)' }}
                      disabled={loading === item.id}
                      onClick={() => handleRevoke(item.id, item.name, true)}
                    >
                      Refund
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
