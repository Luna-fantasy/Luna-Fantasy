import type { ReactNode } from 'react';

export type IconName =
  | 'overview' | 'audit' | 'users' | 'coins' | 'bank' | 'trending' | 'passport'
  | 'cards' | 'gem' | 'shop' | 'gamepad' | 'trophy' | 'terminal' | 'ticket' | 'app'
  | 'canvas' | 'image' | 'globe' | 'partners' | 'map'
  | 'megaphone' | 'mic' | 'sparkles' | 'log'
  | 'bot' | 'server' | 'rocket' | 'shield' | 'settings'
  | 'pulse' | 'bar-chart' | 'calendar' | 'bell' | 'mail' | 'flag' | 'sliders'
  | 'pencil'
  | 'collapse' | 'expand' | 'search' | 'chevron' | 'external';

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

export interface NavCluster {
  id: string;
  label: string;
  items: NavItem[];
}

export const CLUSTERS: NavCluster[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { label: 'Dashboard',  href: '/admin',           icon: 'overview' },
      { label: 'Activity',   href: '/admin/activity',  icon: 'pulse' },
      { label: 'Analytics',  href: '/admin/analytics', icon: 'bar-chart' },
      { label: 'Schedule',   href: '/admin/schedule',  icon: 'calendar' },
    ],
  },
  {
    id: 'players',
    label: 'Players',
    items: [
      { label: 'Users',      href: '/admin/users',     icon: 'users' },
      { label: 'Economy',    href: '/admin/economy',   icon: 'coins' },
      { label: 'Banking',    href: '/admin/banking',   icon: 'bank' },
      { label: 'Leveling',   href: '/admin/leveling',  icon: 'trending' },
      { label: 'Badges',     href: '/admin/badges',    icon: 'trophy' },
      { label: 'Passports',  href: '/admin/passports', icon: 'passport' },
      { label: 'Watchlist',  href: '/admin/watchlist', icon: 'shield' },
    ],
  },
  {
    id: 'items',
    label: 'Items',
    items: [
      { label: 'Cards',      href: '/admin/cards',     icon: 'cards' },
      { label: 'Stones',     href: '/admin/stones',    icon: 'gem' },
      { label: 'Shops',      href: '/admin/shops',     icon: 'shop' },
      { label: 'Vaelcroft',  href: '/admin/vaelcroft', icon: 'map' },
    ],
  },
  {
    id: 'engagement',
    label: 'Engagement',
    items: [
      { label: 'Games',         href: '/admin/games',         icon: 'gamepad' },
      { label: 'Challenges',    href: '/admin/challenges',    icon: 'flag' },
      { label: 'Commands',      href: '/admin/commands',      icon: 'terminal' },
      { label: 'Staff Inbox',   href: '/admin/inbox',         icon: 'ticket' },
      { label: 'Tickets',       href: '/admin/inbox?kind=ticket',      icon: 'ticket' },
      { label: 'Applications',  href: '/admin/inbox?kind=application', icon: 'app' },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    items: [
      { label: 'Media',          href: '/admin/media',         icon: 'canvas' },
      { label: 'Website',        href: '/admin/website',       icon: 'pencil' },
      { label: 'Info',           href: '/admin/info',          icon: 'globe' },
      { label: 'Notifications',  href: '/admin/notifications', icon: 'bell' },
      { label: 'Direct Messages', href: '/admin/dm',           icon: 'mail' },
    ],
  },
  {
    id: 'channels',
    label: 'Channels & Voice',
    items: [
      { label: 'Announce',  href: '/admin/announce',  icon: 'megaphone' },
      { label: 'Oracle',    href: '/admin/voice',     icon: 'mic' },
      { label: 'Sage AI',   href: '/admin/sage',      icon: 'sparkles' },
      { label: 'Logging',   href: '/admin/logging',   icon: 'log' },
    ],
  },
  {
    id: 'ops',
    label: 'Operations',
    items: [
      { label: 'Bots',       href: '/admin/ops',         icon: 'bot' },
      { label: 'Deploy',     href: '/admin/deploy',      icon: 'rocket' },
      { label: 'Settings',   href: '/admin/settings',    icon: 'settings' },
    ],
  },
];
