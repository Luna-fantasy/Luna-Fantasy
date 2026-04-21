import { Suspense } from 'react';
import Link from 'next/link';
import { getLevelStats, getTopLeveled, getLevelDistribution, getRecentLevelChanges } from '@/lib/admin/leveling';
import PageHeader from '../_components/PageHeader';
import StatCard from '../_components/StatCard';
import Icon from '../_components/Icon';
import Skeleton from '../_components/Skeleton';
import TopLevelsTable from './TopLevelsTable';
import LevelDistribution from './LevelDistribution';
import RecentLevelChanges from './RecentLevelChanges';
import LevelingConfigPanel from './LevelingConfigPanel';

export const dynamic = 'force-dynamic';

function fmt(n: number): string { return n.toLocaleString('en-US'); }

async function TopSection() {
  const top = await getTopLeveled(25);
  return <TopLevelsTable rows={top} />;
}

async function DistributionSection() {
  const buckets = await getLevelDistribution();
  return <LevelDistribution buckets={buckets} />;
}

async function RecentSection() {
  const recent = await getRecentLevelChanges(12);
  return <RecentLevelChanges rows={recent} />;
}

export default async function LevelingPage() {
  const stats = await getLevelStats();
  const voiceHours = Math.round(stats.totalVoiceMinutes / 60);

  return (
    <>
      <PageHeader
        title="Leveling"
        subtitle="Here you see XP distribution, rank progress, and leveling activity across the community."
        actions={
          <Link href="/admin/audit?actions=level_modify" className="av-btn av-btn-ghost">
            <Icon name="audit" /> Level audit trail
          </Link>
        }
      />

      <div className="av-stat-grid">
        <StatCard
          label="Leveled Users"
          icon="users"
          tone="cyan"
          value={stats.totalLeveled}
          copyable
          hint="Members who have earned any XP."
        />
        <StatCard
          label="Average Level"
          icon="trending"
          tone="green"
          value={Math.round(stats.avgLevel * 10) / 10}
          hint="Mean level across all participating users."
        />
        <StatCard
          label="Highest Level"
          icon="trophy"
          tone="gold"
          value={stats.maxLevel}
          hint="Top level reached by any player."
        />
        <StatCard
          label="Total XP"
          icon="sparkles"
          tone="purple"
          value={stats.totalXp}
          copyable
          hint="Sum of XP earned across the ecosystem."
        />
        <StatCard
          label="Messages / Voice"
          icon="megaphone"
          tone="cyan"
          value={stats.totalMessages}
          meta={voiceHours > 0 ? `${fmt(voiceHours)} voice hours` : 'Voice: —'}
          hint="Total messages sent across channels (voice time in subscript)."
        />
      </div>

      <Suspense fallback={<Skeleton variant="card" height={200} />}>
        <DistributionSection />
      </Suspense>

      <div className="av-grid-2">
        <Suspense fallback={<Skeleton variant="card" height={420} />}>
          <TopSection />
        </Suspense>
        <Suspense fallback={<Skeleton variant="card" height={420} />}>
          <RecentSection />
        </Suspense>
      </div>

      <LevelingConfigPanel />
    </>
  );
}
