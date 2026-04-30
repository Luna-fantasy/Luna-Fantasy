export interface LocalizedString { en: string; ar: string }

export interface ValecroftFamilyMember {
  id: string;
  name: LocalizedString;
  role: LocalizedString;
  bio: LocalizedString;
  imageUrl: string;
}

export interface ValecroftHome {
  name: LocalizedString;
  description: LocalizedString;
  imageUrl: string;
  gallery: string[];
}

export interface ValecroftLore {
  home: ValecroftHome;
  family: ValecroftFamilyMember[];
}

export const EMPTY_LORE: ValecroftLore = {
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

function coerceFamilyMember(raw: any): ValecroftFamilyMember | null {
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

export function coerceLore(raw: any): ValecroftLore {
  const homeRaw = raw?.home ?? {};
  const gallery = Array.isArray(homeRaw.gallery)
    ? homeRaw.gallery.filter((s: unknown): s is string => typeof s === 'string')
    : [];
  const family: ValecroftFamilyMember[] = Array.isArray(raw?.family)
    ? raw.family
        .map((m: any) => coerceFamilyMember(m))
        .filter((m: ValecroftFamilyMember | null): m is ValecroftFamilyMember => m !== null)
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
