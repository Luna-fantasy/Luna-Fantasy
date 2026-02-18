'use client';

import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState } from 'react';
import { useGameData } from '@/hooks/useGameData';
import type { UserCard, UserStone, CardsByGame } from '@/types/gameData';
import '@/styles/profile.css';
import '@/styles/profile-game.css';

const RARITY_ORDER = ['common', 'rare', 'epic', 'unique', 'legendary', 'secret', 'forbidden', 'mythical'] as const;

type GameKey = keyof CardsByGame;

const GAME_TABS: { key: GameKey; labelKey: string }[] = [
  { key: 'lunaFantasy', labelKey: 'collection.lunaFantasy' },
  { key: 'grandFantasy', labelKey: 'collection.grandFantasy' },
  { key: 'bumper', labelKey: 'collection.bumper' },
];

function getRarityClass(rarity: string): string {
  return `rarity-${rarity.toLowerCase()}`;
}

function getRarityDistribution(cards: UserCard[]) {
  const counts: Record<string, number> = {};
  for (const card of cards) {
    const r = card.rarity.toLowerCase();
    counts[r] = (counts[r] || 0) + 1;
  }
  return counts;
}

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

  // Active tab cards
  const activeCards = gameData?.cardsByGame[activeGame] ?? [];
  const rarityDist = getRarityDistribution(activeCards);
  const totalActiveCards = activeCards.length;

  // Available tabs (only those with cards, default to all if loading)
  const availableTabs = isLoading
    ? GAME_TABS
    : GAME_TABS.filter(tab => (gameData?.cardsByGame[tab.key]?.length ?? 0) > 0);

  // Pick first available tab if current has no cards
  const effectiveGame = availableTabs.find(tab => tab.key === activeGame)
    ? activeGame
    : (availableTabs[0]?.key ?? 'lunaFantasy');

  const effectiveCards = gameData?.cardsByGame[effectiveGame] ?? [];
  const effectiveDist = getRarityDistribution(effectiveCards);

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

          {/* Stats Row */}
          <div className="profile-stats-row">
            <div className="profile-stat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
                <rect x="2" y="3" width="20" height="18" rx="2" />
                <path d="M8 7h8M8 12h8M8 17h4" />
              </svg>
              <div className="profile-stat-text">
                <span className="profile-stat-value">
                  {isLoading ? <span className="skeleton skeleton-stat" /> : formatNumber(gameData?.totalCards ?? 0)}
                </span>
                <span className="profile-stat-label">{t('stats.cards')}</span>
              </div>
            </div>
            <div className="profile-stat-divider" />
            <div className="profile-stat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
              </svg>
              <div className="profile-stat-text">
                <span className="profile-stat-value">
                  {isLoading ? <span className="skeleton skeleton-stat" /> : (gameData?.stones.length ?? 0)}
                </span>
                <span className="profile-stat-label">{t('stats.stones')}</span>
              </div>
            </div>
            <div className="profile-stat-divider" />
            <div className="profile-stat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-legendary)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <div className="profile-stat-text">
                <span className="profile-stat-value">
                  {isLoading ? <span className="skeleton skeleton-stat" /> : formatNumber(gameData?.lunari ?? 0)}
                </span>
                <span className="profile-stat-label">{t('stats.lunari')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card Collection Section */}
        <div className="profile-card profile-collection-card">
          <h2 className="profile-section-title">{t('collection.title')}</h2>

          {/* Game Tabs */}
          <div className="game-tabs">
            {(isLoading ? GAME_TABS : availableTabs).map(tab => (
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

          {/* Card Scroll */}
          {isLoading ? (
            <div className="card-scroll-strip">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="mini-card">
                  <div className="mini-card-image-wrap">
                    <div className="skeleton" style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div className="skeleton" style={{ width: '80px', height: '14px', marginTop: 4 }} />
                </div>
              ))}
            </div>
          ) : effectiveCards.length === 0 ? (
            <div className="collection-empty">
              <div className="collection-empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="18" rx="2" />
                  <path d="M8 7h8M8 12h8M8 17h4" />
                </svg>
              </div>
              <p>{t('collection.empty')}</p>
            </div>
          ) : (
            <>
              <div className="card-scroll-strip">
                {effectiveCards.map((card, idx) => {
                  const rKey = card.rarity.toLowerCase();
                  const cardId = `${card.id || idx}`;
                  const isBroken = brokenImages.has(cardId);
                  return (
                    <div
                      key={cardId}
                      className="mini-card"
                      onClick={() => {
                        if (!isBroken && card.imageUrl) {
                          setLightbox({ src: card.imageUrl, caption: card.name });
                        }
                      }}
                    >
                      <div className={`mini-card-image-wrap rarity-border-${rKey}`}>
                        {isBroken || !card.imageUrl ? (
                          <div className={`mini-card-placeholder rarity-bg-${rKey}`}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="2" y="3" width="20" height="18" rx="2" />
                              <path d="M8 7h8M8 12h8M8 17h4" />
                            </svg>
                          </div>
                        ) : (
                          <img
                            src={card.imageUrl}
                            alt={card.name}
                            onError={() => handleImageError(cardId)}
                          />
                        )}
                        <span className={`mini-card-rarity ${getRarityClass(card.rarity)}`}>
                          {card.rarity}
                        </span>
                      </div>
                      <div className="mini-card-name">{card.name}</div>
                      <div className="mini-card-attack">ATK {card.attack}</div>
                    </div>
                  );
                })}
              </div>

              {/* Rarity Distribution Bar */}
              <div className="rarity-bar">
                {RARITY_ORDER.map(r => {
                  const count = effectiveDist[r] || 0;
                  if (count === 0) return null;
                  const pct = (count / effectiveCards.length) * 100;
                  return (
                    <div
                      key={r}
                      className={`rarity-bar-segment bar-${r}`}
                      style={{ width: `${pct}%` }}
                    />
                  );
                })}
              </div>

              {/* Rarity Legend */}
              <div className="rarity-legend">
                {RARITY_ORDER.map(r => {
                  const count = effectiveDist[r] || 0;
                  if (count === 0) return null;
                  return (
                    <div key={r} className="rarity-legend-item">
                      <span className={`rarity-legend-dot dot-${r}`} />
                      {count} {t(`rarity.${r}`)}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Treasury Section */}
        <div className="profile-card profile-treasury-card">
          <h2 className="profile-section-title">{t('treasury.title')}</h2>
          <div className="treasury-grid">
            {/* Lunari */}
            <div className="treasury-lunari">
              <div className="treasury-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                {t('treasury.lunari')}
              </div>
              <div className="treasury-lunari-value">
                {isLoading ? <span className="skeleton" style={{ width: '80px', height: '28px' }} /> : formatNumber(gameData?.lunari ?? 0)}
              </div>
            </div>

            {/* Stones */}
            <div className="treasury-stones">
              <div className="treasury-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
                </svg>
                {t('treasury.stones')}
              </div>
              {isLoading ? (
                <div className="stones-grid">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                  ))}
                </div>
              ) : (gameData?.stones.length ?? 0) === 0 ? (
                <div className="treasury-empty">{t('treasury.noStones')}</div>
              ) : (
                <div className="stones-grid">
                  {gameData!.stones.map((stone, idx) => (
                    <img
                      key={stone.id || idx}
                      src={stone.imageUrl}
                      alt={stone.name}
                      className="stone-thumb"
                      title={stone.name}
                      onClick={() => setLightbox({ src: stone.imageUrl, caption: stone.name })}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

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
