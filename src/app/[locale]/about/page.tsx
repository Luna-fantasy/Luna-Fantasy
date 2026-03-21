import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { E } from '@/components/edit-mode/EditableText';
import '@/styles/about.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'aboutPage' });

  const title = `${t('title')} | Luna`;
  const description = t('subtitle');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/about/`,
      languages: { en: 'https://lunarian.app/en/about/', ar: 'https://lunarian.app/ar/about/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/about/`,
      title,
      description,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
    },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AboutContent />;
}

function AboutContent() {
  const t = useTranslations('aboutPage');

  const stats = [
    { key: 'statCharacters', icon: 'characters' },
    { key: 'statCards', icon: 'cards' },
    { key: 'statGames', icon: 'games' },
    { key: 'statStones', icon: 'stones' },
  ] as const;

  const pillars = ['story', 'cards', 'economy', 'community'] as const;

  return (
    <section className="about-page">
      {/* Hero */}
      <div className="about-hero">
        <div className="about-hero-glow" />
        <div className="wrap">
          <span className="about-badge"><E ns="aboutPage" k="badge">{t('badge')}</E></span>
          <h1><E ns="aboutPage" k="title">{t('title')}</E></h1>
          <p className="about-subtitle"><E ns="aboutPage" k="subtitle">{t('subtitle')}</E></p>
        </div>
      </div>

      {/* Origin Story */}
      <div className="wrap">
        <div className="about-origin">
          <div className="about-origin-label"><E ns="aboutPage" k="originLabel">{t('originLabel')}</E></div>
          <h2><E ns="aboutPage" k="originTitle">{t('originTitle')}</E></h2>
          <p><E ns="aboutPage" k="originP1">{t('originP1')}</E></p>
          <p><E ns="aboutPage" k="originP2">{t('originP2')}</E></p>
          <blockquote className="about-quote">
            <E ns="aboutPage" k="originQuote">{t('originQuote')}</E>
          </blockquote>
          <p><E ns="aboutPage" k="originP3">{t('originP3')}</E></p>
        </div>

        {/* Stats strip */}
        <div className="about-stats">
          {stats.map(({ key, icon }) => (
            <div key={key} className="about-stat">
              <div className={`about-stat-icon about-stat-icon--${icon}`}>
                {icon === 'characters' && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                )}
                {icon === 'cards' && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="14" height="18" rx="2" /><path d="M8 4V2" /><path d="M12 4V2" /><path d="M20 8h2" /><path d="M20 12h2" /><rect x="8" y="2" width="14" height="18" rx="2" opacity="0.5" />
                  </svg>
                )}
                {icon === 'games' && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="6" y1="12" x2="10" y2="12" /><line x1="8" y1="10" x2="8" y2="14" /><circle cx="15" cy="13" r="1" /><circle cx="18" cy="11" r="1" /><rect x="2" y="6" width="20" height="12" rx="4" />
                  </svg>
                )}
                {icon === 'stones' && (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                )}
              </div>
              <span className="about-stat-value"><E ns="aboutPage" k={`${key}.value`}>{t(`${key}.value`)}</E></span>
              <span className="about-stat-label"><E ns="aboutPage" k={`${key}.label`}>{t(`${key}.label`)}</E></span>
            </div>
          ))}
        </div>

        {/* What is Lunarian */}
        <div className="about-section">
          <h2><E ns="aboutPage" k="whatTitle">{t('whatTitle')}</E></h2>
          <p><E ns="aboutPage" k="whatP1">{t('whatP1')}</E></p>
          <p><E ns="aboutPage" k="whatP2">{t('whatP2')}</E></p>
        </div>

        {/* Four Pillars */}
        <div className="about-pillars">
          {pillars.map((key) => (
            <div key={key} className="about-pillar">
              <h3><E ns="aboutPage" k={`pillars.${key}.title`}>{t(`pillars.${key}.title`)}</E></h3>
              <p><E ns="aboutPage" k={`pillars.${key}.desc`}>{t(`pillars.${key}.desc`)}</E></p>
            </div>
          ))}
        </div>

        {/* Vision */}
        <div className="about-section about-vision">
          <h2><E ns="aboutPage" k="visionTitle">{t('visionTitle')}</E></h2>
          <p><E ns="aboutPage" k="visionP1">{t('visionP1')}</E></p>
          <blockquote className="about-quote">
            <E ns="aboutPage" k="visionQuote">{t('visionQuote')}</E>
          </blockquote>
        </div>

        {/* CTA */}
        <div className="about-cta">
          <h2><E ns="aboutPage" k="ctaTitle">{t('ctaTitle')}</E></h2>
          <p><E ns="aboutPage" k="ctaDesc">{t('ctaDesc')}</E></p>
          <div className="about-cta-buttons">
            <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer" className="about-btn about-btn-primary">
              <E ns="aboutPage" k="ctaJoin">{t('ctaJoin')}</E>
            </a>
            <Link href="/story" className="about-btn about-btn-secondary">
              <E ns="aboutPage" k="ctaStory">{t('ctaStory')}</E>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
