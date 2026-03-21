'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DataTable, { type Column } from '../components/DataTable';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import type { AdminUserSearchResult } from '@/types/admin';

interface RecentUser {
  discordId: string;
  username: string;
  globalName: string;
  image: string | null;
  lastActive: string;
}

function formatTimeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  if (isNaN(then)) return '';
  const diff = now - then;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function UsersPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Recent users
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const { toast } = useToast();

  const fetchRecentUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users/recent');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setRecentUsers(data.users ?? []);
    } catch {
      toast('Failed to load recent users', 'error');
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentUsers();
  }, [fetchRecentUsers]);

  const search = useCallback(async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data.results);
    } catch (err) {
      console.error('Search error:', err);
      toast('Search failed. Try again.', 'error');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search();
  };

  const columns: Column<AdminUserSearchResult>[] = [
    {
      key: 'discordId',
      label: 'Discord ID',
      render: (row) => (
        <Link
          href={`/admin/users/${row.discordId}`}
          style={{ color: 'var(--accent-primary)', fontFamily: 'monospace', fontSize: 13 }}
        >
          {row.discordId}
        </Link>
      ),
    },
    {
      key: 'username',
      label: 'User',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {row.image ? (
            <img src={row.image} alt="" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-void)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, color: 'var(--text-muted)' }}>
              {(row.globalName || row.username || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <span>{row.globalName || row.username || '-'}</span>
        </div>
      ),
    },
    {
      key: 'balance',
      label: 'Balance',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--accent-legendary)' }}>
          {row.balance.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'level',
      label: 'Level',
      render: (row) => <span>{row.level ?? '-'}</span>,
    },
    {
      key: 'cardCount',
      label: 'Cards',
      render: (row) => <span>{row.cardCount}</span>,
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (row) => (
        <Link href={`/admin/users/${row.discordId}`} className="admin-btn admin-btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>
          View
        </Link>
      ),
    },
  ];

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">👥</span> Users</h1>
        <p className="admin-page-subtitle">Search and manage user accounts</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input
          type="text"
          className="admin-input"
          placeholder="🔍 Search by username or Discord ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ maxWidth: 400 }}
        />
        <button className="admin-btn admin-btn-primary" onClick={search} disabled={loading || query.trim().length < 2}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {query.trim().length === 1 && (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Type at least 2 characters to search
        </p>
      )}

      {loading ? (
        <div className="admin-loading">
          <div className="admin-spinner" />
          Searching users...
        </div>
      ) : searched ? (
        results.length > 0 ? (
          <DataTable columns={columns} data={results} pageSize={20} />
        ) : (
          <div className="admin-empty">
            <div className="admin-empty-icon">?</div>
            <p>No users found for &ldquo;{query}&rdquo;</p>
          </div>
        )
      ) : (
        <>
          {/* Recent Activity section (shown when no search is active) */}
          <div className="admin-card" style={{ marginTop: 8 }}>
            <h3 className="admin-card-title" style={{ marginBottom: 16 }}>Recent Activity</h3>
            {recentLoading ? (
              <SkeletonCard count={6} />
            ) : recentUsers.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No recent activity found
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '8px',
              }}>
                {recentUsers.map((user) => (
                  <Link
                    key={user.discordId}
                    href={`/admin/users/${user.discordId}`}
                    className="admin-user-card"
                  >
                    {user.image ? (
                      <img
                        src={user.image}
                        alt=""
                        width={32}
                        height={32}
                        style={{ borderRadius: '50%', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'var(--bg-void)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: '14px',
                        color: 'var(--text-muted)',
                      }}>
                        ?
                      </div>
                    )}
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <div
                        data-tooltip={user.globalName || user.username || user.discordId}
                        style={{
                          fontWeight: 600,
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {user.globalName || user.username || user.discordId}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                      }}>
                        {user.lastActive ? formatTimeAgo(user.lastActive) : ''}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
