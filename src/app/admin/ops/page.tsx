import Link from 'next/link';
import { Suspense } from 'react';
import OpsClient from './OpsClient';
import PageHeader from '../_components/PageHeader';
import Icon from '../_components/Icon';
import DeployTimeline from '../_components/DeployTimeline';
import Skeleton from '../_components/Skeleton';

export default function OpsPage() {
  return (
    <>
      <PageHeader
        title="Operations"
        subtitle="Here you manage bot processes, deployments, and server health — everything running behind Luna."
        actions={
          <Link href="/admin" className="av-btn av-btn-ghost">
            <Icon name="overview" /> Back to Dashboard
          </Link>
        }
      />
      <OpsClient />
      <Suspense fallback={<Skeleton variant="card" height={220} />}>
        <DeployTimeline />
      </Suspense>
    </>
  );
}
