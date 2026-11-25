export function documentLocaleForPath(pathname: string | null) {
  return pathname?.split('/')[1] === 'ar'
    ? { lang: 'ar', dir: 'rtl' } as const
    : { lang: 'en', dir: 'ltr' } as const;
}
