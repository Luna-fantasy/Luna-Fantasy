export function discordOAuthCredentials(env: Readonly<Record<string, string | undefined>>) {
  const clientId = env.AUTH_DISCORD_ID?.trim();
  const clientSecret = env.AUTH_DISCORD_SECRET?.trim();
  if (!clientId || !/^\d{17,20}$/.test(clientId) || !clientSecret || /^(?:undefined|null)$/i.test(clientSecret)) {
    return null;
  }
  return { clientId, clientSecret };
}

export function guestSignInDestination(returnPath: string, locale: string): string {
  const home = locale === 'ar' ? '/ar/' : '/en/';
  const url = new URL(returnPath, 'http://luna.invalid');
  if (/^\/(?:ar\/|en\/)?(?:admin|marketplace|api)(?:\/|$)/.test(url.pathname)) return home;
  if (/^\/(?:ar\/|en\/)?profile\/?$/.test(url.pathname) && !/^\d{17,20}$/.test(url.searchParams.get('discordId') || '')) return home;
  return returnPath;
}

export function signInReturnPath(raw: string | undefined, locale: string, siteUrl?: string): string {
  const home = locale === 'ar' ? '/ar/' : '/en/';
  if (!raw || raw.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(raw)) return home;

  try {
    const origin = new URL(siteUrl || 'http://luna.invalid').origin;
    const url = new URL(raw, origin);
    if ((!raw.startsWith('/') && !siteUrl) || !/^(?:https?):$/.test(url.protocol) || url.origin !== origin) return home;
    if (url.pathname.startsWith('//') || /^\/(?:api\/auth|(?:ar\/|en\/)?auth\/signin)(?:\/|$)/i.test(url.pathname)) return home;
    return url.pathname + url.search + url.hash;
  } catch {
    return home;
  }
}
