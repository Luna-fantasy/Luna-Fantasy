'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import ThemePicker from './ThemePicker';
import PresencePill from './PresencePill';
import type { ThemeState } from './theme-cookie';
import { useCmdK } from './CmdKProvider';
import { useTimezone } from './TimezoneProvider';
import { useMobileNav } from './MobileNavProvider';

const LABELS: Record<string, string> = {
  v2: 'Dashboard',
  ops: 'Operations',
  audit: 'Audit Log',
  users: 'Users',
  economy: 'Economy',
  leveling: 'Leveling',
  passports: 'Passports',
  cards: 'Cards',
  stones: 'Stones',
  shops: 'Shops',
  games: 'Games',
  challenges: 'Challenges',
  commands: 'Commands',
  tickets: 'Tickets',
  applications: 'Applications',
  canvas: 'Canvas Editor',
  assets: 'Assets',
  website: 'Website',
  partners: 'Partners',
  'luna-map': 'Luna Map',
  announce: 'Announce',
  voice: 'Voice',
  sage: 'Sage AI',
  logging: 'Logging',
  settings: 'Settings',
};

export default function Topbar({
  initialTheme,
  self,
}: {
  initialTheme: ThemeState;
  self: { id: string; name: string };
}) {
  const pathname = usePathname() || '';
  const segments = pathname.split('/').filter(Boolean);
  // segments: ['admin', 'v2', ...rest]
  const tail = segments.slice(2); // strip 'admin', 'v2'

  const [agentStatus, setAgentStatus] = useState<'ok' | 'warn' | 'err' | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/server/health', { cache: 'no-store' })
      .then((r) => !cancelled && setAgentStatus(r.ok ? 'ok' : 'warn'))
      .catch(() => !cancelled && setAgentStatus('err'));
    return () => { cancelled = true; };
  }, [pathname]);

  const crumbs = [
    { label: 'Admin', href: '/admin' },
    ...tail.map((seg, i) => {
      const href = '/admin/' + tail.slice(0, i + 1).join('/');
      return { label: LABELS[seg] || seg.replace(/-/g, ' '), href };
    }),
  ];

  return (
    <header className="av-topbar">
      <MobileNavToggle />
      <nav className="av-topbar-breadcrumb" aria-label="Breadcrumb">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={c.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span className="av-topbar-breadcrumb-sep">/</span>}
              {last ? (
                <span aria-current="page">{c.label}</span>
              ) : (
                <Link href={c.href}>{c.label}</Link>
              )}
            </span>
          );
        })}
      </nav>

      <div className="av-topbar-actions">
        <CmdKButton />
        <TzPill />
        <ThemePicker initialState={initialTheme} />
        <Link href="/admin/audit" className="av-topbar-pill" title="Audit log">
          <Icon name="audit" size={12} />
          <span>Audit</span>
        </Link>
        <PresencePill room="admin-v2-global" self={self} />
        <span
          className="av-topbar-pill"
          data-status={agentStatus ?? undefined}
          title={
            agentStatus === 'ok' ? 'VPS agent online' :
            agentStatus === 'warn' ? 'VPS agent degraded' :
            agentStatus === 'err' ? 'VPS agent unreachable' :
            'Checking VPS agent…'
          }
        >
          <span className="av-pulse" />
          <span>{agentStatus === 'ok' ? 'Live' : agentStatus === 'warn' ? 'Degraded' : agentStatus === 'err' ? 'Down' : '…'}</span>
        </span>
        <Link href="/admin/website" className="av-topbar-pill av-topbar-pill--edit" title="Edit the live website inline">
          <Icon name="pencil" size={12} />
          <span>Edit site</span>
        </Link>
        <Link href="/" className="av-topbar-pill" title="Back to website">
          <Icon name="external" size={12} />
          <span>Site</span>
        </Link>
      </div>
    </header>
  );
}

function CmdKButton() {
  const { openCmdK } = useCmdK();
  return (
    <button type="button" className="av-cmdk-btn" onClick={openCmdK} title="Command menu (⌘K)">
      <Icon name="search" size={12} />
      <span>Search</span>
      <kbd>⌘K</kbd>
    </button>
  );
}

function MobileNavToggle() {
  const { open, toggle } = useMobileNav();
  return (
    <button
      type="button"
      className="av-mobile-nav-toggle"
      onClick={toggle}
      aria-label={open ? 'Close navigation' : 'Open navigation'}
      aria-expanded={open}
    >
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </button>
  );
}

function TzPill() {
  const { tz, cycle, label } = useTimezone();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <button
      type="button"
      className="av-tz-pill"
      onClick={cycle}
      title={`Timezone: ${label} — click to cycle`}
      data-tz={tz}
    >
      <span aria-hidden="true">◷</span>
      <span>{mounted ? label : 'Local'}</span>
    </button>
  );
}
