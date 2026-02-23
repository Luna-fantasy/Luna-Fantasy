'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Image from 'next/image';
import { Lightbox } from '@/components';
import type { Card, CardRarity, Locale } from '@/types';

interface GrandFantasyContentProps {
  cards: Card[];
  locale: Locale;
}

type FilterKey = 'all' | CardRarity;

export function GrandFantasyContent({ cards, locale }: GrandFantasyContentProps) {
  const t = useTranslations('grandFantasyPage');
  const hero = useTranslations('hero');

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const filteredCards = activeFilter === 'all'
    ? cards
    : cards.filter(card => card.rarity === activeFilter);

  // Group cards by rarity — only rarities present in the data
  const cardsByRarity: Partial<Record<CardRarity, Card[]>> = {};
  for (const card of cards) {
    if (!cardsByRarity[card.rarity]) cardsByRarity[card.rarity] = [];
    cardsByRarity[card.rarity]!.push(card);
  }

  // Build filters and rarity order from what actually exists
  const allRarities: CardRarity[] = ['common', 'rare', 'epic', 'unique', 'legendary', 'secret', 'mythical'];
  const rarityOrder = allRarities.filter(r => cardsByRarity[r] && cardsByRarity[r]!.length > 0);

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('filters.all') },
    ...rarityOrder.map(r => ({ key: r as FilterKey, label: t(`filters.${r}`) })),
  ];

  return (
    <>
      {/* Hero */}
      <section className="cards-hero">
        <div className="cards-hero-bg">
          <Image
            src="/images/luna-fantasy.png"
            alt="Grand Fantasy Card Game"
            fill
            priority
            className="cards-hero-bg-image"
          />
        </div>
        <div className="cards-hero-content">
          <span className="hero-badge">{t('heroSubtitle')}</span>
          <h1 className="cards-hero-title">{t('heroTitle')}</h1>
          <p className="cards-hero-desc">{t('subtitle')}</p>
          <div className="cards-hero-cta">
            <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer" className="cta-discord">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/>
              </svg>
              <span>{hero('joinBtn')}</span>
            </a>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="cards-info-section">
        <div className="wrap">
          <div className="cards-info-grid">
            <div className="cards-info-card">
              <h3>{t('whatTitle')}</h3>
              <p>{t('whatDesc')}</p>
            </div>
            <div className="cards-info-card">
              <h3>{t('howTitle')}</h3>
              <p>{t('howDesc')}</p>
            </div>
          </div>

          <div className="rules-section">
            <ul className="rules-list">
              <li>{t('rules.rule1')}</li>
              <li>{t('rules.rule2')}</li>
              <li>{t('rules.rule3')}</li>
              <li>{t('rules.rule4')}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Cards Gallery */}
      <section className="cards-gallery-section">
        <div className="wrap">
          <div className="filter-bar">
            {filters.map(filter => (
              <button
                key={filter.key}
                className={`filter-btn filter-btn-${filter.key} ${activeFilter === filter.key ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
                {filter.key !== 'all' && (
                  <span className="filter-count">
                    {cardsByRarity[filter.key as CardRarity]?.length || 0}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeFilter === 'all' ? (
            <div className="cards-by-rarity">
              {rarityOrder.map(rarity => {
                const rarityCards = cardsByRarity[rarity];
                if (!rarityCards || rarityCards.length === 0) return null;
                return (
                  <div key={rarity} className="rarity-section">
                    <div className="rarity-header">
                      <h2 className={`rarity-title rarity-${rarity}`}>
                        {t(`filters.${rarity}`)}
                      </h2>
                      <span className={`rarity-count rarity-${rarity}`}>
                        {rarityCards.length}
                      </span>
                    </div>
                    <div className="cards-grid">
                      {rarityCards.map(card => (
                        <div
                          key={card.id}
                          className={`card-item card-${card.rarity}`}
                          onClick={() => setLightboxImage(card.imageUrl)}
                        >
                          <div className="card-image-wrapper">
                            <Image
                              src={card.imageUrl}
                              alt={card.name[locale]}
                              width={300}
                              height={420}
                              className="card-image"
                            />
                          </div>
                          <div className="card-info">
                            <span className={`card-rarity rarity-${card.rarity}`}>
                              {t(`filters.${card.rarity}`)}
                            </span>
                            <h4 className="card-name">{card.name[locale]}</h4>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="cards-grid">
              {filteredCards.map(card => (
                <div
                  key={card.id}
                  className={`card-item card-${card.rarity}`}
                  onClick={() => setLightboxImage(card.imageUrl)}
                >
                  <div className="card-image-wrapper">
                    <Image
                      src={card.imageUrl}
                      alt={card.name[locale]}
                      width={300}
                      height={420}
                      className="card-image"
                    />
                  </div>
                  <div className="card-info">
                    <span className={`card-rarity rarity-${card.rarity}`}>
                      {t(`filters.${card.rarity}`)}
                    </span>
                    <h4 className="card-name">{card.name[locale]}</h4>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Lightbox
        isOpen={!!lightboxImage}
        imageSrc={lightboxImage || ''}
        alt="Card Preview"
        onClose={() => setLightboxImage(null)}
      />
    </>
  );
}
