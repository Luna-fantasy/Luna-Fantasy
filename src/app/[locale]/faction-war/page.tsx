import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/faction-war.css';
import { FactionWarContent } from './FactionWarContent';
import { getFactionWarFactions } from '@/lib/faction-war';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'factionWarPage' });

  const title = `Faction War | Luna`;
  const description = t('subtitle');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/faction-war/`,
      languages: { en: 'https://lunarian.app/en/faction-war/', ar: 'https://lunarian.app/ar/faction-war/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna',
      url: `https://lunarian.app/${locale}/faction-war/`,
      title,
      description,
      images: [{ url: 'https://lunarian.app/images/og-image.png', width: 1200, height: 630, alt: 'Faction War Card Game' }],
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://lunarian.app/images/og-image.png'],
    },
  };
}

export default async function FactionWarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const factions = await getFactionWarFactions();

  return (
    <FactionWarContent
      factions={factions}
      locale={locale as 'en' | 'ar'}
    />
  );
}
