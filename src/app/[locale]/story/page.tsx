import { getTranslations, setRequestLocale } from 'next-intl/server';
import TabGuard from '@/components/TabGuard';
import { StoryFolio } from './StoryFolio';

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

  return <TabGuard tabKey="story"><StoryFolio locale={locale} /></TabGuard>;
}
