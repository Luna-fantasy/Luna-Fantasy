'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import StatusDot from './StatusDot';

interface AdminSidebarProps {
  user: {
    username?: string;
    globalName?: string;
    image?: string;
  };
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  disabled?: boolean;
  statusDot?: boolean;
}

const navItems: { section: string; items: NavItem[] }[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin', icon: 'grid' },
      { label: 'Audit Log', href: '/admin/audit', icon: 'shield' },
    ],
  },
  {
    section: 'Management',
    items: [
      { label: 'Users', href: '/admin/users', icon: 'users' },
      { label: 'Economy', href: '/admin/economy', icon: 'coins' },
      { label: 'Leveling', href: '/admin/leveling', icon: 'trending' },
      { label: 'Banking', href: '/admin/banking', icon: 'bank' },
      { label: 'Cards', href: '/admin/cards', icon: 'layers' },
      { label: 'Stones', href: '/admin/stones', icon: 'gem' },
      { label: 'Games', href: '/admin/games', icon: 'gamepad' },
      { label: 'Commands', href: '/admin/commands', icon: 'terminal' },
      { label: 'Shops', href: '/admin/shops', icon: 'box' },
      { label: 'Luna Map', href: '/admin/luna-map', icon: 'map' },
      { label: 'Shop Items', href: '/admin/vendors', icon: 'store' },
      { label: 'Tickets', href: '/admin/tickets', icon: 'shield' },
      { label: 'Applications', href: '/admin/applications', icon: 'users' },
    ],
  },
  {
    section: 'Bot Management',
    items: [
      { label: 'Bots', href: '/admin/bots', icon: 'bot' },
      { label: 'Luna Sage', href: '/admin/sage', icon: 'bot' },
    ],
  },
  {
    section: 'Voice',
    items: [
      { label: 'Voice', href: '/admin/voice', icon: 'mic' },
    ],
  },
  {
    section: 'Content',
    items: [
      { label: 'Announce', href: '/admin/announce', icon: 'megaphone' },
      { label: 'Canvas Editor', href: '/admin/canvas-editor', icon: 'image' },
      { label: 'Assets (R2)', href: '/admin/assets', icon: 'image' },
      { label: 'Website', href: '/admin/content', icon: 'globe' },
      { label: 'Partners', href: '/admin/partners', icon: 'users' },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Settings', href: '/admin/settings', icon: 'settings' },
      { label: 'Server', href: '/admin/server', icon: 'server', statusDot: true },
      { label: 'Deploy', href: '/admin/deploy', icon: 'rocket' },
    ],
  },
];

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    grid: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    shield: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    users: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    coins: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" /><path d="M12 6v12" /><path d="M8 10h8" /><path d="M8 14h8" />
      </svg>
    ),
    trending: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
    bank: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" /><path d="M3 10h18" /><path d="M12 3l9 7H3l9-7z" />
        <path d="M5 10v11" /><path d="M19 10v11" /><path d="M9 10v11" /><path d="M14 10v11" />
      </svg>
    ),
    layers: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
    gem: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="6 3 18 3 22 9 12 22 2 9" /><line x1="2" y1="9" x2="22" y2="9" />
        <line x1="12" y1="22" x2="6" y2="9" /><line x1="12" y1="22" x2="18" y2="9" />
      </svg>
    ),
    map: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
    ),
    store: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    box: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8V21H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" />
      </svg>
    ),
    image: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
      </svg>
    ),
    globe: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    server: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
    settings: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    terminal: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    gamepad: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="12" x2="10" y2="12" /><line x1="8" y1="10" x2="8" y2="14" />
        <line x1="15" y1="13" x2="15.01" y2="13" /><line x1="18" y1="11" x2="18.01" y2="11" />
        <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.544-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.152A4 4 0 0 0 17.32 5z" />
      </svg>
    ),
    megaphone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l18-5v12L3 13v-2z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    ),
    rocket: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    ),
    bot: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8.01" y2="16" />
        <line x1="16" y1="16" x2="16.01" y2="16" />
      </svg>
    ),
    mic: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
    external: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    ),
  };
  return icons[name] ?? null;
}

export default function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAgent() {
      try {
        const res = await fetch('/api/admin/server/health');
        setAgentOnline(res.ok);
      } catch {
        setAgentOnline(false);
      }
    }
    checkAgent();
    const interval = setInterval(checkAgent, 30000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  const handleNavKeyDown = (e: React.KeyboardEvent) => {
    const links = Array.from(e.currentTarget.querySelectorAll('.admin-nav-link:not([style*="pointer-events"])')) as HTMLElement[];
    const idx = links.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); links[(idx + 1) % links.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); links[(idx - 1 + links.length) % links.length]?.focus(); }
  };

  return (
    <>
      <button
        className="admin-mobile-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? '\u2715' : '\u2630'}
      </button>
      <aside className={`admin-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <Link href="/" className="admin-sidebar-logo" style={{ textDecoration: 'none', color: 'inherit' }}>Luna</Link>
          <div className="admin-sidebar-subtitle">Admin Dashboard</div>
        </div>

        <nav className="admin-sidebar-nav" role="navigation" aria-label="Admin navigation" onKeyDown={handleNavKeyDown}>
          {navItems.map((group) => (
            <div key={group.section}>
              <div className="admin-nav-section">{group.section}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.disabled ? '#' : item.href}
                  className={`admin-nav-link ${isActive(item.href) ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
                  onClick={() => setMobileOpen(false)}
                  style={item.disabled ? { opacity: 0.35, pointerEvents: 'none' } : undefined}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                  {item.statusDot && agentOnline !== null && (
                    <StatusDot
                      color={agentOnline ? 'green' : 'red'}
                      pulse={agentOnline}
                      title={agentOnline ? 'VPS Agent Connected' : 'VPS Agent Offline'}
                    />
                  )}
                  {item.disabled && (
                    <span className="admin-nav-badge">Soon</span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-back">
          <a href="/" className="admin-nav-link">
            <NavIcon name="external" />
            <span>Back to Website</span>
          </a>
        </div>

        <div className="admin-sidebar-footer">
          {user.image && (
            <img src={user.image} alt="" className="admin-sidebar-avatar" />
          )}
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-username">
              {user.globalName || user.username || 'Mastermind'}
            </div>
            <div className="admin-sidebar-role">Mastermind</div>
          </div>
        </div>
      </aside>
    </>
  );
}
