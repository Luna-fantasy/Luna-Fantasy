import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import clientPromise from '@/lib/mongodb';
import { isR2Configured, listPrefixes } from '@/lib/admin/r2';
import PageHeader from '../_components/PageHeader';
import MediaClient from './MediaClient';
import type { BrowseResult, CanvasLayouts } from './types';

export const dynamic = 'force-dynamic';

async function getCanvasLayouts(bot: 'butler' | 'jester'): Promise<CanvasLayouts> {
  const client = await clientPromise;
  const doc = await client.db('Database').collection('bot_config').findOne({ _id: `${bot}_canvas_layouts` as any });
  return (doc?.data as CanvasLayouts) ?? {};
}

async function getInitialAssets(): Promise<BrowseResult> {
  try {
    if (!isR2Configured()) return { folders: [], objects: [], truncated: false };
    const res = await listPrefixes();
    return {
      folders: res.folders,
      // serialize Date → ISO for client
      objects: res.objects.map((o) => ({
        key: o.key,
        size: o.size,
        lastModified: (o.lastModified as any instanceof Date) ? (o.lastModified as any).toISOString() : String(o.lastModified),
        url: o.url,
      })),
      truncated: res.truncated,
    };
  } catch (e) {
    console.error('[media/page] R2 listing failed:', e);
    return { folders: [], objects: [], truncated: false };
  }
}

export default async function MediaPage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  const [butlerLayouts, jesterLayouts, initialAssets] = await Promise.all([
    getCanvasLayouts('butler'),
    getCanvasLayouts('jester'),
    getInitialAssets(),
  ]);

  return (
    <>
      <PageHeader
        title="Media"
        subtitle="Here you control what the bots render — canvas layouts, element positions, colors, and all uploaded assets."
      />
      <MediaClient
        butlerLayouts={butlerLayouts}
        jesterLayouts={jesterLayouts}
        initialAssets={initialAssets}
        r2Ready={isR2Configured()}
      />
    </>
  );
}
