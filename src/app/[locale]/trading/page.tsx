import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/trading.css';
import TradingContent from './TradingContent';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tradingPage' });

  const title = `${t('title')} | Luna Fantasy`;
  const description = t('subtitle');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/trading/`,
      languages: { en: 'https://lunarian.app/en/trading/', ar: 'https://lunarian.app/ar/trading/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/trading/`,
      title,
      description,
      images: [{ url: 'https://lunarian.app/images/og-image.png', width: 1200, height: 630, alt: 'Luna Trading' }],
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

export default async function TradingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <TradingContent />
    </Suspense>
  );
}
