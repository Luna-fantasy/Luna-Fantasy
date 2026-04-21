import { redirect } from 'next/navigation';
import { requireMastermindApi } from '@/lib/admin/auth';
import clientPromise from '@/lib/mongodb';
import { FOOTER_DEFAULTS } from '@/lib/admin/footer-defaults';
import { getLunaMapConfig } from '@/lib/bazaar/shop-config';
import PageHeader from '../_components/PageHeader';
import InfoClient from './InfoClient';
import type { FooterConfig, LunaMapDoc, Partner } from './types';

export const dynamic = 'force-dynamic';

async function getPartners(): Promise<Partner[]> {
  const client = await clientPromise;
  const docs = await client.db('Database').collection('partners').find().sort({ order: 1 }).toArray();
  return docs.map((d: any) => ({
    _id: String(d._id),
    id: d.id,
    name: d.name,
    type: d.type ?? { en: '', ar: '' },
    description: d.description ?? { en: '', ar: '' },
    logo: d.logo ?? '',
    website: d.website,
    socials: d.socials ?? {},
    order: d.order ?? 0,
  }));
}

async function getFooter(): Promise<FooterConfig> {
  const client = await clientPromise;
  const doc = await client.db('Database').collection('bot_config').findOne({ _id: 'footer_config' as any });
  return (doc?.data as FooterConfig | undefined) ?? FOOTER_DEFAULTS;
}

export default async function InfoPage() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) redirect('/admin');

  const [partners, lunaMapRaw, footer] = await Promise.all([
    getPartners(),
    getLunaMapConfig(),
    getFooter(),
  ]);

  const lunaMap: LunaMapDoc = lunaMapRaw
    ? {
        title:          lunaMapRaw.title ?? '',
        title_en:       lunaMapRaw.title_en ?? '',
        description:    lunaMapRaw.description ?? '',
        description_en: lunaMapRaw.description_en ?? '',
        image:          lunaMapRaw.image ?? '',
        buttons:        Array.isArray(lunaMapRaw.buttons) ? lunaMapRaw.buttons as LunaMapDoc['buttons'] : [],
      }
    : { title: '', title_en: '', description: '', description_en: '', image: '', buttons: [] };

  return (
    <>
      <PageHeader
        title="Info"
        subtitle="Here you edit public-facing content — partner listings, the Luna world map, and the website footer."
      />
      <InfoClient partners={partners} lunaMap={lunaMap} footer={footer} />
    </>
  );
}
