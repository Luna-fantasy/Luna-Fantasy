import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { E } from '@/components/edit-mode/EditableText';
import { ReadingDesk } from '@/components/cinematic/ReadingDesk';
import { EditorialMotif } from '../cinematic-editorial/EditorialMotif';
import '@/styles/legal.css';
import '@/styles/luna-editorial-public.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'refundPage' });

  const title = `${t('title')} | Luna`;
  const description = t('desc');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/refund/`,
      languages: { en: 'https://lunarian.app/en/refund/', ar: 'https://lunarian.app/ar/refund/' },
    },
    openGraph: {
      type: 'article',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/refund/`,
      title,
      description,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
    },
  };
}

export default async function RefundPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <RefundContent />;
}

function RefundContent() {
  const t = useTranslations('refundPage');

  return (
    <main className="legal-page" data-luna-editorial="legal">
      <div className="wrap">
        <div className="legal-header">
          <EditorialMotif motif="refund" />
          <h1><E ns="refundPage" k="title">{t('title')}</E></h1>
          <p><E ns="refundPage" k="desc">{t('desc')}</E></p>
        </div>
        <ReadingDesk>
          <p><E ns="refundPage" k="content">{t('content')}</E></p>
        </ReadingDesk>
      </div>
    </main>
  );
}
