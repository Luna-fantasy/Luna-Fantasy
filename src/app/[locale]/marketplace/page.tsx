import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/marketplace.css';
import MarketplaceContent from './MarketplaceContent';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketplacePage' });

  const title = `${t('title')} | Luna Fantasy`;
  const description = t('subtitle');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/marketplace/`,
      languages: { en: 'https://lunarian.app/en/marketplace/', ar: 'https://lunarian.app/ar/marketplace/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/marketplace/`,
      title,
      description,
      images: [{ url: 'https://lunarian.app/images/og-image.png', width: 1200, height: 630, alt: 'Luna Marketplace' }],
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

export default async function MarketplacePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  if (!FEATURE_FLAGS.marketplace) {
    redirect(`/${locale}`);
  }

  setRequestLocale(locale);

  return (
    <Suspense>
      <MarketplaceContent />
    </Suspense>
  );
}
