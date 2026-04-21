import { Suspense } from 'react';
import PageHeader from '../_components/PageHeader';
import Skeleton from '../_components/Skeleton';
import BankingClient from './BankingClient';
import { getEconomyOverview } from '@/lib/admin/db';

export const dynamic = 'force-dynamic';

export default async function BankingPage() {
  const overview = await getEconomyOverview();

  return (
    <>
      <PageHeader
        title="Banking"
        subtitle="Avelle Adar's domain — the Bank of Luna. Configure his persona, manage the reserve, and tune every loan, investment, and insurance on the server."
      />
      <Suspense fallback={<Skeleton variant="card" height={520} />}>
        <BankingClient
          initialReserve={overview.bankReserve}
          initialActiveLoans={overview.activeLoans}
          initialLoanValue={overview.activeLoanValue}
          initialTotalDebt={overview.totalDebt}
        />
      </Suspense>
    </>
  );
}
