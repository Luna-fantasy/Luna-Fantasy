export interface Partner {
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
