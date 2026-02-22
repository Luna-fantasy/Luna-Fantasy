import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/bazaar.css';
import '@/styles/bazaar-reveal.css';
import BazaarContent from './BazaarContent';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'bazaarPage' });

  const title = `${t('title')} | Luna Fantasy`;
  const description = t('subtitle');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/bazaar/`,
      languages: { en: 'https://lunarian.app/en/bazaar/', ar: 'https://lunarian.app/ar/bazaar/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/bazaar/`,
      title,
      description,
      images: [{ url: 'https://lunarian.app/images/og-image.png', width: 1200, height: 630, alt: 'Luna Bazaar' }],
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

export default async function BazaarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <BazaarContent />
    </Suspense>
  );
}
