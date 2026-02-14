import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ReactNode } from 'react';

import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;

  return {
    title: 'Luna',
    description: locale === 'ar'
      ? 'لونا — عالم فانتازيا ضخم متكامل على منصة ديسكورد.'
      : 'Luna - A massive integrated fantasy world on Discord with over 200 characters.',
    keywords: 'Luna, Luna Fantasy, Discord roleplay, fantasy game, card game, RPG, roleplay community, fantasy world, Kuwait',
    authors: [{ name: 'Buried Games Studio' }],
    creator: 'Buried Games Studio',
    publisher: 'Buried Games Studio',
    metadataBase: new URL('https://lunarian.app'),
    alternates: {
      canonical: `https://lunarian.app/${locale}/`,
      languages: {
        en: 'https://lunarian.app/en/',
        ar: 'https://lunarian.app/ar/',
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/`,
      title: 'Luna - Epic Fantasy Universe',
      description: locale === 'ar'
        ? 'لونا — عالم فانتازيا ضخم متكامل على منصة ديسكورد يضم أكثر من 200 شخصية.'
        : 'A massive integrated fantasy world on Discord with over 200 characters.',
      images: [{ url: 'https://lunarian.app/images/og-image.png', width: 1200, height: 630, alt: 'Luna Fantasy' }],
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Luna - Epic Fantasy Universe',
      description: locale === 'ar'
        ? 'لونا — عالم فانتازيا ضخم متكامل على منصة ديسكورد يضم أكثر من 200 شخصية.'
        : 'A massive integrated fantasy world on Discord with over 200 characters.',
      images: ['https://lunarian.app/images/og-image.png'],
    },
    icons: {
      icon: [
        { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      ],
      apple: '/icons/apple-touch-icon.png',
    },
  };
}

export const viewport = {
  themeColor: '#030306',
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'en' | 'ar')) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  const messages = await getMessages();
  const isRTL = locale === 'ar';

  return (
    <div lang={locale} dir={isRTL ? 'rtl' : 'ltr'}>
      <NextIntlClientProvider messages={messages}>
        <div className="epic-bg" />
        <div className="particles-container" id="particles" />
        <Navbar />
        {children}
        <Footer />
      </NextIntlClientProvider>
    </div>
  );
}
