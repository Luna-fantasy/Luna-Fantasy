'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LABELS: Record<string, string> = {
  admin: 'Admin',
  audit: 'Audit Log',
  users: 'Users',
  economy: 'Economy',
  transactions: 'Transactions',
  leveling: 'Leveling',
  banking: 'Banking',
  cards: 'Cards',
  stones: 'Stones',
  games: 'Games',
  shops: 'Shops',
  vendors: 'Vendors',
  bots: 'Bots',
  sage: 'Luna Sage',
  announce: 'Announce',
  assets: 'Assets (R2)',
  content: 'Website',
  tickets: 'Tickets',
  applications: 'Applications',
  settings: 'Settings',
  server: 'Server',
  deploy: 'Deploy',
  config: 'Config',
  butler: 'Butler',
  jester: 'Jester',
};

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const label = LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    const isLast = i === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav className="admin-breadcrumbs">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {i > 0 && <span className="admin-breadcrumb-separator">/</span>}
          {crumb.isLast ? (
            <span className="admin-breadcrumb-item active">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="admin-breadcrumb-item">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
