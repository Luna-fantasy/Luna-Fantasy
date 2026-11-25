import { getTranslations, setRequestLocale } from 'next-intl/server';
import { HeroSection } from './components/HeroSection';
import { NightJourney } from './components/NightJourney';
import '@/styles/home.css';
import '@/styles/luna-cinematic-home.css';

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


  return (
    <main data-luna-home>
      <HeroSection />
      <NightJourney />
    </main>
  );
}
