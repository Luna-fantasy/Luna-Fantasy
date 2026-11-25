import Link from 'next/link';
import { Suspense } from 'react';
import { getEconomyOverview } from '@/lib/admin/db';
import { getEconomyFlows } from '@/lib/admin/economy-flows';
import StatCard from './_components/StatCard';
import Surface from './_components/Surface';
import PageHeader from './_components/PageHeader';
import Icon from './_components/Icon';
import HourlyBars from './_components/HourlyBars';
import RatioMeter from './_components/RatioMeter';
import RecentTransactionsList from './_components/RecentTransactionsList';
import LiveActivityPulse from './_components/LiveActivityPulse';
import LunariFlows from './_components/LunariFlows';
import ApplicationsQueue from './_components/ApplicationsQueue';
import SystemHealth from './_components/SystemHealth';
import Skeleton from './_components/Skeleton';
import DashboardLayout, { Section } from './_components/DashboardLayout';
import { CommandShortcut } from './_components/CmdKProvider';

// Server wrappers for streaming Suspense
async function FlowsSection() {
  const flows = await getEconomyFlows();
  return <LunariFlows flows={flows} />;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}



export default async function OverviewPage() {
  const overview = await getEconomyOverview();
  const hourly = overview.hourlyTransactions;
  const totalToday = hourly.reduce((a, b) => a + b, 0);

  // Reserve vs Circulating proportion for the ratio meter
  const ratioParts = [
    { label: 'In circulation', value: overview.totalLunariCirculation, tone: '#00d4ff' },
    { label: 'Bank reserve',   value: overview.bankReserve,            tone: '#8b5cf6' },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Here you see the pulse of Luna — live player count, economy flow, and system health at a glance."
        actions={
          <Link href="/admin/ops" className="av-btn av-btn-primary">
            <Icon name="bot" /> Operations
          </Link>
        }
      />

      <DashboardLayout>
        <Section id="stats" label="Headline stats">
      <div className="av-stat-grid">
        <StatCard
          label="Server Members"
          icon="users"
          tone="cyan"
          value={overview.totalUsers}
          copyable
          hint={overview.memberCountSource === 'discord' ? 'Guild member count from the latest Butler snapshot.' : 'Accounts with leveling records. The Discord member snapshot is unavailable.'}
          meta={overview.memberCountSource === 'discord' ? 'Discord snapshot' : 'Leveling records · estimate'}
        />
        <StatCard
          label="Lunari in Circulation"
          icon="coins"
          tone="gold"
          value={overview.totalLunariCirculation}
          copyable
          hint="Sum of every user's Lunari balance across the points collection."
          meta={`${fmt(overview.activeHolders)} holders`}
        />
        <StatCard
          label="Bank Reserve"
          icon="bank"
          tone="purple"
          value={overview.bankReserve}
          copyable
          hint="Lunari held in the central bank vault. Backs loans and investments."
          meta="Held in vault"
        />
        <StatCard
          label="Active Loans"
          icon="trending"
          tone="green"
          value={overview.activeLoans}
          copyable
          hint="Number of active loan records and their remaining repayments."
          meta={overview.activeLoans > 0 ? `${fmt(overview.activeLoanValue)} Lunari in repayments` : 'No active loans'}
        />
        <StatCard
          label="Outstanding Debt"
          icon="shield"
          tone={overview.totalDebt > 0 ? 'red' : 'cyan'}
          value={overview.totalDebt}
          copyable
          hint="Total Lunari owed according to the debt ledger."
          meta="Debt ledger"
        />
      </div>
        </Section>

        <Section id="activity" label="Hourly + Distribution">
      <div className="av-grid-2">
        <Surface
          title="Hourly Activity"
          icon="trending"
          meta={`${fmt(totalToday)} txns / 24h · UTC`}
        >
          <HourlyBars data={hourly} />
        </Surface>

        <Surface
          title="Lunari Distribution"
          icon="coins"
          meta="Reserve vs market"
        >
          <RatioMeter parts={ratioParts} />
        </Surface>
      </div>
        </Section>

        <Section id="flows" label="Lunari flows">
      <Suspense fallback={<Skeleton variant="card" height={180} />}>
        <FlowsSection />
      </Suspense>
        </Section>

        <Section id="live" label="Live activity + Applications">
      <div className="av-grid-2">
        <LiveActivityPulse />

        <Suspense fallback={<Skeleton variant="card" height={260} />}>
          <ApplicationsQueue />
        </Suspense>
      </div>
        </Section>

        <Section id="recent" label="Recent transactions + System health">
      <div className="av-grid-2">
        <Surface
          title="Recent Transactions"
          icon="coins"
          meta={`Last ${Math.min(overview.recentTransactions.length, 12)}`}
          actions={
            <Link href="/admin/economy" className="av-btn av-btn-ghost">View all</Link>
          }
          flush
        >
          <RecentTransactionsList transactions={overview.recentTransactions.slice(0, 12)} />
        </Surface>

        <Surface title="System Health" icon="server" actions={
          <Link href="/admin/ops" className="av-btn av-btn-ghost">Operations</Link>
        }>
          <SystemHealth />
          <p className="av-callout">
            <strong>Tip</strong> — press <kbd>?</kbd> for keyboard shortcuts. <CommandShortcut /> opens global search, right-click rows for actions.
          </p>
        </Surface>
      </div>
        </Section>
      </DashboardLayout>
    </>
  );
}

