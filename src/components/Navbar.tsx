'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import Image from 'next/image';
import { useEffect, useState } from 'react';

export function Navbar() {
  const t = useTranslations('nav');
  const brand = useTranslations('brand');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const switchLocale = (newLocale: 'en' | 'ar') => {
    localStorage.setItem('luna-lang', newLocale);
    router.replace(pathname, { locale: newLocale });
  };

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <div className={`topbar ${scrolled ? 'scrolled' : ''}`}>
      <nav className="navbar-island">
        <div className="brand">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image
              src="/images/logo.png"
              alt="Luna"
              width={40}
              height={40}
              className="brand-logo-img"
            />
            <span>{brand('name')}</span>
          </Link>
        </div>

        <div className="nav">
          <Link href="/" className={`nav-link ${isActive('/') && pathname === '/' ? 'active' : ''}`}>
            {t('home')}
          </Link>
          <Link href="/story" className={`nav-link ${isActive('/story') ? 'active' : ''}`}>
            {t('story')}
          </Link>
          <Link href="/cards" className={`nav-link ${isActive('/cards') ? 'active' : ''}`}>
            {t('cards')}
          </Link>
          <Link href="/characters" className={`nav-link ${isActive('/characters') ? 'active' : ''}`}>
            {t('characters')}
          </Link>
        </div>

        <div className="actions-box">
          <div className="lang-switcher">
            <button
              className={`lang-btn ${locale === 'ar' ? 'active' : ''}`}
              onClick={() => switchLocale('ar')}
            >
              AR
            </button>
            <button
              className={`lang-btn ${locale === 'en' ? 'active' : ''}`}
              onClick={() => switchLocale('en')}
            >
              EN
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
