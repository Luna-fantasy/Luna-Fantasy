'use client';

import { useState, useEffect, useCallback } from 'react';
import StatCard from '../components/StatCard';
import RecentTransactionsTable from '../components/RecentTransactionsTable';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import type { EconomyOverview } from '@/types/admin';

type Tab = 'overview' | 'transactions';

export default function EconomyPage() {
  const [tab, setTab] = useState<Tab>('overview');

  const [overview, setOverview] = useState<EconomyOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const { toast } = useToast();

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/economy/overview');
      if (!res.ok) throw new Error('Failed');
      setOverview(await res.json());
    } catch (err) {
      console.error('Economy overview error:', err);
      toast('Failed to load economy data', 'error');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 30_000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  if (overviewLoading && tab === 'overview') {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">💰</span> Economy</h1>
          <p className="admin-page-subtitle">Lunari circulation and transaction overview</p>
        </div>
        <SkeletonCard count={5} />
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">💰</span> Economy</h1>
        <p className="admin-page-subtitle">Lunari circulation and transaction overview</p>
      </div>

      {/* Tab bar */}
      <div className="admin-tabs">
        {(['overview', 'transactions'] as Tab[]).map((t) => (
          <button key={t} className={`admin-tab ${tab === t ? 'admin-tab-active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && overview && (
        <div className="admin-stats-grid">
          <StatCard label="Server Members" value={overview.totalUsers} icon="U" color="cyan" href="/admin/users" />
          <StatCard
            label="Total User Balances"
            value={overview.totalLunariCirculation}
            icon="L"
            color="gold"
            trend={`${overview.activeHolders.toLocaleString()} accounts with balance > 0`}
            tooltip="Sum of all Lunari held by every user in the database"
          />
          <StatCard label="Bank Reserve" value={overview.bankReserve} icon="B" color="purple" href="/admin/banking" />
          <StatCard label="Active Loans" value={overview.activeLoans} icon="#" color="green"
            trend={overview.activeLoanValue > 0 ? `${overview.activeLoanValue.toLocaleString()} total` : undefined}
            href="/admin/banking" />
          <StatCard label="Outstanding Debt" value={overview.totalDebt} icon="!" color="purple"
            trendType={overview.totalDebt > 0 ? 'negative' : 'neutral'}
            href="/admin/banking" />
        </div>
      )}

      {/* Transactions tab */}
      {tab === 'transactions' && overview && (
        <RecentTransactionsTable transactions={overview.recentTransactions} />
      )}
    </>
  );
}
