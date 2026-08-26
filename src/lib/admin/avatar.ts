// Discord avatar URL builder that tolerates both storage conventions found in
// the shared "Database" cluster: the website cron writes bare avatar hashes
// into discord_users.avatar, while some bot-side writers store the full CDN
// URL in the same field. Prepending the CDN prefix onto an already-full URL
// produced broken doubled links (cdn.../avatars/<id>/https://cdn...) all over
// the dashboard — always build avatar URLs through this helper.
export function discordAvatarUrl(
  discordId: string | number,
  avatar: string | null | undefined,
  size: number = 64,
): string | null {
  if (!avatar) return null;
  if (/^https?:\/\//i.test(avatar)) return avatar;
  const ext = avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${ext}?size=${size}`;
}
