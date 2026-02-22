import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/legal.css';

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
    <section className="legal-page">
      <div className="wrap">
        <div className="legal-header">
          <h1>{t('title')}</h1>
          <p>{t('desc')}</p>
        </div>
        <div className="legal-content">
          <p>{t('content')}</p>
        </div>
      </div>
    </section>
  );
}
