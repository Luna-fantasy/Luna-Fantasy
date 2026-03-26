import clientPromise from '@/lib/mongodb';

export interface FooterLink {
  labelEn: string;
  labelAr: string;
  href: string;
  external: boolean;
}

export interface FooterColumn {
  id: string;
  titleEn: string;
  titleAr: string;
  visible: boolean;
  links: FooterLink[];
}

export interface SocialLink {
  platform: string;
  url: string;
  visible: boolean;
}

export interface LegalLink {
  key: string;
  labelEn: string;
  labelAr: string;
  href: string;
  visible: boolean;
}

export interface FooterConfig {
  columns: FooterColumn[];
  socialLinks: SocialLink[];
  paymentIcons: { visa: boolean; mastercard: boolean; paypal: boolean };
  legalLinks: LegalLink[];
  copyrightEn: string;
  copyrightAr: string;
  brandDescription: boolean;
}

export const FOOTER_DEFAULTS: FooterConfig = {
  columns: [
    {
      id: 'explore',
      titleEn: 'Explore',
      titleAr: 'استكشف',
      visible: true,
      links: [
        { labelEn: 'Home', labelAr: 'الرئيسية', href: '/', external: false },
        { labelEn: 'Story', labelAr: 'القصة', href: '/story', external: false },
        { labelEn: 'Characters', labelAr: 'الشخصيات', href: '/characters', external: false },
        { labelEn: 'Partners', labelAr: 'الشركاء', href: '/partners', external: false },
        { labelEn: 'Members', labelAr: 'الأعضاء', href: '/members', external: false },
        { labelEn: 'Bank', labelAr: 'البنك', href: '/bank', external: false },
      ],
    },
    {
      id: 'games',
      titleEn: 'Games',
      titleAr: 'الألعاب',
      visible: true,
      links: [
        { labelEn: 'Luna Fantasy', labelAr: 'لونا فانتسي', href: '/luna-fantasy', external: false },
        { labelEn: 'Grand Fantasy', labelAr: 'جراند فانتسي', href: '/grand-fantasy', external: false },
        { labelEn: 'Faction War', labelAr: 'حرب الفصائل', href: '/faction-war', external: false },
      ],
    },
    {
      id: 'merchants',
      titleEn: 'Merchants',
      titleAr: 'التجار',
      visible: true,
      links: [
        { labelEn: 'Kael Vandar', labelAr: 'كايل فاندر', href: '/bazaar/kael', external: false },
        { labelEn: 'Meluna', labelAr: 'ميلونا', href: '/bazaar/meluna', external: false },
        { labelEn: 'Zoldar', labelAr: 'زولدار', href: '/bazaar/zoldar', external: false },
      ],
    },
    {
      id: 'community',
      titleEn: 'Community',
      titleAr: 'المجتمع',
      visible: true,
      links: [
        { labelEn: 'Discord', labelAr: 'ديسكورد', href: 'https://discord.gg/lunarian', external: true },
        { labelEn: 'Instagram', labelAr: 'انستقرام', href: 'https://www.instagram.com/lunarian.app', external: true },
        { labelEn: 'TikTok', labelAr: 'تيك توك', href: 'https://www.tiktok.com/@lunarian.app', external: true },
      ],
    },
  ],
  socialLinks: [
    { platform: 'discord', url: 'https://discord.gg/lunarian', visible: true },
    { platform: 'instagram', url: 'https://www.instagram.com/lunarian.app', visible: true },
    { platform: 'tiktok', url: 'https://www.tiktok.com/@lunarian.app', visible: true },
  ],
  paymentIcons: { visa: true, mastercard: true, paypal: true },
  legalLinks: [
    { key: 'terms', labelEn: 'Terms', labelAr: 'الشروط', href: '/terms', visible: true },
    { key: 'privacy', labelEn: 'Privacy', labelAr: 'الخصوصية', href: '/privacy', visible: true },
    { key: 'refund', labelEn: 'Refund Policy', labelAr: 'سياسة الاسترداد', href: '/refund', visible: true },
    { key: 'faq', labelEn: 'FAQ', labelAr: 'الأسئلة الشائعة', href: '/faq', visible: true },
    { key: 'contact', labelEn: 'Contact Us', labelAr: 'تواصل معنا', href: '/contact', visible: true },
    { key: 'about', labelEn: 'About Us', labelAr: 'من نحن', href: '/about', visible: true },
  ],
  copyrightEn: '© 2026 Luna',
  copyrightAr: '© 2026 لونا',
  brandDescription: true,
};

// 60s server-side cache
let cachedConfig: FooterConfig | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000;

export async function getFooterConfig(): Promise<FooterConfig> {
  const now = Date.now();
  if (cachedConfig && now - cacheTime < CACHE_TTL) return cachedConfig;

  try {
    const client = await clientPromise;
    const doc = await client.db('Database').collection('bot_config').findOne({ _id: 'footer_config' as any });
    if (doc?.config) {
      cachedConfig = doc.config as FooterConfig;
      cacheTime = now;
      return cachedConfig;
    }
  } catch (err) {
    console.error('[Footer] Config fetch error:', err);
  }

  cachedConfig = FOOTER_DEFAULTS;
  cacheTime = now;
  return FOOTER_DEFAULTS;
}

export function invalidateFooterCache(): void {
  cachedConfig = null;
  cacheTime = 0;
}
