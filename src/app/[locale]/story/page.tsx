import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { E } from '@/components/edit-mode/EditableText';
import { EImg } from '@/components/edit-mode/EditableImage';
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
          <span className="hero-badge"><E ns="hero" k="badge">{hero('badge')}</E></span>
          <h1 className="story-hero-title"><E ns="storyPage" k="title">{t('title')}</E></h1>
          <p className="story-hero-desc"><E ns="storyPage" k="desc">{t('desc')}</E></p>
        </div>
      </section>

      {/* Chapters */}
      <section className="chapters-section">
        <div className="wrap">
          {/* Chapter 1 */}
          <article className="chapter" id="chapter-1">
            <div className="chapter-header">
              <span className="chapter-label"><E ns="storyPage" k="chapter1.label">{t('chapter1.label')}</E></span>
              <h2 className="chapter-title"><E ns="storyPage" k="chapter1.title">{t('chapter1.title')}</E></h2>
            </div>
            <div className="chapter-content">
              <p><E ns="storyPage" k="chapter1.p1">{t('chapter1.p1')}</E></p>
              <p><E ns="storyPage" k="chapter1.p2">{t('chapter1.p2')}</E></p>
              <blockquote className="story-quote">
                <E ns="storyPage" k="chapter1.quote">{t('chapter1.quote')}</E>
              </blockquote>
              <p><E ns="storyPage" k="chapter1.p3">{t('chapter1.p3')}</E></p>
            </div>
          </article>

          <div className="timeline-break"></div>

          {/* Chapter 2 */}
          <article className="chapter" id="chapter-2">
            <div className="chapter-header">
              <span className="chapter-label"><E ns="storyPage" k="chapter2.label">{t('chapter2.label')}</E></span>
              <h2 className="chapter-title"><E ns="storyPage" k="chapter2.title">{t('chapter2.title')}</E></h2>
            </div>
            <div className="chapter-content">
              <div className="chapter-image">
                <EImg
                  editId="storyPage.chapter2.image"
                  src="/story/champion.png"
                  alt="The Chaos War"
                  width={600}
                  height={400}
                  loading="lazy"
                />
              </div>
              <p><E ns="storyPage" k="chapter2.p1">{t('chapter2.p1')}</E></p>
              <p><E ns="storyPage" k="chapter2.p2">{t('chapter2.p2')}</E></p>
              <blockquote className="story-quote">
                <E ns="storyPage" k="chapter2.quote">{t('chapter2.quote')}</E>
              </blockquote>
              <p><E ns="storyPage" k="chapter2.p3">{t('chapter2.p3')}</E></p>
            </div>
          </article>

          <div className="timeline-break"></div>

          {/* Chapter 3 */}
          <article className="chapter" id="chapter-3">
            <div className="chapter-header">
              <span className="chapter-label"><E ns="storyPage" k="chapter3.label">{t('chapter3.label')}</E></span>
              <h2 className="chapter-title"><E ns="storyPage" k="chapter3.title">{t('chapter3.title')}</E></h2>
            </div>
            <div className="chapter-content">
              <p><E ns="storyPage" k="chapter3.p1">{t('chapter3.p1')}</E></p>
              <p><E ns="storyPage" k="chapter3.p2">{t('chapter3.p2')}</E></p>
              <blockquote className="story-quote">
                <E ns="storyPage" k="chapter3.quote">{t('chapter3.quote')}</E>
              </blockquote>
              <p><E ns="storyPage" k="chapter3.p3">{t('chapter3.p3')}</E></p>
            </div>
          </article>

          {/* Coming Soon */}
          <div className="coming-soon">
            <h3><E ns="storyPage" k="moreChapters">{t('moreChapters')}</E></h3>
            <p><E ns="storyPage" k="moreChaptersDesc">{t('moreChaptersDesc')}</E></p>
            <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <E ns="hero" k="joinBtn">{hero('joinBtn')}</E>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
