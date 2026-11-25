import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import ContactForm from './ContactForm';
import { E } from '@/components/edit-mode/EditableText';
import { EditorialMotif } from '../cinematic-editorial/EditorialMotif';
import '@/styles/legal.css';
import '@/styles/luna-editorial-public.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contactPage' });

  const title = `${t('title')} | Luna`;
  const description = t('subtitle');

  return {
    title,
    description,
    alternates: {
      canonical: `https://lunarian.app/${locale}/contact/`,
      languages: { en: 'https://lunarian.app/en/contact/', ar: 'https://lunarian.app/ar/contact/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Luna Fantasy',
      url: `https://lunarian.app/${locale}/contact/`,
      title,
      description,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
    },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ContactContent />;
}

function ContactContent() {
  const t = useTranslations('contactPage');

  return (
    <main className="contact-page" data-luna-editorial="contact">
      <div className="wrap">
        <div className="contact-header">
          <div className="luna-editorial-copy">
            <h1><E ns="contactPage" k="title">{t('title')}</E></h1>
            <p><E ns="contactPage" k="subtitle">{t('subtitle')}</E></p>
          </div>
          <EditorialMotif motif="contact" />
        </div>
        <ContactForm />
      </div>
    </main>
  );
}
