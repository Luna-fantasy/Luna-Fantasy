import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import '@/styles/bazaar.css';
import '@/styles/bazaar-reveal.css';
import MerchantPage from './MerchantPage';

const VALID_MERCHANTS = ['kael', 'meluna', 'zoldar'] as const;
type MerchantSlug = (typeof VALID_MERCHANTS)[number];

const MERCHANT_KEYS: Record<MerchantSlug, { nameKey: string; titleKey: string }> = {
  kael: { nameKey: 'kael.name', titleKey: 'kael.title' },
  meluna: { nameKey: 'meluna.name', titleKey: 'meluna.title' },
  zoldar: { nameKey: 'zoldar.name', titleKey: 'zoldar.title' },
};

export function generateStaticParams() {
  return VALID_MERCHANTS.map((merchant) => ({ merchant }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; merchant: string }>;
}) {
  const { locale, merchant } = await params;

  if (!VALID_MERCHANTS.includes(merchant as MerchantSlug)) return {};

  const t = await getTranslations({ locale, namespace: 'bazaarPage' });
  const keys = MERCHANT_KEYS[merchant as MerchantSlug];

  const merchantName = t(keys.nameKey);
  const title = `${merchantName} — ${t('title')} | Luna Fantasy`;
  const description = `${merchantName} — ${t(keys.titleKey)}`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/bazaar/${merchant}/`,
      languages: {
        en: `https://lunarian.app/en/bazaar/${merchant}/`,
        ar: `https://lunarian.app/ar/bazaar/${merchant}/`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/bazaar/${merchant}/`,
      title,
      description,
      images: [
        {
          url: 'https://lunarian.app/images/og-image.png',
          width: 1200,
          height: 630,
          alt: merchantName,
        },
      ],
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: ['https://lunarian.app/images/og-image.png'],
    },
  };
}

export default async function MerchantPageRoute({
  params,
}: {
  params: Promise<{ locale: string; merchant: string }>;
}) {
  const { locale, merchant } = await params;
  setRequestLocale(locale);

  if (!VALID_MERCHANTS.includes(merchant as MerchantSlug)) {
    notFound();
  }

  return (
    <Suspense>
      <MerchantPage merchant={merchant as MerchantSlug} />
    </Suspense>
  );
}
