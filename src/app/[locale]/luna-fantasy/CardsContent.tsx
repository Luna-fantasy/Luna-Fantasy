'use client';

import { ArchiveName } from '@/components/ArchiveName';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Lightbox } from '@/components';
import { ArchiveCardCarousel } from '@/components/archive-card-carousel/ArchiveCardCarousel';
import { ArchiveCardThumbnail } from '@/components/archive-card-carousel/ArchiveCardThumbnail';
import { projectLunaSecretCodex } from '@/lib/cinematic/luna-secret-codex';
import { ArchiveCardSearch } from '@/components/cinematic-games/ArchiveCardSearch';
import { archiveCardMatcher } from '@/lib/cinematic/archive-card-search';
import { inspectorArtworkViewerSrc } from '@/lib/cinematic/native-art-inspector';
import { E } from '@/components/edit-mode/EditableText';
import { EImg } from '@/components/edit-mode/EditableImage';
import { useEditMode } from '@/lib/edit-mode/context';
import { projectLunaCardArtwork } from '@/lib/release-card-art';
import { LunaDealerScene } from '@/components/cinematic-games/CinematicGames';
import gameStyles from '@/components/cinematic-games/cinematic-games.module.css';
import type { Card, CardRarity, Locale } from '@/types';

interface CardsContentProps {
  cards: Card[];
  locale: Locale;
  cinematicPresentation: boolean;
}

type FilterKey = 'all' | CardRarity;
const allRarities: CardRarity[] = ['common', 'rare', 'epic', 'unique', 'legendary', 'secret', 'mythical'];

export function CardsContent({ cards, locale, cinematicPresentation }: CardsContentProps) {
  const t = useTranslations('cardsPage');
  const showcase = useTranslations('showcase');
  const hero = useTranslations('hero');
  const { editMode } = useEditMode();
  const cinematic = cinematicPresentation && !editMode;

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [archiveQuery, setArchiveQuery] = useState('');
  const [indexOpen, setIndexOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ fallback: string; native?: string; id: string; name: string; opener?: HTMLElement } | null>(null);
  // The catalog and labels remain live; only explicitly mapped cards gain local presentation art.
  const releaseArt = new Map(cards.map(card => [card, projectLunaCardArtwork(card, cinematic)]));

  function openCardArtwork(card: Card, opener?: HTMLElement) {
    const art = releaseArt.get(card);
    setLightboxImage({ id: art?.releaseId ?? card.id, fallback: art?.detail ?? card.imageUrl, native: inspectorArtworkViewerSrc(art?.releaseId), name: card.name[locale], opener });
  }

  const matchesQuery = archiveCardMatcher('luna-fantasy', locale, editMode ? '' : archiveQuery);
  const matchesSearch = (card: Card) => matchesQuery(releaseArt.get(card)?.releaseId, card.name[locale], card.name.en);
  // Shared list of visible records; keeps the original card objects and role pins.
  const filteredCards = cards.filter(card => (activeFilter === 'all' || card.rarity === activeFilter) && matchesSearch(card))
    .sort((a, b) => allRarities.indexOf(a.rarity) - allRarities.indexOf(b.rarity));
  const archiveByReleaseId = new Map<string, Card>();
  const archiveEntries = filteredCards.flatMap(card => {
    const art = releaseArt.get(card);
    const id = art?.releaseId ?? card.id;
    if (archiveByReleaseId.has(id)) return [];
    archiveByReleaseId.set(id, card);
    return [{ id, name: card.name[locale], group: t(`filters.${card.rarity}`),
      detail: art?.detail ?? card.imageUrl, thumb: art?.thumb ?? card.imageUrl, releaseId: art?.releaseId }];
  });
  const showCarousel = cinematic && archiveEntries.length > 0;
  const indexId = "luna-archive-index";


  // Group cards by rarity — only rarities present in the data
  const cardsByRarity: Partial<Record<CardRarity, Card[]>> = {};
  for (const card of cards) {
    if (!cardsByRarity[card.rarity]) cardsByRarity[card.rarity] = [];
    cardsByRarity[card.rarity]!.push(card);
  }

  // Build filters and rarity order from what actually exists
  const rarityOrder = allRarities.filter(r => cardsByRarity[r] && cardsByRarity[r]!.length > 0);

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('filters.all') },
    ...rarityOrder.map(r => ({ key: r as FilterKey, label: t(`filters.${r}`) })),
  ];

  const heroCopy = (
        <div className="cards-hero-content">
          <span className="hero-badge"><E ns="cardsPage" k="heroSubtitle">{t('heroSubtitle')}</E></span>
          <h1 className="cards-hero-title"><E ns="cardsPage" k="heroTitle">{t('heroTitle')}</E></h1>
          <p className="cards-hero-desc"><E ns="cardsPage" k="subtitle">{t('subtitle')}</E></p>
          <div className="cards-hero-cta">
            <a href="https://discord.gg/lunarian" target="_blank" rel="noopener noreferrer" className="cta-discord">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/>
              </svg>
              <span><E ns="hero" k="joinBtn">{hero('joinBtn')}</E></span>
            </a>
          </div>
        </div>
  );

  return (
    <main>
      {/* Cards Hero */}
      {cinematic ? <LunaDealerScene>{heroCopy}</LunaDealerScene> : (
      <section className="cards-hero">
        <div className="cards-hero-bg">
          <EImg
            editId="luna-fantasy-hero-bg"
            source="r2"
            src={`https://assets.lunarian.app/backgrounds/LunaFantasyHero.png?v=${process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_RAILWAY_DEPLOYMENT_ID ?? '1'}`}
            alt="Luna Fantasy Card Game"
            fill
            priority
            className="cards-hero-bg-image"
          />
        </div>
        {heroCopy}
      </section>
      )}

      {/* What Are Luna Cards */}
      <section className="cards-info-section">
        <div className="wrap">
          <div className="cards-info-grid">
            <div className="cards-info-card">
              <h3><E ns="cardsPage" k="whatTitle">{t('whatTitle')}</E></h3>
              <p><E ns="cardsPage" k="whatDesc">{t('whatDesc')}</E></p>
            </div>
            <div className="cards-info-card">
              <h3><E ns="cardsPage" k="howTitle">{t('howTitle')}</E></h3>
              <p><E ns="cardsPage" k="howDesc">{t('howDesc')}</E></p>
            </div>
          </div>

          <div className="rules-section">
            <ul className="rules-list">
              <li><E ns="cardsPage" k="rules.rule1">{t('rules.rule1')}</E></li>
              <li><E ns="cardsPage" k="rules.rule2">{t('rules.rule2')}</E></li>
              <li><E ns="cardsPage" k="rules.rule3">{t('rules.rule3')}</E></li>
              <li><E ns="cardsPage" k="rules.rule4">{t('rules.rule4')}</E></li>
            </ul>
          </div>
        </div>
      </section>

      {/* Cards Gallery */}
      <section className={`cards-gallery-section${cinematic ? ` ${gameStyles.cinematicCatalog}` : ""}`} data-cinematic-catalog={cinematic || undefined}>
        <div className="wrap">
          {!editMode && <ArchiveCardSearch locale={locale} query={archiveQuery} count={filteredCards.length} onQuery={setArchiveQuery} />}
          {/* Filters */}
          <div className="filter-bar">
            {filters.map(filter => (
              <button
                key={filter.key}
                type="button"
                aria-pressed={activeFilter === filter.key}
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

          {showCarousel && <ArchiveCardCarousel variant="luna" locale={locale} entries={archiveEntries}
            onInspect={(entry, trigger) => {
              const card = archiveByReleaseId.get(entry.id);
              if (card) openCardArtwork(card, trigger);
            }}
            index={{ open:indexOpen, controls:indexId, onToggle:() => setIndexOpen(open => !open) }}
          />}
          {/* Cards Display */}
          <div id={indexId} hidden={showCarousel && !indexOpen}>
          {filteredCards.length === 0 ? null : activeFilter === 'all' ? (
            // Grouped by rarity
            <div className="cards-by-rarity">
              {rarityOrder.map(rarity => {
                const rarityCards = filteredCards.filter(card => card.rarity === rarity);
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
                          data-release-card={releaseArt.get(card)?.releaseId}
                          role="button" tabIndex={0} aria-haspopup="dialog" aria-label={card.name[locale]}
                          onClick={event => openCardArtwork(card, event.currentTarget)}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openCardArtwork(card, event.currentTarget);
                            }
                          }}
                        >
                          <div className="card-image-wrapper">
                            <ArchiveCardThumbnail
                              src={releaseArt.get(card)?.thumb ?? card.imageUrl}
                              highDensitySrc={releaseArt.get(card)?.detail}
                              alt={card.name[locale]}
                              className="card-image"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Single rarity grid
            <div className="cards-grid">
              {filteredCards.map(card => (
                <div
                  key={card.id}
                  className={`card-item card-${card.rarity}`}
                  data-release-card={releaseArt.get(card)?.releaseId}
                  role="button" tabIndex={0} aria-haspopup="dialog" aria-label={card.name[locale]}
                  onClick={event => openCardArtwork(card, event.currentTarget)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openCardArtwork(card, event.currentTarget);
                    }
                  }}
                >
                  <div className="card-image-wrapper">
                    <ArchiveCardThumbnail
                      src={releaseArt.get(card)?.thumb ?? card.imageUrl}
                      highDensitySrc={releaseArt.get(card)?.detail}
                      alt={card.name[locale]}
                      className="card-image"
                    />
                  </div>
                  <div className="card-info">
                    <span className={`card-rarity rarity-${card.rarity}`}>
                      {t(`filters.${card.rarity}`)}
                    </span>
                    <h4 className="card-name"><ArchiveName>{card.name[locale]}</ArchiveName></h4>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </section>

      {/* Lightbox */}
      <Lightbox
        isOpen={!!lightboxImage}
        inspection={lightboxImage ? { kind: 'luna', id: lightboxImage.id } : undefined}
        archiveEntries={archiveEntries}
        readSecret={id => {
          const card = archiveByReleaseId.get(id);
          return card ? projectLunaSecretCodex(card, locale, cinematic) : undefined;
        }}
        imageSrc={lightboxImage?.fallback || ''}
        preferredImageSrc={lightboxImage?.native}
        openerElement={lightboxImage?.opener}
        locale={locale}
        alt={lightboxImage?.name || (locale === 'ar' ? 'معاينة الكرت' : 'Card Preview')}
        onClose={() => setLightboxImage(null)}
      />
    </main>
  );
}
