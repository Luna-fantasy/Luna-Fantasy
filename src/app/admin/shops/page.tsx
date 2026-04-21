import clientPromise from '@/lib/mongodb';
import PageHeader from '../_components/PageHeader';
import ShopsClient from './ShopsClient';
import TradingConfigPanel from './TradingConfigPanel';

export const dynamic = 'force-dynamic';

interface VendorDoc {
  _id: string;
  data: any;
  updatedAt: Date | null;
  updatedBy: string | null;
}

async function getVendors(): Promise<VendorDoc[]> {
  const client = await clientPromise;
  const docs = await client.db('Database').collection('vendor_config').find({}).toArray();
  return docs.map((d: any) => ({
    _id: String(d._id),
    data: d.data ?? null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt) : null,
    updatedBy: d.updatedBy ? String(d.updatedBy) : null,
  }));
}

export default async function ShopsPage() {
  const vendors = await getVendors();
  // Serialize for client (Date → string)
  const safeVendors = vendors.map((v) => ({
    id: v._id,
    data: v.data,
    updatedAt: v.updatedAt?.toISOString() ?? null,
    updatedBy: v.updatedBy,
  }));
  return (
    <>
      <PageHeader
        title="Shops"
        subtitle="Here you control every vendor — their inventory, prices, portraits, and what they sell."
      />
      <ShopsClient vendors={safeVendors} />
      <TradingConfigPanel />
    </>
  );
}
