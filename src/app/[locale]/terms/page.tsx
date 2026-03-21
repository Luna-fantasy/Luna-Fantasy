import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { E } from '@/components/edit-mode/EditableText';
import '@/styles/legal.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'termsPage' });

  const title = `${t('title')} | Luna`;
  const description = t('desc');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/terms/`,
      languages: { en: 'https://lunarian.app/en/terms/', ar: 'https://lunarian.app/ar/terms/' },
    },
    openGraph: {
      type: 'article',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/terms/`,
      title,
      description,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
    },
  };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <TermsContent />;
}

function TermsContent() {
  const t = useTranslations('termsPage');

  return (
    <section className="legal-page">
      <div className="wrap">
        <div className="legal-header">
          <h1><E ns="termsPage" k="title">{t('title')}</E></h1>
          <p><E ns="termsPage" k="desc">{t('desc')}</E></p>
        </div>
        <div className="legal-content">
          <p><E ns="termsPage" k="content">{t('content')}</E></p>
        </div>
      </div>
    </section>
  );
}
