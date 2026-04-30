import { getSiteTabs } from '@/lib/admin/site-tabs';
import SiteTabsClient from './SiteTabsClient';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Site Tabs · Luna Admin',
    robots: { index: false, follow: false },
};

export default async function SiteTabsPage() {
    const tabs = await getSiteTabs();
    return <SiteTabsClient initialTabs={tabs} />;
}
