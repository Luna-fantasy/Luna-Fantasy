import { getCardsSnapshot } from '@/lib/admin/cards-v2';
import PageHeader from '../_components/PageHeader';
import StatCard from '../_components/StatCard';
import CardsClient from './CardsClient';

export const dynamic = 'force-dynamic';

export default async function CardsPage() {
  const snap = await getCardsSnapshot();

  return (
    <>
      <PageHeader
        title="Cards"
        subtitle="Here you control the full card catalog — add, edit, remove cards, and see who holds each one."
      />

      <div className="av-stat-grid">
        <StatCard
          label="Cards Defined"
          icon="cards"
          tone="cyan"
          value={snap.totals.defined}
          hint="Distinct cards across every rarity tier in the canonical catalog."
        />
        <StatCard
          label="Copies in Hands"
          icon="trending"
          tone="purple"
          value={snap.totals.owned}
          copyable
          hint="Total cards owned across all players (counting duplicates)."
        />
        <StatCard
          label="Active Holders"
          icon="users"
          tone="green"
          value={snap.totals.holders}
          hint="Players with at least one card."
        />
        <StatCard
          label="Legendaries"
          icon="trophy"
          tone="gold"
          value={snap.totals.rarityCounts.LEGENDARY ?? 0}
          meta={`${snap.totals.rarityCounts.SECRET ?? 0} secrets · ${snap.totals.rarityCounts.FORBIDDEN ?? 0} forbidden`}
        />
        <StatCard
          label="Forbidden"
          icon="shield"
          tone="red"
          value={snap.totals.rarityCounts.FORBIDDEN ?? 0}
          meta="Rarest of rare"
        />
      </div>

      <CardsClient snapshot={snap} />
    </>
  );
}
