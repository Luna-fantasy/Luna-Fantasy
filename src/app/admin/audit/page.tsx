'use client';

import { useState, useEffect, useCallback } from 'react';
import DataTable, { type Column } from '../components/DataTable';
import type { AuditEntry } from '@/types/admin';

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (actionFilter) params.set('action', actionFilter);
      const res = await fetch(`/api/admin/audit?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setEntries(data.entries);
      setTotal(data.total);
    } catch (err) {
      console.error('Audit log fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  const columns: Column<AuditEntry>[] = [
    {
      key: 'timestamp',
      label: 'Time',
      render: (row: AuditEntry) => {
        const date = new Date(row.timestamp);
        return (
          <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
            {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        );
      },
    },
    {
      key: 'adminUsername',
      label: 'Admin',
    },
    {
      key: 'action',
      label: 'Action',
      render: (row: AuditEntry) => (
        <span className="admin-badge cyan">{row.action}</span>
      ),
    },
    {
      key: 'targetDiscordId',
      label: 'Target',
      render: (row: AuditEntry) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
          {row.targetDiscordId ?? '-'}
        </span>
      ),
    },
    {
      key: 'metadata',
      label: 'Details',
      sortable: false,
      render: (row: AuditEntry) => {
        const reason = row.metadata?.reason;
        const amount = row.metadata?.amount;
        return (
          <span style={{ fontSize: 13 }}>
            {amount != null && <span style={{ fontWeight: 600 }}>{amount.toLocaleString()} </span>}
            {reason ?? ''}
          </span>
        );
      },
    },
    {
      key: 'source',
      label: 'Source',
      render: () => (
        <span className="admin-badge admin-badge-muted">Dashboard</span>
      ),
    },
  ];

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">📜</span> Audit Log</h1>
        <p className="admin-page-subtitle">All admin actions are logged here</p>
      </div>

      <div className="admin-filters">
        <input
          type="text"
          className="admin-input"
          placeholder="🔍 Filter by action..."
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          style={{ maxWidth: 320 }}
        />
      </div>

      {loading ? (
        <div className="admin-loading">
          <div className="admin-spinner" />
          Loading audit log...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={entries}
          pageSize={limit}
          totalItems={total}
          currentPage={page}
          onPageChange={setPage}
          serverPagination
        />
      )}
    </>
  );
}
