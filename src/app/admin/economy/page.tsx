import { Suspense } from 'react';
import Link from 'next/link';
import { getEconomyOverview } from '@/lib/admin/db';
import { getTopHolders, getLoanSummary } from '@/lib/admin/top-holders';
import { getEconomyFlows } from '@/lib/admin/economy-flows';
import PageHeader from '../_components/PageHeader';
import StatCard from '../_components/StatCard';
import Surface from '../_components/Surface';
import Icon from '../_components/Icon';
import LunariFlows from '../_components/LunariFlows';
import RecentTransactionsList from '../_components/RecentTransactionsList';
import Skeleton from '../_components/Skeleton';
import TopHoldersTable from './TopHoldersTable';
import LoanSummaryCard from './LoanSummaryCard';
import EconomyConfigPanel from './EconomyConfigPanel';
import EconomySimulator from './EconomySimulator';
import clientPromise from '@/lib/mongodb';

async function getEconomyConfig() {
  try {
    const client = await clientPromise;
    const doc = await client.db('Database').collection('bot_config').findOne({ _id: 'butler_economy' as any });
    const data = doc?.data ?? {};
    const raw = data.daily_reward ?? {};
    // Back-compat: accept either {amount} or legacy {min, max}
    const dailyAmount =
      typeof raw.amount === 'number' ? raw.amount
      : typeof raw.max === 'number' ? raw.max
      : typeof raw.min === 'number' ? raw.min
      : 3000;
    return {
      dailyAmount,
      salaryAmount: data.salary?.amount ?? 80000,
      investorAmount: data.investor_reward?.amount ?? data.vip_reward?.amount ?? 2000,
    };
  } catch {
    return { dailyAmount: 3000, salaryAmount: 80000, investorAmount: 2000 };
  }
}

export const dynamic = 'force-dynamic';

function fmt(n: number): string { return n.toLocaleString('en-US'); }

async function HoldersSection() {
  const holders = await getTopHolders(25);
  return <TopHoldersTable rows={holders} />;
}

async function LoansSection() {
  const loans = await getLoanSummary();
  return <LoanSummaryCard summary={loans} />;
}

async function FlowsSection() {
  const flows = await getEconomyFlows();
  return <LunariFlows flows={flows} />;
}

export default async function EconomyPage() {
  const overview = await getEconomyOverview();
  const econConfig = await getEconomyConfig();

  return (
    <>
      <PageHeader
        title="Economy"
        subtitle="Here you monitor the Lunari economy — who holds what, active loans, and how currency flows through Lunvor."
        actions={
          <Link href="/admin/audit?actions=balance_modify" className="av-btn av-btn-ghost">
            <Icon name="audit" /> Admin credits
          </Link>
        }
      />

      <div className="av-stat-grid">
        <StatCard
          label="Lunari in Circulation"
          icon="coins"
          tone="gold"
          value={overview.totalLunariCirculation}
          copyable
          hint="Sum of every user balance. Not counting the bank reserve."
          meta={`${fmt(overview.activeHolders)} active holders`}
        />
        <StatCard
          label="Bank Reserve"
          icon="bank"
          tone="purple"
          value={overview.bankReserve}
          copyable
          hint="Lunari held in the vault. Backs loans and investments."
          meta="Held in vault"
        />
        <StatCard
          label="Active Loans"
          icon="trending"
          tone="green"
          value={overview.activeLoans}
          copyable
          hint="Users with outstanding loans."
          meta={overview.activeLoanValue > 0 ? `${fmt(overview.activeLoanValue)} Lunari out` : 'No outstanding'}
        />
        <StatCard
          label="Outstanding Debt"
          icon="shield"
          tone={overview.totalDebt > 0 ? 'red' : 'cyan'}
          value={overview.totalDebt}
          copyable
          hint="Total owed across all active loans."
        />
        <StatCard
          label="Ecosystem"
          icon="users"
          tone="cyan"
          value={overview.totalUsers}
          copyable
          meta="Guild members"
        />
      </div>

      <Suspense fallback={<Skeleton variant="card" height={220} />}>
        <FlowsSection />
      </Suspense>

      <div className="av-grid-2">
        <Suspense fallback={<Skeleton variant="card" height={420} />}>
          <HoldersSection />
        </Suspense>
        <Suspense fallback={<Skeleton variant="card" height={420} />}>
          <LoansSection />
        </Suspense>
      </div>

      <Surface
        title="Recent Transactions"
        icon="coins"
        meta={`Last ${Math.min(overview.recentTransactions.length, 30)}`}
        flush
      >
        <RecentTransactionsList transactions={overview.recentTransactions.slice(0, 30)} />
      </Surface>

      <EconomyConfigPanel />

      <EconomySimulator current={{ ...econConfig, totalUsers: overview.totalUsers }} />
    </>
  );
}
