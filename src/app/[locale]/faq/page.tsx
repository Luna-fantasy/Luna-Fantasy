import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import '@/styles/legal.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'faq' });

  const title = `${t('title')} | Luna`;
  const description = t('subtitle');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/faq/`,
      languages: { en: 'https://lunarian.app/en/faq/', ar: 'https://lunarian.app/ar/faq/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/faq/`,
      title,
      description,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
    },
  };
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FaqContent />;
}

function FaqContent() {
  const t = useTranslations('faq');

  const questions = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;

  return (
    <section className="faq-page">
      <div className="wrap">
        <div className="faq-header">
          <h1>{t('title')}</h1>
          <p>{t('subtitle')}</p>
        </div>
        <div className="faq-list">
          {questions.map((key) => (
            <div key={key} className="faq-item">
              <h3>{t(`${key}.question`)}</h3>
              <p>{t(`${key}.answer`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
