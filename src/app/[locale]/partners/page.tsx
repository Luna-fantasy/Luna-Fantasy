import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/partners.css';
import { PartnersContent } from './PartnersContent';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'partnersPage' });

  return {
    title: `${t('title')} | Luna Fantasy`,
    description: t('subtitle'),
  };
}

export default async function PartnersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PartnersContent locale={locale as 'en' | 'ar'} />;
}
