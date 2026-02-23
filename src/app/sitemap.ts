import type { MetadataRoute } from 'next';

const BASE = 'https://lunarian.app';
const LOCALES = ['en', 'ar'] as const;

interface Page {
  path: string;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

const PAGES: Page[] = [
  // Core
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/story/', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/characters/', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/about/', changeFrequency: 'monthly', priority: 0.8 },

  // Games
  { path: '/luna-fantasy/', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/grand-fantasy/', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/bumper/', changeFrequency: 'monthly', priority: 0.7 },

  // Economy
  { path: '/bank/', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/bazaar/', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/marketplace/', changeFrequency: 'daily', priority: 0.7 },

  // Merchants
  { path: '/bazaar/kael/', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/bazaar/meluna/', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/bazaar/zoldar/', changeFrequency: 'monthly', priority: 0.6 },

  // Info
  { path: '/partners/', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/contact/', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/faq/', changeFrequency: 'monthly', priority: 0.5 },

  // Legal
  { path: '/terms/', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/privacy/', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/refund/', changeFrequency: 'yearly', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of PAGES) {
    for (const locale of LOCALES) {
      const languages: Record<string, string> = {};
      for (const alt of LOCALES) {
        languages[alt] = `${BASE}/${alt}${page.path}`;
      }
      // x-default points to English
      languages['x-default'] = `${BASE}/en${page.path}`;

      entries.push({
        url: `${BASE}/${locale}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: { languages },
      });
    }
  }

  return entries;
}
