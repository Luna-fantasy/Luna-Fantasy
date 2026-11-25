export const PASSPORT_COSMETIC_PATHS = {
  portrait: 'categories.passport.image',
  vip: 'passport_vip_roles',
  mastermind: 'passport_staff_roles.mastermind',
  sentinel: 'passport_staff_roles.sentinel',
  guardian: 'passport_staff_roles.guardian',
} as const;

export type PassportStaffTier = 'mastermind' | 'sentinel' | 'guardian';
export interface PassportCosmetics {
  passport_vip_roles: string[];
  passport_staff_roles: Record<PassportStaffTier, string[]>;
  merchantPhotoUrl: string;
}

type CosmeticPatch = Partial<Record<PassportStaffTier | 'vip', string[]>> & { portrait?: string };
export const DEFAULT_PASSPORT_MERCHANT = 'https://assets.lunarian.app/butler/vendors/VaelorStorm.png';

export function changedPassportCosmetics(saved: PassportCosmetics, draft: PassportCosmetics): CosmeticPatch {
  const changes: CosmeticPatch = {};
  const portrait = draft.merchantPhotoUrl.trim() || DEFAULT_PASSPORT_MERCHANT;
  if (portrait !== (saved.merchantPhotoUrl.trim() || DEFAULT_PASSPORT_MERCHANT)) changes.portrait = portrait;
  const different = (a: string[], b: string[]) => a.length !== b.length || a.some((v, i) => v !== b[i]);
  if (different(saved.passport_vip_roles, draft.passport_vip_roles)) changes.vip = draft.passport_vip_roles;
  for (const tier of ['mastermind', 'sentinel', 'guardian'] as const) {
    if (different(saved.passport_staff_roles[tier], draft.passport_staff_roles[tier])) {
      changes[tier] = draft.passport_staff_roles[tier];
    }
  }
  return changes;
}
