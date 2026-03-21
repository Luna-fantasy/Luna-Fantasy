import { getEconomyOverview } from '@/lib/admin/db';
import StatCard from './components/StatCard';
import RecentTransactionsTable from './components/RecentTransactionsTable';

export default async function AdminDashboard() {
  const overview = await getEconomyOverview();

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">📊</span> Dashboard</h1>
        <p className="admin-page-subtitle">Luna ecosystem overview</p>
      </div>

      <div className="admin-stats-grid">
        <StatCard
          label="Total Users"
          value={overview.totalUsers}
          icon={'\ud83d\udc65'}
          color="cyan"
          href="/admin/users"
        />
        <StatCard
          label="Lunari in Circulation"
          value={overview.totalLunariCirculation}
          icon={'\ud83e\ude99'}
          color="gold"
          href="/admin/economy/transactions"
        />
        <StatCard
          label="Bank Reserve"
          value={overview.bankReserve}
          icon={'\ud83c\udfe6'}
          color="purple"
          href="/admin/banking"
        />
        <StatCard
          label="Active Loans"
          value={overview.activeLoans}
          icon={'\ud83d\udccb'}
          color="green"
          href="/admin/banking"
          trend={overview.activeLoanValue > 0 ? `${overview.activeLoanValue.toLocaleString()} Lunari total` : undefined}
          trendType="neutral"
        />
        <StatCard
          label="Outstanding Debt"
          value={overview.totalDebt}
          icon={'\u26a0\ufe0f'}
          color="purple"
          href="/admin/banking"
          trendType={overview.totalDebt > 0 ? 'negative' : 'neutral'}
        />
      </div>

      <RecentTransactionsTable transactions={overview.recentTransactions} />
    </>
  );
}
