'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import Image from 'next/image';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { onBalanceUpdate } from '@/lib/balance-events';
import { NotificationBell } from '@/components/NotificationBell';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import LunariIcon from '@/components/LunariIcon';
import { E } from '@/components/edit-mode/EditableText';
import { EImg } from '@/components/edit-mode/EditableImage';

import { NavBrandMark } from '@/components/NavBrandMark';
import { lunaBrandMark } from '@/lib/luna-brand';
import { LunaWordmark } from '@/components/LunaWordmark';
import { guestSignInHref, localeNavigationHref, publicNavigationGroups, toggleDesktopGroup, type DesktopDisclosure, type NavigationGroup } from '@/lib/site-navigation';

function positionNavLight(nav: HTMLElement, clientX: number) {
  const box = nav.getBoundingClientRect();
  if (!box.width) return;
  const position = (clientX - box.left) / box.width * 100;
  const percent = Math.max(0, Math.min(100, position));
  nav.style.setProperty('--ribbon-light-x', `${percent}%`);
}

export function Navbar() {
  const t = useTranslations('nav');
  const brand = useTranslations('brand');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const [desktopGroup, setDesktopGroup] = useState<DesktopDisclosure>(null);
  const [mobileGroups, setMobileGroups] = useState<Partial<Record<NavigationGroup, boolean>>>({});
  const hoverDelay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [lunariBalance, setLunariBalance] = useState<number | null>(null);
  const { data: session, status } = useSession();
  const [closedTabs, setClosedTabs] = useState<Set<string>>(new Set());
  const isMM = !!session?.user?.isMastermind;
  const isClosed = (key: string) => closedTabs.has(key);
  const hideForViewer = (key: string) => isClosed(key) && !isMM;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/site-tabs/state', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.closed)) {
          setClosedTabs(new Set<string>(data.closed));
        }
      } catch {}
    };
    void load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const groups = publicNavigationGroups(closedTabs, isMM, FEATURE_FLAGS.marketplace);

  // Fetch Lunari balance when logged in
  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/bazaar/catalog');
      if (!res.ok) return;
      const data = await res.json();
      if (data.user?.balance != null) {
        setLunariBalance(data.user.balance);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (session?.user) fetchBalance();
  }, [session, fetchBalance]);

  // Listen for balance updates from bazaar purchases
  useEffect(() => {
    return onBalanceUpdate((balance) => setLunariBalance(balance));
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const drawer = drawerRef.current;
    const opener = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => {
      drawer?.querySelector<HTMLButtonElement>('.mobile-close-btn')?.focus({ preventScroll: true });
    });
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !drawer) return;
      const items = Array.from(drawer.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'))
        .filter(item => item.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Element && !event.target.closest('.games-dropdown-wrap')) setDesktopGroup(null);
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      if (hoverDelay.current) clearTimeout(hoverDelay.current);
    };
  }, []);

  const switchLocale = (newLocale: 'en' | 'ar') => {
    if (newLocale === locale) return;
    try { localStorage.setItem('luna-lang', newLocale); } catch {}
    router.replace(localeNavigationHref(pathname, window.location.search, window.location.hash), { locale: newLocale, scroll: false });
  };

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const [guestHref, setGuestHref] = useState(() => guestSignInHref(locale, '/' + locale + (pathname === '/' ? '' : pathname)));
  useEffect(() => {
    const sync = () => {
      const current = window.location;
      setGuestHref(guestSignInHref(locale, current.pathname + current.search + current.hash));
    };
    sync();
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    navigation?.addEventListener('currententrychange', sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      navigation?.removeEventListener('currententrychange', sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, [locale, pathname]);
  const updateGuestDestination = (event: React.SyntheticEvent<HTMLAnchorElement>) => {
    const { pathname, search, hash } = window.location;
    event.currentTarget.href = guestSignInHref(locale, pathname + search + hash);
  };
  const guestLink = {
    href: guestHref,
    onFocus: updateGuestDestination,
    onPointerDown: updateGuestDestination,
    onContextMenu: updateGuestDestination,
  };

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
        <nav className="navbar-island luna-ribbon-nav"
          onPointerMove={event => {
            if (event.pointerType !== 'touch') positionNavLight(event.currentTarget, event.clientX);
          }}
          onFocusCapture={event => {
            const target = event.target.getBoundingClientRect();
            positionNavLight(event.currentTarget, target.left + target.width / 2);
          }}>
          <div className="brand">
            <Link href="/" className="luna-wordmark-link" aria-label={locale === 'ar' ? 'لونا، الصفحة الرئيسية' : 'Luna home'}>
              <NavBrandMark />
              <LunaWordmark><E ns="brand" k="name">{brand('name')}</E></LunaWordmark>
            </Link>
          </div>

          <div className="nav">
            <span className="luna-nav-index" aria-hidden="true" />
            {!hideForViewer('home') && (
              <Link
                href="/"
                className={`nav-link ${isActive('/') && pathname === '/' ? 'active' : ''} ${isClosed('home') ? 'nav-link-closed' : ''}`}
                title={isClosed('home') ? 'Closed to public — Mastermind view' : undefined}
              >
                <E ns="nav" k="home">{t('home')}</E>
              </Link>
            )}

            {groups.map(group => {
              const expanded = desktopGroup?.group === group.key;
              const active = group.links.some(link => isActive(link.path));
              const menuId = 'luna-nav-' + group.key;
              return <div key={group.key} className="games-dropdown-wrap" data-nav-group={group.key}
                onPointerEnter={event => {
                  if (event.pointerType !== 'mouse') return;
                  if (hoverDelay.current) clearTimeout(hoverDelay.current);
                  setDesktopGroup(current => current?.group === group.key ? current : { group: group.key, pinned: false });
                }}
                onPointerLeave={event => {
                  if (event.pointerType !== 'mouse') return;
                  hoverDelay.current = setTimeout(() => {
                    setDesktopGroup(current => current?.group === group.key && !current.pinned ? null : current);
                  }, 160);
                }}
                onBlur={event => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setDesktopGroup(current => current?.group === group.key ? null : current);
                  }
                }}
                onKeyDown={event => {
                  const trigger = event.currentTarget.querySelector('button');
                  if (event.key === 'Escape' && expanded) {
                    event.preventDefault();
                    setDesktopGroup(null);
                    trigger?.focus();
                  } else if (event.key === 'ArrowDown' && event.target === trigger) {
                    event.preventDefault();
                    const wrapper = event.currentTarget;
                    setDesktopGroup({ group: group.key, pinned: true });
                    requestAnimationFrame(() => wrapper.querySelector('a')?.focus());
                  }
                }}>
                <button type="button" aria-expanded={expanded} aria-controls={expanded ? menuId : undefined}
                  className={`games-dropdown-trigger ${active ? 'active' : ''} ${isClosed(group.key) ? 'nav-link-closed' : ''}`}
                  onClick={() => setDesktopGroup(current => toggleDesktopGroup(current, group.key))}>
                  <E ns="nav" k={group.key}>{t(group.key)}</E><ChevronIcon open={expanded} />
                </button>
                {expanded && <div id={menuId} className="games-dropdown">
                  {group.links.map(link => <Link key={link.tab} href={link.path}
                    className={`games-dropdown-item ${isActive(link.path) ? 'active' : ''} ${isClosed(link.tab) ? 'nav-link-closed' : ''}`}
                    aria-current={isActive(link.path) ? 'page' : undefined} onClick={() => setDesktopGroup(null)}>
                    <E ns="nav" k={link.label}>{t(link.label)}</E>
                  </Link>)}
                </div>}
              </div>;
            })}
          </div>
          <style jsx>{`
            .nav-link-closed { opacity: 0.55; position: relative; }
            .nav-link-closed::after { content: '🔒'; font-size: 9px; margin-left: 6px; opacity: 0.85; }
          `}</style>

          <div className="actions-box">
            {/* Admin Dashboard Link - Desktop */}
            {session?.user?.isMastermind && (
              <a href="/admin" className="nav-link" style={{ fontSize: 13, gap: 6, display: 'flex', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                </svg>
                Dashboard
              </a>
            )}

            {/* Auth Section - Desktop */}
            <div className="auth-section">
              {status === 'loading' ? (
                <div className="auth-skeleton" />
              ) : session ? (
                <>
                {FEATURE_FLAGS.marketplace && <NotificationBell />}
                <Link href="/profile" className="user-btn-wrap">
                  <div className="user-btn">
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
                    <span className="user-info-col">
                      <span className="user-name">
                        {session.user?.globalName || session.user?.name || 'User'}
                      </span>
                      {lunariBalance !== null && (
                        <span className="user-lunari">
                          <LunariIcon size={10} />
                          {lunariBalance.toLocaleString()}
                        </span>
                      )}
                    </span>
                  </div>
                </Link>
                </>
              ) : (
                <a {...guestLink} className="btn-discord-login" onClick={updateGuestDestination}>
                  <DiscordIcon />
                  <E ns="nav" k="signIn">{t('signIn')}</E>
                </a>
              )}
            </div>

            <div className="lang-switcher">
              <button
                className={`lang-btn ${locale === 'ar' ? 'active' : ''}`}
                lang="ar" aria-pressed={locale === 'ar'}
                onClick={() => switchLocale('ar')}
              >
                AR
              </button>
              <button
                className={`lang-btn ${locale === 'en' ? 'active' : ''}`}
                lang="en" aria-pressed={locale === 'en'}
                onClick={() => switchLocale('en')}
              >
                EN
              </button>
            </div>

            <button
              className={`mobile-menu-btn ${mobileMenuOpen ? 'open' : ''}`}
              onClick={() => { setDesktopGroup(null); setMobileMenuOpen(!mobileMenuOpen); }}
              ref={menuButtonRef}
              aria-controls="luna-mobile-menu"
              aria-expanded={mobileMenuOpen}
              aria-label={locale === 'ar' ? 'فتح القائمة' : 'Open menu'}
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
      <aside ref={drawerRef} id="luna-mobile-menu" className={`mobile-sidebar luna-ribbon-drawer ${mobileMenuOpen ? 'open' : ''}`}
        role={mobileMenuOpen ? 'dialog' : undefined} aria-modal={mobileMenuOpen || undefined}
        inert={!mobileMenuOpen} aria-hidden={!mobileMenuOpen} aria-label={locale === 'ar' ? 'قائمة التنقل' : 'Site navigation'}>
        <div className="mobile-sidebar-header">
          <div className="brand">
            <Link href="/" className="luna-wordmark-link" onClick={closeMobileMenu} aria-label={locale === 'ar' ? 'لونا، الصفحة الرئيسية' : 'Luna home'}>
              <EImg
                editId="nav-mobile-brand-logo"
                src={lunaBrandMark}
                alt="Luna"
                width={36}
                height={36}
                className="brand-logo-img"
              />
              <LunaWordmark><E ns="brand" k="name">{brand('name')}</E></LunaWordmark>
            </Link>
          </div>
          <button className="mobile-close-btn" onClick={closeMobileMenu} aria-label={locale === 'ar' ? 'إغلاق القائمة' : 'Close menu'}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <nav className="mobile-nav">
          {!hideForViewer('home') && <Link href="/" aria-current={pathname === '/' ? 'page' : undefined}
            className={`mobile-nav-link ${pathname === '/' ? 'active' : ''}`} onClick={closeMobileMenu}>
            <E ns="nav" k="home">{t('home')}</E>
          </Link>}
          {groups.map(group => {
            const expanded = Boolean(mobileGroups[group.key]);
            const active = group.links.some(link => isActive(link.path));
            const menuId = 'luna-mobile-' + group.key;
            return <div key={group.key} data-nav-group={group.key} className="mobile-games-group">
              <button type="button" className={`mobile-games-trigger ${active ? 'active' : ''}`}
                aria-expanded={expanded} aria-controls={expanded ? menuId : undefined}
                onClick={() => setMobileGroups(current => ({ ...current, [group.key]: !current[group.key] }))}>
                <span><E ns="nav" k={group.key}>{t(group.key)}</E></span><ChevronIcon open={expanded} />
              </button>
              {expanded && <div id={menuId} className="mobile-games-sublinks">
                {group.links.map(link => <Link key={link.tab} href={link.path}
                  className={`mobile-nav-link ${isActive(link.path) ? 'active' : ''}`}
                  aria-current={isActive(link.path) ? 'page' : undefined} onClick={closeMobileMenu}>
                  <E ns="nav" k={link.label}>{t(link.label)}</E>
                </Link>)}
              </div>}
            </div>;
          })}
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
                  <E ns="nav" k="profile">{t('profile')}</E>
                </Link>
                {session.user?.isMastermind && (
                  <a
                    href="/admin"
                    className="mobile-nav-link"
                    onClick={closeMobileMenu}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                    </svg>
                    Dashboard
                  </a>
                )}
                <button
                  className="mobile-signout-btn"
                  onClick={() => { closeMobileMenu(); setShowSignOutModal(true); }}
                >
                  <E ns="nav" k="signOut">{t('signOut')}</E>
                </button>
              </>
            ) : (
              <a {...guestLink} className="mobile-discord-login"
                onClick={event => { updateGuestDestination(event); closeMobileMenu(); }}>
                <DiscordIcon />
                <E ns="nav" k="signIn">{t('signIn')}</E>
              </a>
            )}
          </div>

          <div className="lang-switcher">
            <button
              className={`lang-btn ${locale === 'ar' ? 'active' : ''}`}
                lang="ar" aria-pressed={locale === 'ar'}
              onClick={() => { switchLocale('ar'); closeMobileMenu(); }}
            >
              AR
            </button>
            <button
              className={`lang-btn ${locale === 'en' ? 'active' : ''}`}
                lang="en" aria-pressed={locale === 'en'}
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
            <h3 className="signout-modal-title"><E ns="nav" k="signOutConfirmTitle">{t('signOutConfirmTitle')}</E></h3>
            <p className="signout-modal-desc"><E ns="nav" k="signOutConfirmDesc">{t('signOutConfirmDesc')}</E></p>
            <div className="signout-modal-actions">
              <button
                className="signout-modal-cancel"
                onClick={() => setShowSignOutModal(false)}
              >
                <E ns="nav" k="cancel">{t('cancel')}</E>
              </button>
              <button
                className="signout-modal-confirm"
                onClick={async () => {
                  await signOut({ redirect: false });
                  window.location.href = '/';
                }}
              >
                <E ns="nav" k="signOut">{t('signOut')}</E>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
