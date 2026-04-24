export interface LocalizedString { en: string; ar: string }

export interface VaelcroftFamilyMember {
  id: string;
  name: LocalizedString;
  role: LocalizedString;
  bio: LocalizedString;
  imageUrl: string;
}

export interface VaelcroftHome {
  name: LocalizedString;
  description: LocalizedString;
  imageUrl: string;
  gallery: string[];
}

export interface VaelcroftLore {
  home: VaelcroftHome;
  family: VaelcroftFamilyMember[];
}

export const EMPTY_LORE: VaelcroftLore = {
  home: {
    name: { en: '', ar: '' },
    description: { en: '', ar: '' },
    imageUrl: '',
    gallery: [],
  },
  family: [],
};

function coerceLocalized(raw: any): LocalizedString {
  return {
    en: typeof raw?.en === 'string' ? raw.en : '',
    ar: typeof raw?.ar === 'string' ? raw.ar : '',
  };
}

function coerceFamilyMember(raw: any): VaelcroftFamilyMember | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return null;
  return {
    id,
    name: coerceLocalized(raw.name),
    role: coerceLocalized(raw.role),
    bio: coerceLocalized(raw.bio),
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : '',
  };
}

export function coerceLore(raw: any): VaelcroftLore {
  const homeRaw = raw?.home ?? {};
  const gallery = Array.isArray(homeRaw.gallery)
    ? homeRaw.gallery.filter((s: unknown): s is string => typeof s === 'string')
    : [];
  const family: VaelcroftFamilyMember[] = Array.isArray(raw?.family)
    ? raw.family
        .map((m: any) => coerceFamilyMember(m))
        .filter((m: VaelcroftFamilyMember | null): m is VaelcroftFamilyMember => m !== null)
    : [];
  return {
    home: {
      name: coerceLocalized(homeRaw.name),
      description: coerceLocalized(homeRaw.description),
      imageUrl: typeof homeRaw.imageUrl === 'string' ? homeRaw.imageUrl : '',
      gallery,
    },
    family,
  };
}
