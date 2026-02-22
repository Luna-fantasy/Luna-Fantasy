'use client';

import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useGameData } from '@/hooks/useGameData';
import type { UserCard, UserStone, CardsByGame, CatalogCard } from '@/types/gameData';
import CardBook from './CardBook';
import CardDetailModal from '@/components/CardDetailModal';
import type { CardDetailData } from '@/components/CardDetailModal';
import '@/styles/profile.css';
import '@/styles/profile-game.css';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  metadata: Record<string, any>;
  createdAt: string;
}

type GameKey = keyof CardsByGame;

const GAME_TABS: { key: GameKey; labelKey: string; gameFilter?: string }[] = [
  { key: 'lunaFantasy', labelKey: 'collection.lunaFantasy', gameFilter: 'luna_fantasy' },
  { key: 'grandFantasy', labelKey: 'collection.grandFantasy', gameFilter: 'grand_fantasy' },
  { key: 'bumper', labelKey: 'collection.bumper', gameFilter: 'bumper' },
];

function xpForLevel(level: number): number {
  return level * level * 100;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

interface ProfileContentProps {
  viewingDiscordId?: string;
}

export default function ProfileContent({ viewingDiscordId }: ProfileContentProps) {
  const { data: session } = useSession();
  const t = useTranslations('profilePage');
  const isPublicView = !!viewingDiscordId;
  const { data: gameData, isLoading } = useGameData(viewingDiscordId || null);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeGame, setActiveGame] = useState<GameKey>('lunaFantasy');
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardDetailData | null>(null);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txPage, setTxPage] = useState(0);
  const TX_PER_PAGE = 5;

  const fetchTransactions = useCallback(async () => {
    if (isPublicView) { setTxLoading(false); return; }
    try {
      const res = await fetch('/api/profile/transactions');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch {}
    setTxLoading(false);
  }, [isPublicView]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // For public view, use publicUser info from the API; for own profile, use session
  const publicUser = gameData?.publicUser;

  if (!isPublicView && !session?.user) return null;

  const user = isPublicView ? null : session!.user;
  const displayName = isPublicView
    ? (publicUser?.name || viewingDiscordId!)
    : (user!.globalName || user!.name || 'Luna User');
  const username = isPublicView
    ? (publicUser?.name || viewingDiscordId!)
    : (user!.username || user!.email?.split('@')[0] || 'user');
  const avatarUrl = isPublicView ? publicUser?.image : user!.image;
  const profileDiscordId = isPublicView ? viewingDiscordId! : user!.discordId;

  const memberSince = new Date().toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const copyDiscordId = async () => {
    if (!profileDiscordId) return;
    await navigator.clipboard.writeText(profileDiscordId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImageError = (id: string) => {
    setBrokenImages(prev => new Set(prev).add(id));
  };

  // Pick effective game
  const effectiveGame = activeGame;
  const effectiveCards = gameData?.cardsByGame[effectiveGame] ?? [];

  // Filter catalog cards by active game tab
  const activeGameFilter = GAME_TABS.find(tab => tab.key === effectiveGame)?.gameFilter;
  const filteredCatalog: CatalogCard[] = (gameData?.cardCatalog ?? []).filter(c =>
    !activeGameFilter || !c.game || c.game === activeGameFilter
  );

  // Level XP
  const currentLevel = gameData?.level?.level ?? 0;
  const currentXp = gameData?.level?.xp ?? 0;
  const xpNeeded = xpForLevel(currentLevel + 1);
  const xpPercent = xpNeeded > 0 ? Math.min((currentXp / xpNeeded) * 100, 100) : 0;

  // PvP
  const pvpTotal = (gameData?.pvp.wins ?? 0) + (gameData?.pvp.losses ?? 0);
  const winRate = pvpTotal > 0 ? Math.round(((gameData?.pvp.wins ?? 0) / pvpTotal) * 100) : 0;

  return (
    <div className="profile-page">
      <div className="profile-container">

        {/* Header Card — Banner + Avatar + Identity */}
        <div className="profile-card profile-header-card">
          <div className="profile-banner">
            <div className="profile-banner-glow" />
            <div className="profile-banner-pattern" />
          </div>

          <div className="profile-avatar-section">
            <div className="profile-avatar-ring">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  width={88}
                  height={88}
                  className="profile-avatar"
                />
              ) : (
                <div className="profile-avatar profile-avatar-fallback">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="profile-status-dot" />
            </div>
          </div>

          <div className="profile-identity">
            {gameData?.level && (
              <div className="profile-level-badge">
                Lv.{gameData.level.level}
              </div>
            )}
            <h1 className="profile-name">{displayName}</h1>
            <p className="profile-meta">
              <span className="profile-username">@{username}</span>
              <span className="profile-meta-dot">·</span>
              <span className="profile-date">{t('memberSince')} {memberSince}</span>
            </p>
          </div>

          {/* Treasury — inside hero */}
          <div className="hero-treasury">
            <div className="treasury-row">
              <div className="treasury-item treasury-item-lunari">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <div className="treasury-item-info">
                  <span className="treasury-item-value treasury-lunari-value">
                    {isLoading ? <span className="skeleton" style={{ width: '60px', height: '20px' }} /> : formatNumber(gameData?.lunari ?? 0)}
                  </span>
                  <span className="treasury-item-label">{t('treasury.lunari')}</span>
                </div>
              </div>

              {!isPublicView && (gameData?.tickets ?? 0) > 0 && (
                <div className="treasury-item treasury-item-tickets">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
                    <path d="M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4V9z" />
                  </svg>
                  <div className="treasury-item-info">
                    <span className="treasury-item-value treasury-tickets-value">
                      {formatNumber(gameData?.tickets ?? 0)}
                    </span>
                    <span className="treasury-item-label">{t('treasury.tickets')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Card Collection Section */}
        <div className="profile-card profile-collection-card">
          <h2 className="profile-section-title">{t('collection.title')}</h2>

          {/* Game Tabs */}
          <div className="game-tabs">
            {GAME_TABS.map(tab => (
              <button
                key={tab.key}
                className={`game-tab ${effectiveGame === tab.key ? 'active' : ''}`}
                onClick={() => setActiveGame(tab.key)}
              >
                {t(tab.labelKey)}
                <span className="game-tab-count">
                  {isLoading ? '-' : (gameData?.cardsByGame[tab.key]?.length ?? 0)}
                </span>
              </button>
            ))}
          </div>

          {/* Card Book */}
          <CardBook
            ownedCards={effectiveCards}
            catalogCards={filteredCatalog}
            isLoading={isLoading}
            onCardClick={(card) => setSelectedCard(card)}
            brokenImages={brokenImages}
            onImageError={handleImageError}
          />
        </div>

        {/* Moon Stone Collection Section */}
        <StoneCollection
          stones={gameData?.stones ?? []}
          isLoading={isLoading}
          onStoneClick={(src, caption) => setLightbox({ src, caption })}
        />

        {/* Activity Today Section — only show for own profile when there's activity */}
        {!isPublicView && !isLoading && ((gameData?.chatActivity?.messagesToday ?? 0) > 0 || (gameData?.chatActivity?.voiceMinutesToday ?? 0) > 0) && (
          <div className="profile-card profile-activity-card">
            <h2 className="profile-section-title">{t('activity.title')}</h2>
            <div className="activity-grid">
              <div className="activity-item activity-messages">
                <div className="activity-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="activity-info">
                  <span className="activity-value">
                    {formatNumber(gameData?.chatActivity?.messagesToday ?? 0)}
                  </span>
                  <span className="activity-label">{t('activity.messagesToday')}</span>
                </div>
              </div>
              <div className="activity-item activity-voice">
                <div className="activity-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </div>
                <div className="activity-info">
                  <span className="activity-value">
                    {formatNumber(gameData?.chatActivity?.voiceMinutesToday ?? 0)}
                  </span>
                  <span className="activity-label">{t('activity.voiceToday')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inventory Section — only show for own profile when user has items */}
        {!isPublicView && !isLoading && (gameData?.inventory.length ?? 0) > 0 && (
          <div className="profile-card profile-inventory-card">
            <h2 className="profile-section-title">{t('inventory.title')}</h2>
            <div className="inventory-grid">
              {gameData!.inventory.map((item, idx) => (
                <div key={item.id || idx} className="inventory-item">
                  <div className="inventory-item-header">
                    <span className="inventory-item-name">{item.name}</span>
                    <span className="inventory-item-price">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      {formatNumber(item.price)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="inventory-item-desc">{item.description}</p>
                  )}
                  <span className="inventory-item-date">
                    {new Date(item.purchaseDate).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Level Orb ── */}
        <div className="profile-card stats-orb-card">
          <div className="stats-orb-wrap">
            {/* SVG ring arc showing XP progress */}
            <svg className="stats-orb-ring" viewBox="0 0 120 120">
              <circle className="stats-orb-track" cx="60" cy="60" r="54" />
              <circle
                className="stats-orb-progress"
                cx="60" cy="60" r="54"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={isLoading ? 2 * Math.PI * 54 : 2 * Math.PI * 54 * (1 - xpPercent / 100)}
              />
            </svg>
            <div className="stats-orb-glow" />
            <div className="stats-orb-inner">
              <span className="stats-orb-level">
                {isLoading ? '--' : currentLevel}
              </span>
              <span className="stats-orb-label">{t('playerStats.level')}</span>
            </div>
          </div>
          <div className="stats-orb-xp">
            {isLoading
              ? <span className="skeleton" style={{ width: '140px', height: '14px' }} />
              : <>{formatNumber(currentXp)} <span className="stats-orb-xp-sep">/</span> {formatNumber(xpNeeded)} <span className="stats-orb-xp-unit">{t('playerStats.xp')}</span></>
            }
          </div>
          <div className="stats-orb-meta">
            <div className="stats-orb-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="stats-orb-meta-val">
                {isLoading ? '—' : formatNumber(gameData?.level?.messages ?? 0)}
              </span>
              <span className="stats-orb-meta-label">{t('playerStats.messages')}</span>
            </div>
            <div className="stats-orb-meta-divider" />
            <div className="stats-orb-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span className="stats-orb-meta-val">
                {isLoading ? '—' : `${Math.round((gameData?.level?.voiceTime ?? 0) / 3600)}h`}
              </span>
              <span className="stats-orb-meta-label">{t('playerStats.voiceTime')}</span>
            </div>
          </div>
        </div>

        {/* ── Game Wins ── */}
        <div className="profile-card stats-wins-card">
          <h2 className="profile-section-title">{t('playerStats.gameWins')}</h2>
          <div className="wins-grid">
            {([
              { key: 'magic_cards', label: t('playerStats.magicCards'), color: '#00d4ff', icon: <><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M8 7h8M8 12h8" /></> },
              { key: 'luna_pairs', label: t('playerStats.lunaPairs'), color: '#8b5cf6', icon: <><rect x="1" y="3" width="9" height="13" rx="1" /><rect x="14" y="3" width="9" height="13" rx="1" /></> },
              { key: 'grand_fantasy', label: t('playerStats.grandFantasy'), color: '#ffd700', icon: <polygon points="12 2 15 9 22 9 17 14 19 22 12 17 5 22 7 14 2 9 9 9" /> },
              { key: 'magic_bot', label: t('playerStats.magicBot'), color: '#4ade80', icon: <><rect x="3" y="4" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><circle cx="15" cy="10" r="1.5" /><path d="M9 14h6" /></> },
            ] as const).map((g) => {
              const count = (gameData?.gameWins as any)?.[g.key] ?? 0;
              return (
                <div key={g.key} className="wins-tile" style={{ '--tile-color': g.color } as React.CSSProperties}>
                  <div className="wins-tile-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={g.color} strokeWidth="2">{g.icon}</svg>
                  </div>
                  <span className="wins-tile-count">
                    {isLoading ? <span className="skeleton" style={{ width: '28px', height: '22px' }} /> : count}
                  </span>
                  <span className="wins-tile-label">{g.label}</span>
                  <div className="wins-tile-glow" />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── PvP Arena ── */}
        <div className="profile-card stats-pvp-card">
          <h2 className="profile-section-title">{t('playerStats.pvp')}</h2>
          {isLoading ? (
            <div className="skeleton" style={{ width: '200px', height: '24px', margin: '0 auto' }} />
          ) : pvpTotal === 0 ? (
            <div className="pvp-empty">{t('playerStats.noBattles')}</div>
          ) : (
            <div className="pvp-arena">
              {/* Win-rate ring */}
              <div className="pvp-ring-wrap">
                <svg className="pvp-ring" viewBox="0 0 100 100">
                  <circle className="pvp-ring-track" cx="50" cy="50" r="42" />
                  <circle
                    className="pvp-ring-fill"
                    cx="50" cy="50" r="42"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={2 * Math.PI * 42 * (1 - winRate / 100)}
                  />
                </svg>
                <div className="pvp-ring-center">
                  <span className="pvp-ring-pct">{winRate}%</span>
                  <span className="pvp-ring-label">{t('playerStats.winRate')}</span>
                </div>
              </div>
              {/* W / L counters */}
              <div className="pvp-counters">
                <div className="pvp-counter pvp-counter-win">
                  <span className="pvp-counter-val">{gameData?.pvp.wins ?? 0}</span>
                  <span className="pvp-counter-label">{t('playerStats.pvpWins')}</span>
                </div>
                <div className="pvp-counter-divider">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2">
                    <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
                  </svg>
                </div>
                <div className="pvp-counter pvp-counter-loss">
                  <span className="pvp-counter-val">{gameData?.pvp.losses ?? 0}</span>
                  <span className="pvp-counter-label">{t('playerStats.pvpLosses')}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Transaction History — own profile only */}
        {!isPublicView && !txLoading && transactions.length > 0 && (() => {
          const totalPages = Math.ceil(transactions.length / TX_PER_PAGE);
          const paged = transactions.slice(txPage * TX_PER_PAGE, (txPage + 1) * TX_PER_PAGE);
          return (
            <div className="profile-card transaction-history-card">
              <div className="transaction-header">
                <h2 className="transaction-header-title">{t('transactions.title')}</h2>
                <span className="transaction-header-count">{transactions.length}</span>
              </div>
              <div className="transactions-list">
                {paged.map((tx) => {
                  const isCredit = tx.amount > 0;
                  return (
                    <div key={tx.id} className={`transaction-item ${isCredit ? 'transaction-credit' : 'transaction-debit'}`}>
                      <div className="transaction-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {isCredit ? (
                            <><polyline points="7 17 17 7" /><polyline points="7 7 17 7 17 17" /></>
                          ) : (
                            <><polyline points="17 7 7 17" /><polyline points="17 17 7 17 7 7" /></>
                          )}
                        </svg>
                      </div>
                      <div className="transaction-info">
                        <span className="transaction-type">
                          {t(`transactions.${tx.type}` as any)}
                        </span>
                        {tx.metadata?.itemReceived && (
                          <span className="transaction-meta">{tx.metadata.itemReceived}</span>
                        )}
                      </div>
                      <div className="transaction-right">
                        <span className="transaction-amount">
                          <svg className="transaction-lunari-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                          {isCredit ? '+' : ''}{formatNumber(tx.amount)}
                        </span>
                        <span className="transaction-date">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className="transaction-pagination">
                  <button
                    className="transaction-page-btn"
                    disabled={txPage === 0}
                    onClick={() => setTxPage(txPage - 1)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <span className="transaction-page-info">
                    {txPage + 1} / {totalPages}
                  </span>
                  <button
                    className="transaction-page-btn"
                    disabled={txPage >= totalPages - 1}
                    onClick={() => setTxPage(txPage + 1)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Discord ID Card — shown on public profiles */}
        {isPublicView && (
          <div className="profile-card profile-details-card">
            <div className="profile-details">
              <div
                className="profile-detail-row profile-detail-copyable"
                onClick={copyDiscordId}
                title={t('clickToCopy')}
              >
                <div className="profile-detail-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                </div>
                <span className="profile-detail-label">{t('discordId')}</span>
                <span className="profile-detail-value">
                  {profileDiscordId}
                  <span className="profile-copy-hint">
                    {copied ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Account Details Card — own profile only */}
        {!isPublicView && (
          <div className="profile-card profile-details-card">
            <h2 className="profile-section-title">{t('accountDetails')}</h2>

            <div className="profile-details">
              <div
                className={`profile-detail-row ${profileDiscordId ? 'profile-detail-copyable' : ''}`}
                onClick={copyDiscordId}
                title={profileDiscordId ? t('clickToCopy') : undefined}
              >
                <div className="profile-detail-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                </div>
                <span className="profile-detail-label">{t('discordId')}</span>
                <span className="profile-detail-value">
                  {profileDiscordId || '—'}
                  {profileDiscordId && (
                    <span className="profile-copy-hint">
                      {copied ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </span>
                  )}
                </span>
              </div>

              <div className="profile-detail-row">
                <div className="profile-detail-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M22 4l-10 8L2 4" />
                  </svg>
                </div>
                <span className="profile-detail-label">{t('email')}</span>
                <span className="profile-detail-value">{user?.email || '—'}</span>
              </div>

              <div className="profile-detail-row">
                <div className="profile-detail-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </div>
                <span className="profile-detail-label">{t('authMethod')}</span>
                <span className="profile-detail-value">
                  <span className="profile-auth-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    Discord
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Sign Out Card — own profile only */}
        {!isPublicView && (
          <div className="profile-card profile-actions-card">
            <button
              className="profile-signout-btn"
              onClick={() => setShowSignOutModal(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {t('signOut')}
            </button>
          </div>
        )}

      </div>

      {/* Sign Out Confirmation Modal — own profile only */}
      {!isPublicView && showSignOutModal && (
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

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {/* Lightbox (for stones) */}
      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.src} alt={lightbox.caption} />
            <div className="lightbox-caption">{lightbox.caption}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Stone name lists (must match LunaJester config) ── */
const MOON_STONE_NAMES = [
  'Lunar Stone', 'Silver Beach Gem', 'Wishmaster Broken Cube', "Dragon's Tear",
  'Solar Stone', 'Galaxy Stone', 'Stone of Wisdom', 'Astral Prism',
  'Eternal Stone', 'Mastermind Stone', 'Luna Moon Stone', 'Moonbound Emerald',
];

const FORBIDDEN_STONE_NAMES = ['Chaos Pearl', "Shuran's Heart", 'Halo Core'];

const FORBIDDEN_HINTS: Record<string, string> = {
  'Chaos Pearl': 'hintChaos',
  "Shuran's Heart": 'hintShuran',
  'Halo Core': 'hintHalo',
};

const STONE_IMAGE_FALLBACK: Record<string, string> = {
  'Lunar Stone': 'https://assets.lunarian.app/stones/lunar_stone.png',
  'Silver Beach Gem': 'https://assets.lunarian.app/stones/silver_beach_gem.png',
  'Wishmaster Broken Cube': 'https://assets.lunarian.app/stones/wishmaster_broken_cube.png',
  "Dragon's Tear": 'https://assets.lunarian.app/stones/dragon_s_tear.png',
  'Solar Stone': 'https://assets.lunarian.app/stones/solar_stone.png',
  'Galaxy Stone': 'https://assets.lunarian.app/stones/galaxy_stone.png',
  'Stone of Wisdom': 'https://assets.lunarian.app/stones/stone_of_wisdom.png',
  'Astral Prism': 'https://assets.lunarian.app/stones/astral_prism.png',
  'Eternal Stone': 'https://assets.lunarian.app/stones/eternal_stone.png',
  'Mastermind Stone': 'https://assets.lunarian.app/stones/mastermind_stone.png',
  'Luna Moon Stone': 'https://assets.lunarian.app/stones/luna_moon_stone.png',
  'Moonbound Emerald': 'https://assets.lunarian.app/stones/moonbound_emerald.png',
  'Chaos Pearl': 'https://assets.lunarian.app/stones/chaos_pearl.png',
  "Shuran's Heart": 'https://assets.lunarian.app/stones/shuran_heart.png',
  'Halo Core': 'https://assets.lunarian.app/stones/halo_core.png',
};

function StoneCollection({
  stones,
  isLoading,
  onStoneClick,
}: {
  stones: UserStone[];
  isLoading: boolean;
  onStoneClick: (src: string, caption: string) => void;
}) {
  const t = useTranslations('profilePage');

  const { ownedMoonNames, ownedForbiddenNames, moonStones, forbiddenStones } = useMemo(() => {
    const ownedMap = new Map<string, UserStone>();
    for (const s of stones) {
      if (!ownedMap.has(s.name)) ownedMap.set(s.name, s);
    }
    const ownedMoonNames = new Set(MOON_STONE_NAMES.filter(n => ownedMap.has(n)));
    const ownedForbiddenNames = new Set(FORBIDDEN_STONE_NAMES.filter(n => ownedMap.has(n)));

    const moonStones = MOON_STONE_NAMES.map(name => ({
      name,
      owned: ownedMap.has(name),
      data: ownedMap.get(name),
    }));
    const forbiddenStones = FORBIDDEN_STONE_NAMES.map(name => ({
      name,
      owned: ownedMap.has(name),
      data: ownedMap.get(name),
    }));

    return { ownedMoonNames, ownedForbiddenNames, moonStones, forbiddenStones };
  }, [stones]);

  const moonCount = ownedMoonNames.size;
  const forbiddenCount = ownedForbiddenNames.size;
  const moonPercent = Math.round((moonCount / 12) * 100);
  const forbiddenPercent = Math.round((forbiddenCount / 3) * 100);

  // Tier calculation
  const isZenith = moonCount === 12;
  const isChosen = isZenith && forbiddenCount === 3;
  const tierKey = isChosen ? 'tierChosen' : isZenith ? 'tierZenith' : 'tierNone';
  const tierClass = isChosen ? 'tier-chosen' : isZenith ? 'tier-zenith' : 'tier-none';

  if (isLoading) {
    return (
      <div className="profile-card profile-stones-card">
        <h2 className="profile-section-title">{t('stones.title')}</h2>
        <div className="skeleton" style={{ width: '100%', height: '200px', borderRadius: '12px' }} />
      </div>
    );
  }

  return (
    <div className="profile-card profile-stones-card">
      {/* Header with title + tier badge */}
      <div className="stones-header">
        <h2 className="profile-section-title">{t('stones.title')}</h2>
        <span className={`stones-tier-badge ${tierClass}`}>
          {t(`stones.${tierKey}`)}
        </span>
      </div>

      {/* How to collect info */}
      <p className="stones-collect-info">
        {t('stones.collectBefore')}{' '}
        <Link href="/bazaar/meluna" className="stones-collect-link">{t('stones.collectMelunaLink')}</Link>
        {' '}{t('stones.collectMiddle')}{' '}
        <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer" className="stones-collect-link">{t('stones.collectDiscordLink')}</a>.
      </p>

      {/* Moon Stones */}
      <div className="stones-section">
        <div className="stones-section-header">
          <span className="stones-section-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
            </svg>
            {t('stones.moonStones')}
          </span>
          <span className="stones-section-count">{moonCount} / 12</span>
        </div>
        <div className="stones-progress-bar">
          <div className="stones-progress-fill stones-progress-moon" style={{ width: `${moonPercent}%` }} />
        </div>
        <div className="stones-grid">
          {moonStones.map((stone) => {
            const imgUrl = stone.data?.imageUrl || STONE_IMAGE_FALLBACK[stone.name];
            return (
            <div
              key={stone.name}
              className={`stone-card ${stone.owned ? 'stone-card-owned' : 'stone-card-locked'}`}
              onClick={() => {
                if (stone.owned && imgUrl) {
                  onStoneClick(imgUrl, stone.name);
                }
              }}
            >
              <div className="stone-image-wrap">
                {stone.owned && imgUrl ? (
                  <img src={imgUrl} alt={stone.name} />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}
              </div>
              <span className="stone-name">{stone.name}</span>
            </div>
            );
          })}
        </div>
      </div>

      {/* Forbidden Stones */}
      <div className="stones-section stones-section-forbidden">
        <div className="stones-section-header">
          <span className="stones-section-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <polygon points="12 2 15 9 22 9 17 14 19 22 12 17 5 22 7 14 2 9 9 9" />
            </svg>
            {t('stones.forbiddenStones')}
          </span>
          <span className="stones-section-count">{forbiddenCount} / 3</span>
        </div>
        <div className="stones-progress-bar">
          <div className="stones-progress-fill stones-progress-forbidden" style={{ width: `${forbiddenPercent}%` }} />
        </div>
        <div className="stones-grid stones-grid-forbidden">
          {forbiddenStones.map((stone) => {
            const imgUrl = stone.data?.imageUrl || STONE_IMAGE_FALLBACK[stone.name];
            return (
            <div
              key={stone.name}
              className={`stone-card stone-card-forbidden ${stone.owned ? 'stone-card-owned' : 'stone-card-locked'}`}
              onClick={() => {
                if (stone.owned && imgUrl) {
                  onStoneClick(imgUrl, stone.name);
                }
              }}
            >
              <div className="stone-image-wrap stone-image-forbidden">
                {stone.owned && imgUrl ? (
                  <img src={imgUrl} alt={stone.name} />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}
              </div>
              <span className="stone-name">{stone.name}</span>
              {!stone.owned && (
                <span className="stone-hint">{t(`stones.${FORBIDDEN_HINTS[stone.name]}`)}</span>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
