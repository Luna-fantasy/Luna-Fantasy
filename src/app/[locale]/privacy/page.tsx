import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { E } from '@/components/edit-mode/EditableText';
import '@/styles/legal.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacyPage' });

  const title = `${t('title')} | Luna`;
  const description = t('desc');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/privacy/`,
      languages: { en: 'https://lunarian.app/en/privacy/', ar: 'https://lunarian.app/ar/privacy/' },
    },
    openGraph: {
      type: 'article',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/privacy/`,
      title,
      description,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
    },
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PrivacyContent />;
}

function PrivacyContent() {
  const t = useTranslations('privacyPage');

  return (
    <section className="legal-page">
      <div className="wrap">
        <div className="legal-header">
          <h1><E ns="privacyPage" k="title">{t('title')}</E></h1>
          <p><E ns="privacyPage" k="desc">{t('desc')}</E></p>
        </div>
        <div className="legal-content">
          <p><E ns="privacyPage" k="content">{t('content')}</E></p>
        </div>
      </div>
    </section>
  );
}
