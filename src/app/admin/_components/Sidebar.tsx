'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Icon from './Icon';
import { CLUSTERS } from './nav-config';
import RecentlyViewed from './RecentlyViewed';
import { useMobileNav } from './MobileNavProvider';

interface SidebarUser {
  name: string;
  image?: string;
}

const STORAGE_KEY = 'av-sidebar-state';

export default function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const { open: mobileOpen, setOpen: setMobileOpen } = useMobileNav();
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState('');
  // Default: all clusters start collapsed. The cluster containing the active
  // route auto-opens via the `hasActive` check below without flipping state,
  // so users only see the section relevant to where they are on first paint.
  // localStorage overrides persist any manual expand/collapse they do.
  const [openClusters, setOpenClusters] = useState<Record<string, boolean>>(
    () => Object.fromEntries(CLUSTERS.map((c) => [c.id, false]))
  );

  // Persist sidebar state across navigations
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.collapsed === 'boolean') setCollapsed(parsed.collapsed);
        if (parsed.openClusters) setOpenClusters(parsed.openClusters);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ collapsed, openClusters }));
    } catch { /* ignore */ }
  }, [collapsed, openClusters]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return CLUSTERS;
    const q = filter.toLowerCase();
    return CLUSTERS.map((c) => ({
      ...c,
      items: c.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((c) => c.items.length > 0);
  }, [filter]);

  return (
    <aside
      className="av-sidebar"
      data-collapsed={collapsed}
      data-mobile-open={mobileOpen ? 'true' : undefined}
      aria-label="Admin navigation"
    >
      <div className="av-sidebar-mobile-top">
        <Link href="/admin" className="av-sidebar-brand">
          <Image src="/images/logo.png" alt="" width={32} height={32} priority />
          <div>
            <div className="av-sidebar-brand-text">Luna</div>
            <div className="av-sidebar-brand-sub">Admin · v2</div>
          </div>
        </Link>
        <button
          type="button"
          className="av-sidebar-mobile-close"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          ×
        </button>
      </div>

      <div className="av-sidebar-filter">
        <input
          type="search"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter navigation"
        />
      </div>

      <nav className="av-sidebar-nav">
        {filtered.map((cluster) => {
          const open = openClusters[cluster.id] ?? false;
          const hasActive = cluster.items.some((i) =>
            i.href === pathname || (i.href !== '/admin' && pathname?.startsWith(i.href))
          );
          const showOpen = open || hasActive || Boolean(filter.trim());
          return (
            <div key={cluster.id} className="av-cluster" data-open={showOpen}>
              <button
                type="button"
                className="av-cluster-label"
                onClick={() => setOpenClusters((s) => ({ ...s, [cluster.id]: !open }))}
                aria-expanded={showOpen}
              >
                <span>{cluster.label}</span>
                <span className="av-cluster-count" aria-hidden="true">{cluster.items.length}</span>
                <Icon name="chevron" size={10} />
              </button>
              <div className="av-cluster-items">
                {cluster.items.map((item) => {
                  const active =
                    item.href === pathname ||
                    (item.href !== '/admin' && pathname?.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="av-nav-item"
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon name={item.icon} />
                      <span className="av-nav-item-label">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {!collapsed && <RecentlyViewed />}

      <div className="av-sidebar-footer">
        {user.image ? (
          <img src={user.image} alt="" />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,212,255,0.2)' }} />
        )}
        <div className="av-sidebar-footer-meta">
          <div className="av-sidebar-footer-name">{user.name}</div>
          <div className="av-sidebar-footer-role">Mastermind</div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={collapsed ? 'expand' : 'collapse'} size={14} />
        </button>
      </div>
    </aside>
  );
}
