import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import '@/styles/story.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'storyPage' });

  const title = `${t('title')} | Luna Fantasy`;
  const description = t('desc');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/story/`,
      languages: { en: 'https://lunarian.app/en/story/', ar: 'https://lunarian.app/ar/story/' },
    },
    openGraph: {
      type: 'article',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/story/`,
      title,
      description,
      images: [{ url: 'https://lunarian.app/images/og-image.png', width: 1200, height: 630, alt: 'Luna Fantasy Story' }],
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

export default async function StoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <StoryContent />;
}

function StoryContent() {
  const t = useTranslations('storyPage');
  const hero = useTranslations('hero');

  return (
    <>
      {/* Story Hero */}
      <section className="story-hero">
        <div className="story-hero-bg"></div>
        <div className="story-hero-content">
          <span className="hero-badge">{hero('badge')}</span>
          <h1 className="story-hero-title">{t('title')}</h1>
          <p className="story-hero-desc">{t('desc')}</p>
        </div>
      </section>

      {/* Chapters */}
      <section className="chapters-section">
        <div className="wrap">
          {/* Chapter 1 */}
          <article className="chapter" id="chapter-1">
            <div className="chapter-header">
              <span className="chapter-label">{t('chapter1.label')}</span>
              <h2 className="chapter-title">{t('chapter1.title')}</h2>
            </div>
            <div className="chapter-content">
              <p>{t('chapter1.p1')}</p>
              <p>{t('chapter1.p2')}</p>
              <blockquote className="story-quote">
                {t('chapter1.quote')}
              </blockquote>
              <p>{t('chapter1.p3')}</p>
            </div>
          </article>

          <div className="timeline-break"></div>

          {/* Chapter 2 */}
          <article className="chapter" id="chapter-2">
            <div className="chapter-header">
              <span className="chapter-label">{t('chapter2.label')}</span>
              <h2 className="chapter-title">{t('chapter2.title')}</h2>
            </div>
            <div className="chapter-content">
              <div className="chapter-image">
                <Image
                  src="/story/champion.png"
                  alt="The Chaos War"
                  width={600}
                  height={400}
                  loading="lazy"
                />
              </div>
              <p>{t('chapter2.p1')}</p>
              <p>{t('chapter2.p2')}</p>
              <blockquote className="story-quote">
                {t('chapter2.quote')}
              </blockquote>
              <p>{t('chapter2.p3')}</p>
            </div>
          </article>

          <div className="timeline-break"></div>

          {/* Chapter 3 */}
          <article className="chapter" id="chapter-3">
            <div className="chapter-header">
              <span className="chapter-label">{t('chapter3.label')}</span>
              <h2 className="chapter-title">{t('chapter3.title')}</h2>
            </div>
            <div className="chapter-content">
              <p>{t('chapter3.p1')}</p>
              <p>{t('chapter3.p2')}</p>
              <blockquote className="story-quote">
                {t('chapter3.quote')}
              </blockquote>
              <p>{t('chapter3.p3')}</p>
            </div>
          </article>

          {/* Coming Soon */}
          <div className="coming-soon">
            <h3>{t('moreChapters')}</h3>
            <p>{t('moreChaptersDesc')}</p>
            <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              {hero('joinBtn')}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
