import Link from 'next/link';
import PageHeader from '../_components/PageHeader';
import Icon from '../_components/Icon';
import DeployClient from './DeployClient';

export const dynamic = 'force-dynamic';

export default function DeployV2Page() {
  return (
    <>
      <PageHeader
        title="Deploy Pipeline"
        subtitle="Trigger a VPS deploy for any bot. The agent pulls, installs, builds, restarts, and verifies — live stepper while it runs."
        actions={
          <Link href="/admin/ops" className="av-btn av-btn-ghost">
            <Icon name="overview" /> Back to Operations
          </Link>
        }
      />
      <DeployClient />
    </>
  );
}
