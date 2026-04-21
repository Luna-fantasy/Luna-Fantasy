import PageHeader from '../_components/PageHeader';
import UsersClient from './UsersClient';

export const dynamic = 'force-dynamic';

export default function UsersPage() {
  return (
    <>
      <PageHeader
        title="Residents of Lunvor"
        subtitle="Here you see every resident of Lunvor — their passport, balance, activity, and any anomalies worth checking."
      />
      <UsersClient />
    </>
  );
}
