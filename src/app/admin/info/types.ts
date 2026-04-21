export interface Partner {
  _id?: string;
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
    whatsapp?: string;
  };
  order: number;
}

export interface LunaMapMenuItem {
  label: string;
  label_en?: string;
  content: string;
  content_en?: string;
  image: string;
}

export interface LunaMapButton {
  name: string;
  name_en?: string;
  btnStyle: 1 | 2 | 3 | 4;
  emojiId: string;
  content?: string;
  content_en?: string;
  image?: string;
  menu?: LunaMapMenuItem[];
}

export interface LunaMapDoc {
  title: string;
  title_en?: string;
  description?: string;
  description_en?: string;
  image: string;
  buttons: LunaMapButton[];
}

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
  paymentIcons: Record<string, boolean>;
  legalLinks: LegalLink[];
  copyrightEn: string;
  copyrightAr: string;
  brandDescription: boolean;
}

export const BTN_STYLE_LABEL: Record<number, string> = {
  1: 'Primary (Blue)',
  2: 'Secondary (Grey)',
  3: 'Success (Green)',
  4: 'Danger (Red)',
};

export const BTN_STYLE_COLOR: Record<number, string> = {
  1: '#5865f2',
  2: '#4f545c',
  3: '#2d7d46',
  4: '#d83c3e',
};
