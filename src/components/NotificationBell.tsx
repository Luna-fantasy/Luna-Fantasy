'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/routing';
import type { UserNotification } from '@/types/marketplace';
import LunariIcon from '@/components/LunariIcon';

const POLL_INTERVAL = 30_000; // 30 seconds

export function NotificationBell() {
  const t = useTranslations('notifications');
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isMarketplacePage = pathname.startsWith('/marketplace');

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {}
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Poll on marketplace pages
  useEffect(() => {
    if (!isMarketplacePage) return;
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isMarketplacePage, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpen = async () => {
    setOpen(!open);
    if (!open && unreadCount > 0) {
      // Mark all as read
      setLoading(true);
      try {
        await fetch('/api/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      } catch {}
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'outbid':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        );
      case 'auction_won':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#51cf66" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case 'auction_expired':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffd43b" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      case 'card_sold':
        return (
          <LunariIcon size={16} />
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        );
    }
  };

  const getNotificationText = (notif: UserNotification) => {
    switch (notif.type) {
      case 'outbid':
        return t('outbid', {
          card: notif.data.cardName || '',
          amount: notif.data.amount?.toLocaleString() || '0',
        });
      case 'auction_won':
        return t('auctionWon', {
          card: notif.data.cardName || '',
          amount: notif.data.amount?.toLocaleString() || '0',
        });
      case 'auction_expired':
        return t('auctionExpired', { card: notif.data.cardName || '' });
      case 'card_sold':
        return t('cardSold', {
          card: notif.data.cardName || '',
          amount: notif.data.amount?.toLocaleString() || '0',
          buyer: notif.data.actorName || '',
        });
      case 'swap_received':
        return t('swapReceived', { actor: notif.data.actorName || '' });
      default:
        return '';
    }
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return t('justNow');
    if (diffMin < 60) return t('minutesAgo', { count: diffMin });
    if (diffHr < 24) return t('hoursAgo', { count: diffHr });
    return t('daysAgo', { count: diffDay });
  };

  return (
    <div className="notification-bell-wrap" ref={dropdownRef}>
      <button className="notification-bell-btn" onClick={handleOpen} aria-label="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-bell-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <span className="notification-dropdown-title">{t('title')}</span>
          </div>

          {loading ? (
            <div className="notification-dropdown-loading">
              <div className="skeleton" style={{ width: '100%', height: 48, borderRadius: 8 }} />
              <div className="skeleton" style={{ width: '100%', height: 48, borderRadius: 8 }} />
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-dropdown-empty">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span>{t('empty')}</span>
            </div>
          ) : (
            <div className="notification-dropdown-list">
              {notifications.map((notif) => (
                <div
                  key={notif._id || notif.notificationId}
                  className={`notification-item ${!notif.read ? 'notification-unread' : ''}`}
                >
                  <div className="notification-item-icon">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="notification-item-content">
                    <span className="notification-item-text">{getNotificationText(notif)}</span>
                    <span className="notification-item-time">{formatTime(notif.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
