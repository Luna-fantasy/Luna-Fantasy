import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/bank.css';
import { BankContent } from './BankContent';
import bankData from '@/data/bank.json';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'bankPage' });

  const title = `${t('title')} | Luna Fantasy`;
  const description = t('subtitle');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/bank/`,
      languages: { en: 'https://lunarian.app/en/bank/', ar: 'https://lunarian.app/ar/bank/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/bank/`,
      title,
      description,
      images: [{ url: 'https://lunarian.app/images/og-image.png', width: 1200, height: 630, alt: 'Luna Bank' }],
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

export default async function BankPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <BankContent
      data={bankData}
      locale={locale as 'en' | 'ar'}
    />
  );
}
