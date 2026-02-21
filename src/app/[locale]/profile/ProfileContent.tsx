'use client';

import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState, useMemo } from 'react';
import { useGameData } from '@/hooks/useGameData';
import type { UserCard, UserStone, CardsByGame, CatalogCard } from '@/types/gameData';
import CardBook from './CardBook';
import '@/styles/profile.css';
import '@/styles/profile-game.css';

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

export default function ProfileContent() {
  const { data: session } = useSession();
  const t = useTranslations('profilePage');
  const { data: gameData, isLoading } = useGameData();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeGame, setActiveGame] = useState<GameKey>('lunaFantasy');
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  if (!session?.user) return null;

  const user = session.user;
  const displayName = user.globalName || user.name || 'Luna User';
  const username = user.username || user.email?.split('@')[0] || 'user';
  const memberSince = new Date().toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const copyDiscordId = async () => {
    if (!user.discordId) return;
    await navigator.clipboard.writeText(user.discordId);
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
              {user.image ? (
                <Image
                  src={user.image}
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
            onCardClick={(src, caption) => setLightbox({ src, caption })}
            brokenImages={brokenImages}
            onImageError={handleImageError}
          />
        </div>

        {/* Treasury Section */}
        <div className="profile-card profile-treasury-card">
          <h2 className="profile-section-title">{t('treasury.title')}</h2>
          <div className="treasury-row">
            {/* Lunari */}
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

            {/* Game Tickets — only show when user has tickets */}
            {(gameData?.tickets ?? 0) > 0 && (
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

        {/* Moon Stone Collection Section */}
        <StoneCollection
          stones={gameData?.stones ?? []}
          isLoading={isLoading}
          onStoneClick={(src, caption) => setLightbox({ src, caption })}
        />

        {/* Activity Today Section — only show when there's activity */}
        {!isLoading && ((gameData?.chatActivity?.messagesToday ?? 0) > 0 || (gameData?.chatActivity?.voiceMinutesToday ?? 0) > 0) && (
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

        {/* Inventory Section — only show when user has items */}
        {!isLoading && (gameData?.inventory.length ?? 0) > 0 && (
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

        {/* Player Stats Section */}
        <div className="profile-card profile-stats-card">
          <h2 className="profile-section-title">{t('playerStats.title')}</h2>

          {/* Level + XP */}
          <div className="stats-level-section">
            <div className="stats-level-row">
              <div className="stats-level-number">
                {isLoading ? <span className="skeleton" style={{ width: '48px', height: '36px' }} /> : currentLevel}
              </div>
              <div className="stats-level-label">{t('playerStats.level')}</div>
            </div>

            <div className="xp-progress-wrap">
              <div className="xp-progress-bar">
                <div className="xp-progress-fill" style={{ width: isLoading ? '0%' : `${xpPercent}%` }} />
              </div>
              <div className="xp-progress-text">
                {isLoading
                  ? <span className="skeleton" style={{ width: '120px', height: '14px' }} />
                  : `${formatNumber(currentXp)} / ${formatNumber(xpNeeded)} ${t('playerStats.xp')}`
                }
              </div>
            </div>

            <div className="stats-meta">
              <div className="stats-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {isLoading
                  ? <span className="skeleton" style={{ width: '60px', height: '14px' }} />
                  : `${formatNumber(gameData?.level?.messages ?? 0)} ${t('playerStats.messages')}`
                }
              </div>
              <div className="stats-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
                {isLoading
                  ? <span className="skeleton" style={{ width: '60px', height: '14px' }} />
                  : `${Math.round((gameData?.level?.voiceTime ?? 0) / 3600)}h ${t('playerStats.voiceTime')}`
                }
              </div>
            </div>
          </div>

          <div className="stats-divider" />

          {/* Game Wins */}
          <div className="stats-game-wins">
            <div className="stats-subtitle">{t('playerStats.gameWins')}</div>
            <div className="game-wins-grid">
              <div className="game-win-item">
                <div className="game-win-icon magic-cards">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="18" rx="2" />
                    <path d="M8 7h8M8 12h8" />
                  </svg>
                </div>
                <div className="game-win-info">
                  <span className="game-win-count">
                    {isLoading ? <span className="skeleton" style={{ width: '24px', height: '18px' }} /> : (gameData?.gameWins?.magic_cards ?? 0)}
                  </span>
                  <span className="game-win-label">{t('playerStats.magicCards')}</span>
                </div>
              </div>
              <div className="game-win-item">
                <div className="game-win-icon luna-pairs">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2">
                    <rect x="1" y="3" width="9" height="13" rx="1" />
                    <rect x="14" y="3" width="9" height="13" rx="1" />
                  </svg>
                </div>
                <div className="game-win-info">
                  <span className="game-win-count">
                    {isLoading ? <span className="skeleton" style={{ width: '24px', height: '18px' }} /> : (gameData?.gameWins?.luna_pairs ?? 0)}
                  </span>
                  <span className="game-win-label">{t('playerStats.lunaPairs')}</span>
                </div>
              </div>
              <div className="game-win-item">
                <div className="game-win-icon grand-fantasy">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-legendary)" strokeWidth="2">
                    <polygon points="12 2 15 9 22 9 17 14 19 22 12 17 5 22 7 14 2 9 9 9" />
                  </svg>
                </div>
                <div className="game-win-info">
                  <span className="game-win-count">
                    {isLoading ? <span className="skeleton" style={{ width: '24px', height: '18px' }} /> : (gameData?.gameWins?.grand_fantasy ?? 0)}
                  </span>
                  <span className="game-win-label">{t('playerStats.grandFantasy')}</span>
                </div>
              </div>
              <div className="game-win-item">
                <div className="game-win-icon magic-bot">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="14" rx="2" />
                    <circle cx="9" cy="10" r="1.5" />
                    <circle cx="15" cy="10" r="1.5" />
                    <path d="M9 14h6" />
                  </svg>
                </div>
                <div className="game-win-info">
                  <span className="game-win-count">
                    {isLoading ? <span className="skeleton" style={{ width: '24px', height: '18px' }} /> : (gameData?.gameWins?.magic_bot ?? 0)}
                  </span>
                  <span className="game-win-label">{t('playerStats.magicBot')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="stats-divider" />

          {/* PvP Record */}
          <div className="stats-pvp">
            <div className="stats-subtitle">{t('playerStats.pvp')}</div>
            {isLoading ? (
              <div className="skeleton" style={{ width: '200px', height: '24px' }} />
            ) : pvpTotal === 0 ? (
              <div className="pvp-empty">{t('playerStats.noBattles')}</div>
            ) : (
              <div className="pvp-row">
                <div className="pvp-stat">
                  <span className="pvp-value pvp-wins">{gameData?.pvp.wins ?? 0}</span>
                  <span className="pvp-label">{t('playerStats.pvpWins')}</span>
                </div>
                <span className="pvp-separator">/</span>
                <div className="pvp-stat">
                  <span className="pvp-value pvp-losses">{gameData?.pvp.losses ?? 0}</span>
                  <span className="pvp-label">{t('playerStats.pvpLosses')}</span>
                </div>
                <div className="pvp-winrate">
                  <span className="pvp-winrate-value">{winRate}%</span>
                  <span className="pvp-label">{t('playerStats.winRate')}</span>
                  <div className="pvp-winrate-bar">
                    <div className="pvp-winrate-fill" style={{ width: `${winRate}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Account Details Card */}
        <div className="profile-card profile-details-card">
          <h2 className="profile-section-title">{t('accountDetails')}</h2>

          <div className="profile-details">
            <div
              className={`profile-detail-row ${user.discordId ? 'profile-detail-copyable' : ''}`}
              onClick={copyDiscordId}
              title={user.discordId ? t('clickToCopy') : undefined}
            >
              <div className="profile-detail-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </div>
              <span className="profile-detail-label">{t('discordId')}</span>
              <span className="profile-detail-value">
                {user.discordId || '—'}
                {user.discordId && (
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
              <span className="profile-detail-value">{user.email || '—'}</span>
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

        {/* Sign Out Card */}
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

      </div>

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

      {/* Lightbox */}
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
          {moonStones.map((stone) => (
            <div
              key={stone.name}
              className={`stone-card ${stone.owned ? 'stone-card-owned' : 'stone-card-locked'}`}
              onClick={() => {
                if (stone.owned && stone.data?.imageUrl) {
                  onStoneClick(stone.data.imageUrl, stone.name);
                }
              }}
            >
              <div className="stone-image-wrap">
                {stone.owned && stone.data?.imageUrl ? (
                  <img src={stone.data.imageUrl} alt={stone.name} />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}
              </div>
              <span className="stone-name">{stone.name}</span>
            </div>
          ))}
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
          {forbiddenStones.map((stone) => (
            <div
              key={stone.name}
              className={`stone-card stone-card-forbidden ${stone.owned ? 'stone-card-owned' : 'stone-card-locked'}`}
              onClick={() => {
                if (stone.owned && stone.data?.imageUrl) {
                  onStoneClick(stone.data.imageUrl, stone.name);
                }
              }}
            >
              <div className="stone-image-wrap stone-image-forbidden">
                {stone.owned && stone.data?.imageUrl ? (
                  <img src={stone.data.imageUrl} alt={stone.name} />
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
          ))}
        </div>
      </div>
    </div>
  );
}
