import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/bank.css';
import { BankContent } from './BankContent';
import bankData from '@/data/bank.json';
import { getLiveBankConfig } from '@/lib/bank/live-bank-config';

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

  // Read live config from MongoDB (30s cache, falls back to defaults)
  const liveConfig = await getLiveBankConfig();

  // Merge live values into the static bank data for the logged-out view
  const mergedData = {
    ...bankData,
    salary: {
      ...bankData.salary,
      daily: {
        ...bankData.salary.daily,
        basePay: liveConfig.dailyBase,
        vipBonus: liveConfig.dailyVipBonus,
      },
      monthly: {
        ...bankData.salary.monthly,
        amount: liveConfig.monthlyAmount,
      },
    },
    loans: {
      ...bankData.loans,
      interestRate: Math.round(liveConfig.loanInterestRate * 100),
      vipInterestRate: Math.round(liveConfig.loanVipInterestRate * 100),
      deadline: Math.round(liveConfig.loanDurationMs / 86_400_000),
      tiers: liveConfig.loanTiers,
    },
    insurance: {
      ...bankData.insurance,
      theftProtection: {
        ...bankData.insurance.theftProtection,
        cost: liveConfig.insuranceCost,
      },
    },
    vip: {
      ...bankData.vip,
      depositRequirement: liveConfig.investmentMinAmount,
    },
  };

  return (
    <BankContent
      data={mergedData}
      locale={locale as 'en' | 'ar'}
    />
  );
}
