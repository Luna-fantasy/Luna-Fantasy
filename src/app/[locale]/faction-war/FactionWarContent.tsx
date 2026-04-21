'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Image from 'next/image';
import { Lightbox } from '@/components';
import LunariIcon from '@/components/LunariIcon';
import { E } from '@/components/edit-mode/EditableText';
import { EImg } from '@/components/edit-mode/EditableImage';
import type { FactionWarFaction } from '@/types/faction-war';
import type { Locale } from '@/types';

const R2_BASE = 'https://assets.lunarian.app/LunaPairs';
function getFactionWarImageUrl(image: string) {
  // Cards in MongoDB store either bare filenames (`lunarians_seluna.png`,
  // optionally with a `?v=...` cache-buster appended by the admin upload) or
  // a full URL pasted manually in the dashboard. Handle both.
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return `${R2_BASE}/${image}`;
}
function getFactionWarBgUrl() { return 'https://assets.lunarian.app/backgrounds/FactionWarHero.png'; }

interface FactionWarContentProps {
  factions: FactionWarFaction[];
  locale: Locale;
}

type FilterKey = 'all' | string;

export function FactionWarContent({ factions, locale }: FactionWarContentProps) {
  const t = useTranslations('factionWarPage');
  const hero = useTranslations('hero');

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [lightboxCard, setLightboxCard] = useState<{ src: string; name: string; description?: string } | null>(null);

  const filteredFactions = activeFilter === 'all'
    ? factions
    : factions.filter(f => f.id === activeFilter);

  const totalCards = factions.reduce((sum, f) => sum + f.cards.length, 0);

  const filters: { key: FilterKey; label: string; color?: string; count?: number }[] = [
    { key: 'all', label: t('filters.all'), count: totalCards },
    ...factions.map(f => ({
      key: f.id,
      label: t(`filters.${f.id}`),
      color: f.color,
      count: f.cards.length,
    })),
  ];

  return (
    <>
      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-hero-bg">
          <EImg
            editId="faction-war-hero-bg"
            source="r2"
            src={getFactionWarBgUrl()}
            alt="Faction War"
            fill
            priority
            className="lp-hero-bg-image"
          />
        </div>
        <div className="lp-hero-content">
          <span className="hero-badge"><E ns="factionWarPage" k="heroSubtitle">{t('heroSubtitle')}</E></span>
          <h1 className="lp-hero-title"><E ns="factionWarPage" k="heroTitle">{t('heroTitle')}</E></h1>
          <p className="lp-hero-desc"><E ns="factionWarPage" k="subtitle">{t('subtitle')}</E></p>
          <div className="lp-hero-cta">
            <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer" className="cta-discord">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/>
              </svg>
              <span><E ns="hero" k="joinBtn">{hero('joinBtn')}</E></span>
            </a>
          </div>
        </div>
      </section>

      {/* How to Play */}
      <section className="lp-info-section">
        <div className="wrap">
          <div className="lp-info-grid">
            <div className="lp-info-card">
              <h3><E ns="factionWarPage" k="whatTitle">{t('whatTitle')}</E></h3>
              <p><E ns="factionWarPage" k="whatDesc">{t('whatDesc')}</E></p>
            </div>
            <div className="lp-info-card">
              <h3><E ns="factionWarPage" k="howTitle">{t('howTitle')}</E></h3>
              <p><E ns="factionWarPage" k="howDesc">{t('howDesc')}</E></p>
            </div>
          </div>

          <div className="lp-rules-section">
            <ul className="lp-rules-list">
              <li><E ns="factionWarPage" k="rules.rule1">{t('rules.rule1')}</E></li>
              <li><E ns="factionWarPage" k="rules.rule2">{t('rules.rule2')}</E></li>
              <li><E ns="factionWarPage" k="rules.rule3">{t('rules.rule3')}</E></li>
              <li><E ns="factionWarPage" k="rules.rule4">{t('rules.rule4')}</E></li>
              <li><E ns="factionWarPage" k="rules.rule5">{t('rules.rule5')}</E></li>
            </ul>
          </div>

          {/* Rewards Table */}
          <div className="lp-rewards-section">
            <h3 className="lp-rewards-title"><E ns="factionWarPage" k="rewardsTitle">{t('rewardsTitle')}</E></h3>
            <div className="lp-rewards-table-wrap">
              <table className="lp-rewards-table">
                <thead>
                  <tr>
                    <th><E ns="factionWarPage" k="rewardsType">{t('rewardsType')}</E></th>
                    <th><E ns="factionWarPage" k="rewardsCondition">{t('rewardsCondition')}</E></th>
                    <th><E ns="factionWarPage" k="rewardsPvP">{t('rewardsPvP')}</E></th>
                    <th><E ns="factionWarPage" k="rewardsBot">{t('rewardsBot')}</E></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="lp-reward-base"><E ns="factionWarPage" k="rewardsBase">{t('rewardsBase')}</E></td>
                    <td>3 + 3 + 3</td>
                    <td>12,500<LunariIcon size={14} /></td>
                    <td>6,250<LunariIcon size={14} /></td>
                  </tr>
                  <tr>
                    <td className="lp-reward-bonus"><E ns="factionWarPage" k="rewardsBonus">{t('rewardsBonus')}</E></td>
                    <td>6 + 3</td>
                    <td>15,000<LunariIcon size={14} /></td>
                    <td>7,500<LunariIcon size={14} /></td>
                  </tr>
                  <tr>
                    <td className="lp-reward-double"><E ns="factionWarPage" k="rewardsDouble">{t('rewardsDouble')}</E></td>
                    <td>9 × <E ns="factionWarPage" k="rewardsSame">{t('rewardsSame')}</E></td>
                    <td>20,000<LunariIcon size={14} /></td>
                    <td>10,000<LunariIcon size={14} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Faction Gallery */}
      <section className="lp-gallery-section">
        <div className="wrap">
          {/* Filter Bar */}
          <div className="lp-filter-bar">
            {filters.map(filter => (
              <button
                key={filter.key}
                className={`lp-filter-btn ${activeFilter === filter.key ? 'active' : ''}`}
                style={
                  activeFilter === filter.key && filter.color
                    ? { background: filter.color, color: '#fff', boxShadow: `0 0 20px ${filter.color}60` }
                    : undefined
                }
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
                <span className="lp-filter-count">{filter.count}</span>
              </button>
            ))}
          </div>

          {/* Cards Display */}
          <div className="lp-factions-list">
            {filteredFactions.map(faction => (
              <div key={faction.id} className="lp-faction-section">
                <div className="lp-faction-header">
                  <h2
                    className="lp-faction-title"
                    style={{ color: faction.color }}
                  >
                    {faction.name[locale]}
                  </h2>
                  <span
                    className="lp-faction-count"
                    style={{
                      color: faction.color,
                      background: `${faction.color}20`,
                      borderColor: `${faction.color}40`,
                    }}
                  >
                    {faction.cards.length}
                  </span>
                </div>
                <div className="lp-cards-grid">
                  {faction.cards.map(card => {
                    const imageUrl = getFactionWarImageUrl(card.image);
                    return (
                      <div
                        key={card.image}
                        className="lp-card-item"
                        onClick={() => setLightboxCard({ src: imageUrl, name: card.name, description: card.description })}
                        style={{ '--faction-color': faction.color } as React.CSSProperties}
                      >
                        <div className="lp-card-image-wrapper">
                          <Image
                            src={imageUrl}
                            alt={card.name}
                            width={300}
                            height={420}
                            className="lp-card-image"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox — now includes card name + description (admin-editable) */}
      <Lightbox
        isOpen={!!lightboxCard}
        imageSrc={lightboxCard?.src || ''}
        alt={lightboxCard?.name || 'Card Preview'}
        title={lightboxCard?.name}
        description={lightboxCard?.description}
        onClose={() => setLightboxCard(null)}
      />
    </>
  );
}
