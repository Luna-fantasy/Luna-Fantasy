import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { E } from '@/components/edit-mode/EditableText';
import { ReadingDesk } from '@/components/cinematic/ReadingDesk';
import { EditorialMotif } from '../cinematic-editorial/EditorialMotif';
import '@/styles/legal.css';
import '@/styles/luna-editorial-public.css';

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

function Section({ titleKey, contentKey }: { titleKey: string; contentKey: string }) {
  const t = useTranslations('privacyPage');
  return (
    <div style={{ marginBottom: '28px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
        <E ns="privacyPage" k={titleKey}>{t(titleKey)}</E>
      </h2>
      <div style={{ whiteSpace: 'pre-line' }}>
        <E ns="privacyPage" k={contentKey}>{t(contentKey)}</E>
      </div>
    </div>
  );
}

function PrivacyContent() {
  const t = useTranslations('privacyPage');

  const sections = [
    'overview', 'dataCollected', 'howWeUse', 'thirdParty',
    'lunaSage', 'dataRetention', 'userRights', 'security',
    'children', 'changes', 'contact',
  ];

  return (
    <main className="legal-page" data-luna-editorial="legal">
      <div className="wrap">
        <div className="legal-header">
          <EditorialMotif motif="privacy" />
          <h1><E ns="privacyPage" k="title">{t('title')}</E></h1>
          <p><E ns="privacyPage" k="desc">{t('desc')}</E></p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>
            <E ns="privacyPage" k="lastUpdated">{t('lastUpdated')}</E>
          </p>
        </div>
        <ReadingDesk>
          {sections.map((key) => (
            <Section key={key} titleKey={`${key}Title`} contentKey={`${key}Content`} />
          ))}
        </ReadingDesk>
      </div>
    </main>
  );
}
