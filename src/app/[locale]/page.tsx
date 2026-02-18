import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { HeroSection } from './components/HeroSection';
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
            <h2 className="section-title">{overview('title')}</h2>
            <p className="section-subtitle">{overview('subtitle')}</p>
          </div>

          {/* Story Showcase */}
          <div className="showcase-row">
            <div className="showcase-media">
              <div className="media-glow media-glow-gold"></div>
              <div className="media-frame">
                <Image
                  src="/story/champion.png"
                  alt="Luna Story"
                  width={500}
                  height={400}
                  loading="lazy"
                />
              </div>
            </div>
            <div className="showcase-content">
              <span className="showcase-tag showcase-tag-gold">{overview('tagChapter')}</span>
              <h3 className="showcase-title">{showcase('storyTitle')}</h3>
              <p className="showcase-desc">{showcase('storyDesc')}</p>
              <Link href="/story" className="btn btn-primary">{showcase('linkRead')}</Link>
            </div>
          </div>

          {/* Game Showcase */}
          <div className="showcase-row">
            <div className="showcase-media">
              <div className="media-glow media-glow-purple"></div>
              <div className="media-frame">
                <Image
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
              <span className="showcase-tag showcase-tag-purple">{overview('tagSystem')}</span>
              <h3 className="showcase-title">{showcase('gameTitle')}</h3>
              <p className="showcase-desc">{showcase('gameDesc')}</p>
              <Link href="/luna-fantasy" className="btn btn-primary">{showcase('linkCards')}</Link>
            </div>
          </div>

          {/* Characters Showcase */}
          <div className="showcase-row">
            <div className="showcase-media">
              <div className="media-glow media-glow-fire"></div>
              <div className="media-frame">
                <Image
                  src="/images/our-characters.png"
                  alt="Characters"
                  width={500}
                  height={400}
                  loading="lazy"
                />
              </div>
            </div>
            <div className="showcase-content">
              <span className="showcase-tag showcase-tag-fire">{overview('tagHeroes')}</span>
              <h3 className="showcase-title">{showcase('charsTitle')}</h3>
              <p className="showcase-desc">{showcase('charsDesc')}</p>
              <Link href="/characters" className="btn btn-primary">{showcase('linkView')}</Link>
            </div>
          </div>

          {/* Bank Showcase */}
          <div className="showcase-row">
            <div className="showcase-media">
              <div className="media-glow media-glow-gold-bank"></div>
              <div className="media-frame">
                <Image
                  src="/images/hero-bank.jpeg"
                  alt="Luna Bank"
                  width={500}
                  height={400}
                  loading="lazy"
                  style={{ objectFit: 'cover', background: '#0a0c12' }}
                />
              </div>
            </div>
            <div className="showcase-content">
              <span className="showcase-tag showcase-tag-gold-bank">{overview('tagBank')}</span>
              <h3 className="showcase-title">{showcase('bankTitle')}</h3>
              <p className="showcase-desc">{showcase('bankDesc')}</p>
              <Link href="/bank" className="btn btn-primary">{showcase('linkBank')}</Link>
            </div>
          </div>

          {/* Partners Showcase */}
          <div className="showcase-row">
            <div className="showcase-media">
              <div className="media-glow media-glow-partners"></div>
              <div className="media-frame">
                <Image
                  src="/images/partners/partners-hero.png"
                  alt="Luna Partners"
                  width={500}
                  height={400}
                  loading="lazy"
                  style={{ objectFit: 'cover', background: '#0a0c12' }}
                />
              </div>
            </div>
            <div className="showcase-content">
              <span className="showcase-tag showcase-tag-partners">{overview('tagPartners')}</span>
              <h3 className="showcase-title">{showcase('partnersTitle')}</h3>
              <p className="showcase-desc">{showcase('partnersDesc')}</p>
              <Link href="/partners" className="btn btn-primary">{showcase('linkPartners')}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="wrap">
          <div className="showcase-header">
            <h2 className="section-title">{features('title')}</h2>
            <p className="section-subtitle">{features('subtitle')}</p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">&#9876;</div>
              <h3>{features('lore.title')}</h3>
              <p>{features('lore.desc')}</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">&#127183;</div>
              <h3>{features('cards.title')}</h3>
              <p>{features('cards.desc')}</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">&#128101;</div>
              <h3>{features('community.title')}</h3>
              <p>{features('community.desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section" id="faq">
        <div className="wrap">
          <div className="showcase-header">
            <h2 className="section-title">{faq('title')}</h2>
            <p className="section-subtitle">{faq('subtitle')}</p>
          </div>

          <div className="faq-grid">
            <div className="faq-item">
              <h3 className="faq-question">{faq('q1.question')}</h3>
              <p className="faq-answer">{faq('q1.answer')}</p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question">{faq('q2.question')}</h3>
              <p className="faq-answer">{faq('q2.answer')}</p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question">{faq('q3.question')}</h3>
              <p className="faq-answer">{faq('q3.answer')}</p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question">{faq('q4.question')}</h3>
              <p className="faq-answer">{faq('q4.answer')}</p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question">{faq('q5.question')}</h3>
              <p className="faq-answer">{faq('q5.answer')}</p>
            </div>

            <div className="faq-item">
              <h3 className="faq-question">{faq('q6.question')}</h3>
              <p className="faq-answer">{faq('q6.answer')}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
