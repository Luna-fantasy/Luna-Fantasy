import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { E } from '@/components/edit-mode/EditableText';
import { EImg } from '@/components/edit-mode/EditableImage';
import { StoryCoverImage } from '@/components/edit-mode/StoryCoverImage';
import { JourneyAtlas } from './JourneyAtlas';
import styles from './night-journey.module.css';

const highlights = '/luna-cinematic/home-story/highlights';

const destinations = [
  { id: 'story', href: '/story', title: 'storyTitle', desc: 'storyDesc', tag: 'tagChapter', cta: 'linkRead', editId: 'home-story-champion', file: '', source: 'public' },
  { id: 'game', href: '/luna-fantasy', title: 'gameTitle', desc: 'gameDesc', tag: 'tagSystem', cta: 'linkCards', editId: 'home-luna-fantasy', file: 'fantasy.webp', source: 'public' },
  { id: 'characters', href: '/characters', title: 'charsTitle', desc: 'charsDesc', tag: 'tagHeroes', cta: 'linkView', editId: 'home-our-characters', file: 'characters.webp', source: 'public' },
  { id: 'bank', href: '/bank', title: 'bankTitle', desc: 'bankDesc', tag: 'tagBank', cta: 'linkBank', editId: 'home-bank-hero', file: 'bank.webp', source: 'r2' },
  { id: 'partners', href: '/partners', title: 'partnersTitle', desc: 'partnersDesc', tag: 'tagPartners', cta: 'linkPartners', editId: 'home-partners-hero', file: 'partners.webp', source: 'r2' },
] as const;

const features = [
  { key: 'lore', href: '/story', image: '/luna-cinematic/home-story/story/lunvor-original-remastered.webp' },
  { key: 'cards', href: '/luna-fantasy', image: '/luna-cinematic/cards/stages/luna/table.webp' },
  { key: 'community', href: '/members', image: '/luna-cinematic/home-story/highlights/partners.webp' },
] as const;

const questions = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;

export function NightJourney() {
  const locale = useLocale();
  const overview = useTranslations('overview');
  const showcase = useTranslations('showcase');
  const feature = useTranslations('features');
  const faq = useTranslations('faq');

  const entries = destinations.map((destination) => {
    const title = showcase(destination.title);
    const picture = {
      editId: destination.editId,
      alt: title,
      width: 1536,
      height: 1024,
      sizes: '(max-width: 720px) 100vw, (min-width: 2100px) 1920px, 92vw',
      className: styles.artwork,
      draggable: false,
    };

    return {
      id: destination.id,
      title,
      panel: (
        <article className={styles.scene} data-scene={destination.id} aria-labelledby={`journey-heading-${destination.id}`}>
          <div className={styles.art} data-journey-art>
            {destination.id === 'story'
              ? <StoryCoverImage {...picture} />
              : <EImg {...picture} src={`${highlights}/${destination.file}`} source={destination.source} />}
          </div>
          <div className={styles.caption}>
            <p className={styles.sceneTag}><E ns="overview" k={destination.tag}>{overview(destination.tag)}</E></p>
            <h3 id={`journey-heading-${destination.id}`} className={styles.sceneTitle}>
              <E ns="showcase" k={destination.title}>{title}</E>
            </h3>
            <p className={styles.description}><E ns="showcase" k={destination.desc}>{showcase(destination.desc)}</E></p>
            <Link href={destination.href} className={styles.action}>
              <E ns="showcase" k={destination.cta}>{showcase(destination.cta)}</E>
              <i aria-hidden="true" className={styles.arrow} />
            </Link>
          </div>
        </article>
      ),
    };
  });

  return (
    <div className={styles.journey} data-night-journey>
      <section id="overview" aria-labelledby="journey-title" className={styles.overview}>
        <header className={styles.introduction}>
          <h2 id="journey-title" className={styles.title}><E ns="overview" k="title">{overview('title')}</E></h2>
          <p className={styles.subtitle}><E ns="overview" k="subtitle">{overview('subtitle')}</E></p>
        </header>
        <JourneyAtlas entries={entries} locale={locale} />
      </section>

      <section className={styles.features} aria-labelledby="journey-features-title">
        <header className={styles.sectionHead}>
          <h2 id="journey-features-title" className={styles.title}><E ns="features" k="title">{feature('title')}</E></h2>
          <p className={styles.subtitle}><E ns="features" k="subtitle">{feature('subtitle')}</E></p>
        </header>
        <div className={styles.triptych}>
          {features.map(({ key, href, image }) => (
            <Link key={key} href={href} className={styles.feature} data-window={key}>
              <div className={styles.window}>
                <Image src={image} alt="" fill sizes={key === 'lore' ? '(max-width: 560px) 92vw, (min-width: 2100px) 615px, 29vw' : '(max-width: 560px) 43vw, (min-width: 2100px) 615px, 29vw'} />
              </div>
              <div className={styles.featureText}>
                <h3><E ns="features" k={`${key}.title`}>{feature(`${key}.title`)}</E></h3>
                <i aria-hidden="true" className={styles.arrow} />
                <p><E ns="features" k={`${key}.desc`}>{feature(`${key}.desc`)}</E></p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section id="faq" className={styles.faq} aria-labelledby="journey-faq-title">
        <div className={styles.faqInside}>
          <header className={styles.faqIntro}>
            <h2 id="journey-faq-title" className={styles.title}><E ns="faq" k="title">{faq('title')}</E></h2>
            <p className={styles.subtitle}><E ns="faq" k="subtitle">{faq('subtitle')}</E></p>
          </header>
          <div className={styles.answers}>
            {questions.map((key, index) => (
              <details key={key} open={index === 0} className={styles.question}>
                <summary>
                  <h3><E ns="faq" k={`${key}.question`}>{faq(`${key}.question`)}</E></h3>
                  <i className={styles.toggle} aria-hidden="true" />
                </summary>
                <p><E ns="faq" k={`${key}.answer`}>{faq(`${key}.answer`)}</E></p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

