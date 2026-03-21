import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ReactNode } from 'react';

import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { EditModeProvider } from '@/lib/edit-mode/context';
import { EditToolbar } from '@/components/edit-mode/EditToolbar';
import '@/styles/edit-mode.css';

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
    keywords: locale === 'ar'
      ? 'لونا, لونا فانتسي, ديسكورد, لعبة كروت, فانتازيا, لعب أدوار, مجتمع, الكويت, السعودية'
      : 'Luna, Luna Fantasy, Discord roleplay, fantasy game, card game, RPG, roleplay community, fantasy world, Kuwait, Saudi Arabia',
    authors: [{ name: 'Buried Games Studio' }],
    creator: 'Buried Games Studio',
    publisher: 'Buried Games Studio',
    metadataBase: new URL('https://lunarian.app'),
    alternates: {
      canonical: `https://lunarian.app/${locale}/`,
      languages: {
        en: 'https://lunarian.app/en/',
        ar: 'https://lunarian.app/ar/',
        'x-default': 'https://lunarian.app/en/',
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
      alternateLocale: locale === 'ar' ? 'en_US' : 'ar_SA',
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
    other: {
      'geo.region': 'KW',
      'geo.placename': 'Kuwait',
      'geo.position': '29.3759;47.9774',
      'ICBM': '29.3759, 47.9774',
      'content-language': locale,
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

  setRequestLocale(locale);

  const messages = await getMessages();
  const isRTL = locale === 'ar';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Lunarian',
    alternateName: 'Luna Fantasy',
    url: 'https://lunarian.app',
    logo: 'https://lunarian.app/images/logo.png',
    description: 'A massive integrated fantasy universe on Discord with strategic card games, deep lore, and a living economy.',
    foundingDate: '2024',
    sameAs: [
      'https://discord.gg/lunarian',
      'https://www.instagram.com/lunarian.app',
      'https://www.tiktok.com/@lunarian.app',
    ],
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'KW',
    },
    areaServed: [
      { '@type': 'Country', name: 'Kuwait' },
      { '@type': 'Country', name: 'Saudi Arabia' },
      { '@type': 'Place', name: 'Worldwide' },
    ],
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Lunarian',
    alternateName: 'Luna',
    url: 'https://lunarian.app',
    inLanguage: [
      { '@type': 'Language', name: 'English', alternateName: 'en' },
      { '@type': 'Language', name: 'Arabic', alternateName: 'ar' },
    ],
  };

  return (
    <div lang={locale} dir={isRTL ? 'rtl' : 'ltr'}>
      <NextIntlClientProvider messages={messages}>
        <EditModeProvider locale={locale}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
          />
          <div className="epic-bg" />
          <div className="particles-container" id="particles" />
          <EditToolbar />
          <Navbar />
          {children}
          <Footer />
        </EditModeProvider>
      </NextIntlClientProvider>
    </div>
  );
}
