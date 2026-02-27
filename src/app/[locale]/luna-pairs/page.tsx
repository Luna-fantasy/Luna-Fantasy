import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/luna-pairs.css';
import { LunaPairsContent } from './LunaPairsContent';
import { getLunaPairsFactions } from '@/lib/luna-pairs';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'lunaPairsPage' });

  const title = `Luna Pairs | Luna`;
  const description = t('subtitle');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/luna-pairs/`,
      languages: { en: 'https://lunarian.app/en/luna-pairs/', ar: 'https://lunarian.app/ar/luna-pairs/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna',
      url: `https://lunarian.app/${locale}/luna-pairs/`,
      title,
      description,
      images: [{ url: 'https://lunarian.app/images/og-image.png', width: 1200, height: 630, alt: 'Luna Pairs Card Game' }],
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

export default async function LunaPairsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const factions = await getLunaPairsFactions();

  return (
    <LunaPairsContent
      factions={factions}
      locale={locale as 'en' | 'ar'}
    />
  );
}
