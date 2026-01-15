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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const switchLocale = (newLocale: 'en' | 'ar') => {
    localStorage.setItem('luna-lang', newLocale);
    router.replace(pathname, { locale: newLocale });
  };

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
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
            <Link href="/bank" className={`nav-link ${isActive('/bank') ? 'active' : ''}`}>
              {t('bank')}
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

            <button
              className={`mobile-menu-btn ${mobileMenuOpen ? 'open' : ''}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Sidebar */}
      <div className={`mobile-sidebar-overlay ${mobileMenuOpen ? 'open' : ''}`} onClick={closeMobileMenu}></div>
      <aside className={`mobile-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-sidebar-header">
          <div className="brand">
            <Image
              src="/images/logo.png"
              alt="Luna"
              width={36}
              height={36}
              className="brand-logo-img"
            />
            <span>{brand('name')}</span>
          </div>
          <button className="mobile-close-btn" onClick={closeMobileMenu} aria-label="Close menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <nav className="mobile-nav">
          <Link href="/" className={`mobile-nav-link ${isActive('/') && pathname === '/' ? 'active' : ''}`} onClick={closeMobileMenu}>
            {t('home')}
          </Link>
          <Link href="/story" className={`mobile-nav-link ${isActive('/story') ? 'active' : ''}`} onClick={closeMobileMenu}>
            {t('story')}
          </Link>
          <Link href="/cards" className={`mobile-nav-link ${isActive('/cards') ? 'active' : ''}`} onClick={closeMobileMenu}>
            {t('cards')}
          </Link>
          <Link href="/characters" className={`mobile-nav-link ${isActive('/characters') ? 'active' : ''}`} onClick={closeMobileMenu}>
            {t('characters')}
          </Link>
          <Link href="/bank" className={`mobile-nav-link ${isActive('/bank') ? 'active' : ''}`} onClick={closeMobileMenu}>
            {t('bank')}
          </Link>
        </nav>

        <div className="mobile-sidebar-footer">
          <div className="lang-switcher">
            <button
              className={`lang-btn ${locale === 'ar' ? 'active' : ''}`}
              onClick={() => { switchLocale('ar'); closeMobileMenu(); }}
            >
              AR
            </button>
            <button
              className={`lang-btn ${locale === 'en' ? 'active' : ''}`}
              onClick={() => { switchLocale('en'); closeMobileMenu(); }}
            >
              EN
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
