import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/bank.css';
import { BankContent } from './BankContent';
import bankData from '@/data/bank.json';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'bankPage' });

  return {
    title: `${t('title')} | Luna Fantasy`,
    description: t('subtitle'),
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
