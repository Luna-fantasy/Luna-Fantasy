'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';

interface Partner {
  id: string;
  name: string;
  type: { en: string; ar: string };
  description: { en: string; ar: string };
  logo: string;
  website?: string;
  socials: {
    instagram?: string;
    x?: string;
    tiktok?: string;
    youtube?: string;
  };
}

const partners: Partner[] = [
  {
    id: 'gamer-snack',
    name: 'Gamer Snack',
    type: { en: 'Gaming Content Creator', ar: 'صانع محتوى ألعاب' },
    description: {
      en: 'A popular gaming content creator delivering entertaining gaming content across multiple platforms. From gameplay highlights to gaming tips, Gamer Snack keeps the gaming community engaged.',
      ar: 'صانع محتوى ألعاب شهير يقدم محتوى ترفيهي للألعاب عبر منصات متعددة. من أبرز اللحظات في الألعاب إلى نصائح الألعاب، يبقي Gamer Snack مجتمع الألعاب متفاعلاً.',
    },
    logo: '/images/partners/gamer-snack-logo.jpeg',
    socials: {
      instagram: 'https://www.instagram.com/gamer_snack',
      x: 'https://x.com/gamer_snack',
      tiktok: 'https://www.tiktok.com/@gamersnack',
      youtube: 'https://youtube.com/@gamersnack',
    },
  },
  {
    id: 'respa-design',
    name: 'Respa Design',
    type: { en: 'Creative Design Studio', ar: 'استوديو تصميم إبداعي' },
    description: {
      en: 'A creative design studio specializing in gaming graphics, branding, and visual content. Respa Design brings imagination to life through stunning artwork and design.',
      ar: 'استوديو تصميم إبداعي متخصص في رسومات الألعاب والعلامات التجارية والمحتوى البصري. يجسد Respa Design الخيال من خلال الأعمال الفنية والتصميم المذهل.',
    },
    logo: '/images/partners/respa-design-logo.jpeg',
    socials: {
      instagram: 'https://www.instagram.com/respadesign/',
    },
  },
  {
    id: 'buried-games',
    name: 'Buried Games',
    type: { en: 'Indie Game Studio', ar: 'استوديو ألعاب مستقل' },
    description: {
      en: 'An indie game development studio based in Kuwait, founded in 2018. Buried Games specializes in creating strategy and multiplayer games, unearthing immersive worlds and crafting unforgettable gaming experiences.',
      ar: 'استوديو تطوير ألعاب مستقل مقره الكويت، تأسس في 2018. يتخصص Buried Games في إنشاء ألعاب الاستراتيجية ومتعددة اللاعبين، يكشف عوالم غامرة ويصنع تجارب ألعاب لا تُنسى.',
    },
    logo: '/images/partners/buried-games-logo.png',
    website: 'https://buriedgames.com',
    socials: {},
  },
];

// Social media icons
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const WebsiteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

interface PartnersContentProps {
  locale: 'en' | 'ar';
}

export function PartnersContent({ locale }: PartnersContentProps) {
  const t = useTranslations('partnersPage');

  return (
    <main>
      {/* Hero Section */}
      <section className="partners-hero">
        <div className="partners-hero-bg">
          <Image
            src="/images/partners/partners-hero.png"
            alt="Luna Partners"
            fill
            priority
            className="partners-hero-bg-image"
          />
        </div>
        <div className="partners-hero-content">
          <h1 className="partners-hero-title">{t('title')}</h1>
          <p className="partners-hero-desc">{t('subtitle')}</p>
        </div>
      </section>

      {/* Partners Grid */}
      <section className="partners-section">
        <div className="wrap">
          <div className="partners-header">
            <h2 className="section-title">{t('meetPartners')}</h2>
            <p className="section-subtitle">{t('meetPartnersDesc')}</p>
          </div>

          <div className="partners-grid">
            {partners.map((partner) => (
              <div key={partner.id} className="partner-card">
                <div className="partner-logo-container">
                  <Image
                    src={partner.logo}
                    alt={`${partner.name} logo`}
                    width={120}
                    height={120}
                    className="partner-logo"
                  />
                </div>
                <div className="partner-info">
                  <h3 className="partner-name">{partner.name}</h3>
                  <span className="partner-type">{partner.type[locale]}</span>
                  <p className="partner-desc">{partner.description[locale]}</p>

                  <div className="partner-socials">
                    {partner.socials.instagram && (
                      <a
                        href={partner.socials.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-link"
                        aria-label="Instagram"
                      >
                        <InstagramIcon />
                      </a>
                    )}
                    {partner.socials.x && (
                      <a
                        href={partner.socials.x}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-link"
                        aria-label="X (Twitter)"
                      >
                        <XIcon />
                      </a>
                    )}
                    {partner.socials.tiktok && (
                      <a
                        href={partner.socials.tiktok}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-link"
                        aria-label="TikTok"
                      >
                        <TikTokIcon />
                      </a>
                    )}
                    {partner.socials.youtube && (
                      <a
                        href={partner.socials.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-link"
                        aria-label="YouTube"
                      >
                        <YouTubeIcon />
                      </a>
                    )}
                  </div>

                  {partner.website && (
                    <a
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="partner-website"
                    >
                      <WebsiteIcon />
                      {t('visitWebsite')}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="partners-cta-section">
        <div className="wrap">
          <div className="partners-cta-content">
            <h2 className="partners-cta-title">{t('ctaTitle')}</h2>
            <p className="partners-cta-desc">{t('ctaDesc')}</p>
            <a
              href="https://discord.gg/lunarian"
              target="_blank"
              rel="noopener noreferrer"
              className="partners-cta-btn"
            >
              <DiscordIcon />
              {t('ctaBtn')}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
