'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import Image from 'next/image';
import { useEffect, useState, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export function Navbar() {
  const t = useTranslations('nav');
  const brand = useTranslations('brand');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [gamesDropdownOpen, setGamesDropdownOpen] = useState(false);
  const [mobileGamesOpen, setMobileGamesOpen] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const gamesDropdownRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();

  const gameRoutes = ['/luna-fantasy', '/grand-fantasy', '/bumper'];

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (gamesDropdownRef.current && !gamesDropdownRef.current.contains(e.target as Node)) {
        setGamesDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const switchLocale = (newLocale: 'en' | 'ar') => {
    localStorage.setItem('luna-lang', newLocale);
    router.replace(pathname, { locale: newLocale });
  };

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const isGamesActive = gameRoutes.some(route => pathname.startsWith(route));

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const DiscordIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );

  const ChevronIcon = ({ open }: { open: boolean }) => (
    <svg
      className={`nav-link-chevron ${open ? 'open' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );

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

            {/* Games Dropdown */}
            <div className="games-dropdown-wrap" ref={gamesDropdownRef}>
              <button
                className={`games-dropdown-trigger ${isGamesActive ? 'active' : ''}`}
                onClick={() => setGamesDropdownOpen(!gamesDropdownOpen)}
                onMouseEnter={() => setGamesDropdownOpen(true)}
              >
                {t('games')}
                <ChevronIcon open={gamesDropdownOpen} />
              </button>
              {gamesDropdownOpen && (
                <div
                  className="games-dropdown"
                  onMouseLeave={() => setGamesDropdownOpen(false)}
                >
                  <Link
                    href="/luna-fantasy"
                    className={`games-dropdown-item ${isActive('/luna-fantasy') ? 'active' : ''}`}
                    onClick={() => setGamesDropdownOpen(false)}
                  >
                    {t('lunaFantasy')}
                  </Link>
                  <Link
                    href="/grand-fantasy"
                    className={`games-dropdown-item ${isActive('/grand-fantasy') ? 'active' : ''}`}
                    onClick={() => setGamesDropdownOpen(false)}
                  >
                    {t('grandFantasy')}
                  </Link>
                  <Link
                    href="/bumper"
                    className={`games-dropdown-item ${isActive('/bumper') ? 'active' : ''}`}
                    onClick={() => setGamesDropdownOpen(false)}
                  >
                    {t('bumper')}
                  </Link>
                </div>
              )}
            </div>

            <Link href="/characters" className={`nav-link ${isActive('/characters') ? 'active' : ''}`}>
              {t('characters')}
            </Link>
            <Link href="/bank" className={`nav-link ${isActive('/bank') ? 'active' : ''}`}>
              {t('bank')}
            </Link>
            <Link href="/partners" className={`nav-link ${isActive('/partners') ? 'active' : ''}`}>
              {t('partners')}
            </Link>
          </div>

          <div className="actions-box">
            {/* Auth Section - Desktop */}
            <div className="auth-section">
              {status === 'loading' ? (
                <div className="auth-skeleton" />
              ) : session ? (
                <div className="user-btn-wrap" ref={dropdownRef}>
                  <button
                    className="user-btn"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    {session.user?.image ? (
                      <Image
                        src={session.user.image}
                        alt=""
                        width={28}
                        height={28}
                        className="user-avatar"
                      />
                    ) : (
                      <div className="user-avatar user-avatar-fallback">
                        {(session.user?.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="user-name">
                      {session.user?.globalName || session.user?.name || 'User'}
                    </span>
                  </button>
                  {dropdownOpen && (
                    <div className="user-dropdown">
                      <Link
                        href="/profile"
                        className="dropdown-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setDropdownOpen(false)}
                      >
                        {t('profile')}
                      </Link>
                      <div className="dropdown-divider" />
                      <button
                        className="dropdown-item dropdown-signout"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setDropdownOpen(false); setShowSignOutModal(true); }}
                      >
                        {t('signOut')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="btn-discord-login"
                  onClick={() => signIn('discord')}
                >
                  <DiscordIcon />
                  {t('signIn')}
                </button>
              )}
            </div>

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

          {/* Mobile Games Group */}
          <div className="mobile-games-group">
            <button
              className={`mobile-games-trigger ${isGamesActive ? 'active' : ''}`}
              onClick={() => setMobileGamesOpen(!mobileGamesOpen)}
            >
              <span>{t('games')}</span>
              <ChevronIcon open={mobileGamesOpen} />
            </button>
            {mobileGamesOpen && (
              <div className="mobile-games-sublinks">
                <Link
                  href="/luna-fantasy"
                  className={`mobile-nav-link ${isActive('/luna-fantasy') ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  {t('lunaFantasy')}
                </Link>
                <Link
                  href="/grand-fantasy"
                  className={`mobile-nav-link ${isActive('/grand-fantasy') ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  {t('grandFantasy')}
                </Link>
                <Link
                  href="/bumper"
                  className={`mobile-nav-link ${isActive('/bumper') ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  {t('bumper')}
                </Link>
              </div>
            )}
          </div>

          <Link href="/characters" className={`mobile-nav-link ${isActive('/characters') ? 'active' : ''}`} onClick={closeMobileMenu}>
            {t('characters')}
          </Link>
          <Link href="/bank" className={`mobile-nav-link ${isActive('/bank') ? 'active' : ''}`} onClick={closeMobileMenu}>
            {t('bank')}
          </Link>
          <Link href="/partners" className={`mobile-nav-link ${isActive('/partners') ? 'active' : ''}`} onClick={closeMobileMenu}>
            {t('partners')}
          </Link>
        </nav>

        <div className="mobile-sidebar-footer">
          {/* Mobile Auth Section */}
          <div className="mobile-auth-section">
            {status === 'loading' ? (
              <div className="auth-skeleton" style={{ width: '100%', height: 44 }} />
            ) : session ? (
              <>
                <div className="mobile-user-info">
                  {session.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt=""
                      width={32}
                      height={32}
                      className="user-avatar"
                    />
                  ) : (
                    <div className="user-avatar user-avatar-fallback" style={{ width: 32, height: 32, fontSize: '14px' }}>
                      {(session.user?.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="mobile-user-name">
                    {session.user?.globalName || session.user?.name || 'User'}
                  </span>
                </div>
                <Link
                  href="/profile"
                  className="mobile-nav-link"
                  onClick={closeMobileMenu}
                >
                  {t('profile')}
                </Link>
                <button
                  className="mobile-signout-btn"
                  onClick={() => { closeMobileMenu(); setShowSignOutModal(true); }}
                >
                  {t('signOut')}
                </button>
              </>
            ) : (
              <button
                className="mobile-discord-login"
                onClick={() => { signIn('discord'); closeMobileMenu(); }}
              >
                <DiscordIcon />
                {t('signIn')}
              </button>
            )}
          </div>

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

      {/* Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <div className="signout-modal-overlay" onClick={() => setShowSignOutModal(false)}>
          <div className="signout-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="signout-modal-title">{t('signOutConfirmTitle')}</h3>
            <p className="signout-modal-desc">{t('signOutConfirmDesc')}</p>
            <div className="signout-modal-actions">
              <button
                className="signout-modal-cancel"
                onClick={() => setShowSignOutModal(false)}
              >
                {t('cancel')}
              </button>
              <button
                className="signout-modal-confirm"
                onClick={async () => {
                  await signOut({ redirect: false });
                  window.location.href = '/';
                }}
              >
                {t('signOut')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
