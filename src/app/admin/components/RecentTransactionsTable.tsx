'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import DataTable, { type Column } from './DataTable';
import type { RecentTransaction } from '@/types/admin';
import { getTransactionTypeInfo } from '@/lib/admin/transaction-types';

interface Props {
  transactions: RecentTransaction[];
}

const POLL_INTERVAL = 10_000;

export default function RecentTransactionsTable({ transactions: initialTransactions }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [isLive, setIsLive] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/economy/transactions/recent');
      if (!res.ok) {
        setIsLive(false);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
        setIsLive(true);
      }
    } catch {
      setIsLive(false);
    }
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(fetchTransactions, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTransactions]);

  const columns: Column<RecentTransaction>[] = [
    {
      key: 'discordId',
      label: 'User',
      render: (row: RecentTransaction) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {row.avatar && (
            <img
              src={row.avatar}
              alt=""
              width={28}
              height={28}
              style={{ borderRadius: '50%', flexShrink: 0 }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {row.username && (
              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                {row.username}
              </span>
            )}
            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)', opacity: 0.7 }}>
              {row.discordId}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row: RecentTransaction) => {
        const info = getTransactionTypeInfo(row.type);
        return (
          <span className={`admin-badge ${info.color}`} style={{ gap: '4px' }}>
            <span style={{ fontSize: '12px' }}>{info.icon}</span>
            {info.label}
          </span>
        );
      },
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row: RecentTransaction) => (
        <span style={{
          color: row.amount >= 0 ? 'var(--common)' : '#f43f5e',
          fontWeight: 700,
          fontSize: '14px',
          textShadow: row.amount >= 0 ? '0 0 8px rgba(74, 222, 128, 0.3)' : '0 0 8px rgba(244, 63, 94, 0.3)',
        }}>
          {row.amount >= 0 ? '+' : ''}{row.amount.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'description',
      label: 'Item',
      sortable: false,
      render: (row: RecentTransaction) => (
        <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
          {row.description || '\u2014'}
        </span>
      ),
    },
    {
      key: 'timestamp',
      label: 'Time',
      render: (row: RecentTransaction) => {
        const date = new Date(row.timestamp);
        return (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
            {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        );
      },
    },
  ];

  const liveIndicator = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span
        className={`admin-status-dot ${isLive ? 'admin-status-dot-green' : 'admin-status-dot-red'} admin-status-dot-pulse`}
      />
      <span style={{ fontSize: '12px', color: isLive ? 'var(--common)' : '#f43f5e', fontWeight: 500 }}>
        {isLive ? 'Live' : 'Disconnected'}
      </span>
    </div>
  );

  return (
    <DataTable
      title="Recent Transactions"
      columns={columns}
      data={transactions}
      pageSize={15}
      actions={liveIndicator}
    />
  );
}
