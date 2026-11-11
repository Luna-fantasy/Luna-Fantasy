type MediaRoleSettings = { image_gen_roles?: string[]; gif_gen_roles?: string[] | null };

export function getGifRoles(settings: MediaRoleSettings): string[] {
  return settings.gif_gen_roles ?? settings.image_gen_roles ?? [];
}

export function isSageMediaRoleList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 100
    && value.every(role => typeof role === 'string' && /^\d{15,22}$/.test(role));
}
