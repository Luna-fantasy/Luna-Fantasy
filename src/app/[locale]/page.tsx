import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { HeroSection } from './components/HeroSection';
import { E } from '@/components/edit-mode/EditableText';
import { EImg } from '@/components/edit-mode/EditableImage';
import '@/styles/home.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  const title = `${t('pageTitle')} - Epic Fantasy Universe`;
  const description = t('pageDesc');

  return {
    title: t('pageTitle'),
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/`,
      languages: { en: 'https://lunarian.app/en/', ar: 'https://lunarian.app/ar/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/`,
      title,
      description,
      images: [{ url: 'https://lunarian.app/images/og-image.png', width: 1200, height: 630, alt: 'Luna Fantasy' }],
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

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations('hero');
  const overview = useTranslations('overview');
  const showcase = useTranslations('showcase');
  const features = useTranslations('features');
  const faq = useTranslations('faq');

  return (
    <>
      <HeroSection />

      {/* Showcase Section */}
      <section className="showcase-section" id="overview">
        <div className="wrap">
          <div className="showcase-header">
            <h2 className="section-title"><E ns="overview" k="title">{overview('title')}</E></h2>
            <p className="section-subtitle"><E ns="overview" k="subtitle">{overview('subtitle')}</E></p>
          </div>

          {/* Story Showcase */}
          <div className="showcase-row">
            <div className="showcase-media">
              <div className="media-glow media-glow-gold"></div>
              <div className="media-frame">
                <EImg
                  editId="home-story-champion"
                  src="/story/champion.png"
                  alt="Luna Story"
                  width={500}
                  height={400}
                  loading="lazy"
                />
              </div>
            </div>
            <div className="showcase-content">
              <span className="showcase-tag showcase-tag-gold"><E ns="overview" k="tagChapter">{overview('tagChapter')}</E></span>
              <h3 className="showcase-title"><E ns="showcase" k="storyTitle">{showcase('storyTitle')}</E></h3>
              <p className="showcase-desc"><E ns="showcase" k="storyDesc">{showcase('storyDesc')}</E></p>
              <Link href="/story" className="btn btn-primary"><E ns="showcase" k="linkRead">{showcase('linkRead')}</E></Link>
            </div>
          </div>

          {/* Game Showcase */}
          <div className="showcase-row">
            <div className="showcase-media">
              <div className="media-glow media-glow-purple"></div>
              <div className="media-frame">
                <EImg
                  editId="home-luna-fantasy"
                  src="/images/luna-fantasy.png"
                  alt="Card Game"
                  width={500}
                  height={400}
                  loading="lazy"
                  style={{ objectFit: 'cover', background: '#0a0c12' }}
                />
              </div>
            </div>
            <div className="showcase-content">
              <span className="showcase-tag showcase-tag-purple"><E ns="overview" k="tagSystem">{overview('tagSystem')}</E></span>
              <h3 className="showcase-title"><E ns="showcase" k="gameTitle">{showcase('gameTitle')}</E></h3>
              <p className="showcase-desc"><E ns="showcase" k="gameDesc">{showcase('gameDesc')}</E></p>
              <Link href="/luna-fantasy" className="btn btn-primary"><E ns="showcase" k="linkCards">{showcase('linkCards')}</E></Link>
            </div>
          </div>

          {/* Characters Showcase */}
          <div className="showcase-row">
            <div className="showcase-media">
              <div className="media-glow media-glow-fire"></div>
              <div className="media-frame">
                <EImg
                  editId="home-our-characters"
                  src="/images/our-characters.png"
                  alt="Characters"
                  width={500}
                  height={400}
                  loading="lazy"
                />
              </div>
            </div>
            <div className="showcase-content">
              <span className="showcase-tag showcase-tag-fire"><E ns="overview" k="tagHeroes">{overview('tagHeroes')}</E></span>
              <h3 className="showcase-title"><E ns="showcase" k="charsTitle">{showcase('charsTitle')}</E></h3>
              <p className="showcase-desc"><E ns="showcase" k="charsDesc">{showcase('charsDesc')}</E></p>
              <Link href="/characters" className="btn btn-primary"><E ns="showcase" k="linkView">{showcase('linkView')}</E></Link>
            </div>
          </div>

          {/* Bank Showcase */}
          <div className="showcase-row">
            <div className="showcase-media">
              <div className="media-glow media-glow-gold-bank"></div>
              <div className="media-frame">
                <EImg
                  editId="home-bank-hero"
                  source="r2"
                  src="https://assets.lunarian.app/backgrounds/BankHero.png"
                  alt="Luna Bank"
                  width={500}
                  height={400}
                  loading="lazy"
                  style={{ objectFit: 'cover', background: '#0a0c12' }}
                />
              </div>
            </div>
            <div className="showcase-content">
              <span className="showcase-tag showcase-tag-gold-bank"><E ns="overview" k="tagBank">{overview('tagBank')}</E></span>
              <h3 className="showcase-title"><E ns="showcase" k="bankTitle">{showcase('bankTitle')}</E></h3>
              <p className="showcase-desc"><E ns="showcase" k="bankDesc">{showcase('bankDesc')}</E></p>
              <Link href="/bank" className="btn btn-primary"><E ns="showcase" k="linkBank">{showcase('linkBank')}</E></Link>
            </div>
          </div>

          {/* Partners Showcase */}
          <div className="showcase-row">
            <div className="showcase-media">
              <div className="media-glow media-glow-partners"></div>
              <div className="media-frame">
                <EImg
                  editId="home-partners-hero"
                  source="r2"
                  src="https://assets.lunarian.app/partners/partners-hero.png"
                  alt="Luna Partners"
                  width={500}
                  height={400}
                  loading="lazy"
                  style={{ objectFit: 'cover', background: '#0a0c12' }}
                />
              </div>
            </div>
            <div className="showcase-content">
              <span className="showcase-tag showcase-tag-partners"><E ns="overview" k="tagPartners">{overview('tagPartners')}</E></span>
              <h3 className="showcase-title"><E ns="showcase" k="partnersTitle">{showcase('partnersTitle')}</E></h3>
              <p className="showcase-desc"><E ns="showcase" k="partnersDesc">{showcase('partnersDesc')}</E></p>
              <Link href="/partners" className="btn btn-primary"><E ns="showcase" k="linkPartners">{showcase('linkPartners')}</E></Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="wrap">
          <div className="showcase-header">
            <h2 className="section-title"><E ns="features" k="title">{features('title')}</E></h2>
            <p className="section-subtitle"><E ns="features" k="subtitle">{features('subtitle')}</E></p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">&#9876;</div>
              <h3><E ns="features" k="lore.title">{features('lore.title')}</E></h3>
              <p><E ns="features" k="lore.desc">{features('lore.desc')}</E></p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">&#127183;</div>
              <h3><E ns="features" k="cards.title">{features('cards.title')}</E></h3>
              <p><E ns="features" k="cards.desc">{features('cards.desc')}</E></p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">&#128101;</div>
              <h3><E ns="features" k="community.title">{features('community.title')}</E></h3>
              <p><E ns="features" k="community.desc">{features('community.desc')}</E></p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section" id="faq">
        <div className="wrap">
          <div className="showcase-header">
            <h2 className="section-title"><E ns="faq" k="title">{faq('title')}</E></h2>
            <p className="section-subtitle"><E ns="faq" k="subtitle">{faq('subtitle')}</E></p>
          </div>

          <div className="faq-grid">
            <div className="faq-item">
              <h3 className="faq-question"><E ns="faq" k="q1.question">{faq('q1.question')}</E></h3>
              <p className="faq-answer"><E ns="faq" k="q1.answer">{faq('q1.answer')}</E></p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question"><E ns="faq" k="q2.question">{faq('q2.question')}</E></h3>
              <p className="faq-answer"><E ns="faq" k="q2.answer">{faq('q2.answer')}</E></p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question"><E ns="faq" k="q3.question">{faq('q3.question')}</E></h3>
              <p className="faq-answer"><E ns="faq" k="q3.answer">{faq('q3.answer')}</E></p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question"><E ns="faq" k="q4.question">{faq('q4.question')}</E></h3>
              <p className="faq-answer"><E ns="faq" k="q4.answer">{faq('q4.answer')}</E></p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question"><E ns="faq" k="q5.question">{faq('q5.question')}</E></h3>
              <p className="faq-answer"><E ns="faq" k="q5.answer">{faq('q5.answer')}</E></p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question"><E ns="faq" k="q6.question">{faq('q6.question')}</E></h3>
              <p className="faq-answer"><E ns="faq" k="q6.answer">{faq('q6.answer')}</E></p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
