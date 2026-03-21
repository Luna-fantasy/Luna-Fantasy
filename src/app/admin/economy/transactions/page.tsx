'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AdminLightbox from '../../components/AdminLightbox';
import { SkeletonTable } from '../../components/Skeleton';
import { getCsrfToken } from '../../utils/csrf';

interface Transaction {
  _id: string;
  discordId: string;
  username?: string;
  avatar?: string;
  type: string;
  amount: number;
  balanceBefore?: number;
  balanceAfter?: number;
  description?: string;
  timestamp: string;
  status?: string;
}

export default function TransactionExplorerPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [reversingId, setReversingId] = useState('');
  const [reverseResult, setReverseResult] = useState('');
  const [pendingReverse, setPendingReverse] = useState<{ tx: Transaction; reason: string } | null>(null);
  const limit = 50;

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (userId) params.set('userId', userId);
      if (typeFilter) params.set('type', typeFilter);
      const res = await fetch(`/api/admin/economy/transactions?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      // Resolve usernames for the fetched transactions
      const txs = data.transactions ?? [];
      const uniqueIds = Array.from(new Set(txs.map((t: any) => t.discordId).filter(Boolean)));

      // Batch lookup usernames by Discord ID
      if (uniqueIds.length > 0) {
        try {
          const usersRes = await fetch('/api/admin/users/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: uniqueIds }),
          });
          if (usersRes.ok) {
            const usersData = await usersRes.json();
            const userMap = new Map<string, { username: string; avatar: string | null }>();
            for (const u of usersData.users ?? []) {
              userMap.set(u.discordId, { username: u.username, avatar: u.avatar });
            }
            for (const tx of txs) {
              const user = userMap.get(tx.discordId);
              if (user) {
                tx.username = tx.username || user.username;
                tx.avatar = tx.avatar || user.avatar;
              }
            }
          }
        } catch {}
      }

      setTransactions(txs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Transaction fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, userId, typeFilter]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const reverseTransaction = async (txId: string, reason: string) => {
    if (!reason || reason.trim().length < 3) return;
    setPendingReverse(null);
    setReversingId(txId);
    setReverseResult('');
    try {
      const res = await fetch('/api/admin/economy/transactions/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ transactionId: txId, reason }),
      });
      const data = await res.json();
      if (!res.ok) { setReverseResult(`Error: ${data.error}`); return; }
      setReverseResult(`Reversed: ${data.reversalAmount > 0 ? '+' : ''}${data.reversalAmount}`);
      fetchTransactions();
    } catch {
      setReverseResult('Error: Request failed');
    } finally {
      setReversingId('');
    }
  };

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">🔍</span> Transaction Explorer</h1>
        <p className="admin-page-subtitle">{total.toLocaleString()} total transactions</p>
      </div>

      <div className="admin-filters">
        <input
          type="text"
          className="admin-input"
          placeholder="🔍 Filter by Discord ID..."
          value={userId}
          onChange={(e) => { setUserId(e.target.value); setPage(1); }}
          style={{ maxWidth: 240 }}
        />
        <input
          type="text"
          className="admin-input"
          placeholder="🔍 Filter by type..."
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          style={{ maxWidth: 200 }}
        />
      </div>

      {reverseResult && (
        <p style={{ marginBottom: 16, fontSize: 13, color: reverseResult.startsWith('Error') ? '#f43f5e' : 'var(--common)' }}>
          {reverseResult}
        </p>
      )}

      {loading ? (
        <SkeletonTable rows={8} />
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Before</th>
                <th>After</th>
                <th>Time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No transactions found</td></tr>
              ) : transactions.map((t) => (
                <tr key={t._id}>
                  <td>
                    <Link href={`/admin/users/${t.discordId}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
                      {t.avatar && (
                        <img src={t.avatar} alt="" width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0 }} />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        {t.username && (
                          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{t.username}</span>
                        )}
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)', opacity: 0.7 }}>{t.discordId}</span>
                      </div>
                    </Link>
                  </td>
                  <td><span className={`admin-badge ${t.type.includes('reversal') ? 'gold' : 'cyan'}`}>{t.type}</span></td>
                  <td style={{ color: t.amount >= 0 ? 'var(--common)' : '#f43f5e', fontWeight: 600 }}>
                    {t.amount >= 0 ? '+' : ''}{t.amount?.toLocaleString()}
                  </td>
                  <td>{t.balanceBefore?.toLocaleString() ?? '-'}</td>
                  <td>{t.balanceAfter?.toLocaleString() ?? '-'}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(t.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    {t.type !== 'admin_reversal' && (
                      <button
                        className="admin-btn admin-btn-danger"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => setPendingReverse({ tx: t, reason: '' })}
                        disabled={reversingId === t._id}
                      >
                        {reversingId === t._id ? '...' : '↩️ Reverse'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="admin-pagination">
              <span className="admin-pagination-info">Page {page} of {totalPages} ({total} total)</span>
              <div className="admin-pagination-buttons">
                <button className="admin-pagination-btn" onClick={() => setPage(page - 1)} disabled={page <= 1}>Previous</button>
                <button className="admin-pagination-btn" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      <AdminLightbox
        isOpen={!!pendingReverse}
        onClose={() => setPendingReverse(null)}
        title="Reverse Transaction"
        size="sm"
      >
        {pendingReverse && (
          <div style={{ padding: '16px 20px' }}>
            <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>User:</strong> {pendingReverse.tx.username || pendingReverse.tx.discordId}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Type:</strong> {pendingReverse.tx.type}
              </div>
              <div>
                <strong>Amount:</strong>{' '}
                <span style={{ color: pendingReverse.tx.amount >= 0 ? 'var(--common)' : '#f43f5e', fontWeight: 600 }}>
                  {pendingReverse.tx.amount >= 0 ? '+' : ''}{pendingReverse.tx.amount?.toLocaleString()}
                </span>
              </div>
            </div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              📝 Reason for reversal
            </label>
            <textarea
              className="admin-input"
              value={pendingReverse.reason}
              onChange={(e) => setPendingReverse({ ...pendingReverse, reason: e.target.value })}
              placeholder="Explain why this transaction is being reversed (min 3 characters)"
              rows={3}
              autoFocus
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: '13px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                className="admin-btn admin-btn-ghost"
                onClick={() => setPendingReverse(null)}
              >
                Cancel
              </button>
              <button
                className="admin-btn admin-btn-danger"
                onClick={() => reverseTransaction(pendingReverse.tx._id, pendingReverse.reason)}
                disabled={pendingReverse.reason.trim().length < 3}
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        )}
      </AdminLightbox>
    </>
  );
}
