'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Lightbox } from '@/components';
import { ArchiveCardCarousel } from '@/components/archive-card-carousel/ArchiveCardCarousel';
import { ArchiveCardThumbnail } from '@/components/archive-card-carousel/ArchiveCardThumbnail';
import { ArchiveCardSearch } from '@/components/cinematic-games/ArchiveCardSearch';
import { archiveCardMatcher } from '@/lib/cinematic/archive-card-search';
import { visualFixSrc } from '@/lib/cinematic/v19-visual-fix-src';
import { inspectorArtworkViewerSrc } from '@/lib/cinematic/native-art-inspector';
import LunariIcon from '@/components/LunariIcon';
import { E } from '@/components/edit-mode/EditableText';
import { EImg } from '@/components/edit-mode/EditableImage';
import { useEditMode } from '@/lib/edit-mode/context';
import { projectFactionCardArtwork, type ReleaseCardArt } from '@/lib/release-card-art';
import { FactionCouncilScene } from '@/components/cinematic-games/CinematicGames';
import gameStyles from '@/components/cinematic-games/cinematic-games.module.css';
import type { FactionWarCard, FactionWarFaction } from '@/types/faction-war';
import type { Locale } from '@/types';

const unavailableCardImage = '/images/logo.png';

function printedSpelling(art: ReleaseCardArt | undefined, locale: Locale) {
  if (!art?.printedAs) return;
  if (art.releaseId === 'LUNA-0548') {
    return locale === 'ar'
      ? `ترد تهجئة ${art.printedAs} على البطاقة وفي سجل الشخصية.`
      : `The print and the character portrait use the spelling ${art.printedAs}.`;
  }
  return locale === 'ar' ? `ترد تهجئة ${art.printedAs} على البطاقة.` : `The card is printed as ${art.printedAs}.`;
}

function cardDescription(card: FactionWarCard, art: ReleaseCardArt | undefined, locale: Locale) {
  const spelling = printedSpelling(art, locale);
  return spelling ? [spelling, card.description].filter(Boolean).join(' ') : card.description;
}

// Build-time fallback bust. Bumped on every deploy so cards stored without
// their own `?v=` stamp still refresh whenever the site redeploys. The admin
// API now always saves cards with a `?v=` token, but legacy DB entries from
// before that change have no version of their own — this is the safety net.
const FALLBACK_BUST =
  process.env.NEXT_PUBLIC_BUILD_ID
  ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
  ?? process.env.NEXT_PUBLIC_RAILWAY_DEPLOYMENT_ID
  ?? '1';

function getFactionWarBgUrl() {
  // Append the deploy bust as a `?v=` token so a re-uploaded PNG actually
  // refetches in browsers. The asset is served with a 1-year `immutable`
  // Cache-Control header (intentional · keeps repeat-visit costs down)
  // so without a query change the browser would never re-request.
  return `https://assets.lunarian.app/backgrounds/FactionWarHero.png?v=${FALLBACK_BUST}`;
}

interface FactionWarContentProps {
  factions: FactionWarFaction[];
  locale: Locale;
  cinematicPresentation: boolean;
}

type FilterKey = 'all' | string;

export function FactionWarContent({ factions, locale, cinematicPresentation }: FactionWarContentProps) {
  const t = useTranslations('factionWarPage');
  const hero = useTranslations('hero');
  const { editMode } = useEditMode();
  const cinematic = cinematicPresentation && !editMode;

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [archiveQuery, setArchiveQuery] = useState('');
  const [indexOpen, setIndexOpen] = useState(false);
  const [failedOverlayThumbs, setFailedOverlayThumbs] = useState<ReadonlySet<string>>(new Set());
  const [lightboxCard, setLightboxCard] = useState<{ src: string; native?: string; fix?: string; id: string; name: string; description?: string; opener: HTMLElement } | null>(null);

  const matchesQuery = archiveCardMatcher('faction-war', locale, editMode ? '' : archiveQuery);
  const releaseArt = new Map(factions.flatMap(faction => faction.cards.map(card =>
    [card, projectFactionCardArtwork(faction.id, card, true)] as const,
  )));
  const filteredFactions = factions
    .filter(faction => activeFilter === 'all' || faction.id === activeFilter)
    .map(faction => ({
      faction,
      visibleCards:faction.cards.filter(card => {
        const artwork = releaseArt.get(card);
        return matchesQuery(artwork?.releaseId, artwork?.title ?? card.name, card.name, artwork?.printedAs);
      }),
    }))
    .filter(({ visibleCards }) => editMode || visibleCards.length > 0);
  const resultCount = filteredFactions.reduce((count, { visibleCards }) => count + visibleCards.length, 0);

  const archiveCards = new Map<string, FactionWarCard>();
  const idsByCard = new Map<FactionWarCard, string>();
  const archiveEntries = filteredFactions.flatMap(({ faction, visibleCards }) => visibleCards.flatMap(card => {
    const art = releaseArt.get(card);
    const id = art?.releaseId ?? faction.id + '/' + card.image;
    if (archiveCards.has(id)) return [];
    archiveCards.set(id, card);
    idsByCard.set(card, id);
    const fallback = unavailableCardImage;
    return [{
      id, name: art?.title ?? card.name, group: faction.name[locale],
      detail: art?.detail ?? fallback, releaseId: art?.releaseId,
      visualFix: visualFixSrc(art?.releaseId, 'card-inspector'), description: cardDescription(card, art, locale),
      thumb: visualFixSrc(art?.releaseId, 'card-thumb') ?? art?.thumb ?? fallback,
    }];
  }));
  const showCarousel = cinematic && archiveEntries.length > 0;
  const indexId = 'faction-archive-index';

  function openCardArtwork(card: FactionWarCard, opener: HTMLElement) {
    const artwork = releaseArt.get(card);
    const id = idsByCard.get(card);
    if (!id) return;
    setLightboxCard({
      id,
      src: artwork?.detail ?? unavailableCardImage,
      native: inspectorArtworkViewerSrc(artwork?.releaseId),
      fix: visualFixSrc(artwork?.releaseId, 'card-inspector'),
      name: artwork?.title ?? card.name, description: cardDescription(card, artwork, locale), opener,
    });
  }

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

  const gallery = useRef<HTMLElement>(null);
  const [councilTarget, setCouncilTarget] = useState<string>();
  function openFactionFromCouncil(factionId: string) {
    setArchiveQuery('');
    setActiveFilter(factionId);
    setIndexOpen(true);
    setCouncilTarget(factionId);
  }
  useEffect(() => {
    if (!councilTarget || !gallery.current) return;
    const heading = gallery.current.querySelector<HTMLElement>('h2[data-catalog-faction="' + CSS.escape(councilTarget) + '"]');
    if (heading) {
      heading.focus({ preventScroll:true });
      heading.scrollIntoView({ block:'start', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
    setCouncilTarget(undefined);
  }, [councilTarget]);
  const heroCopy = (
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
  );

  return (
    <main>
      {/* Hero */}
      {cinematic ? <FactionCouncilScene factions={factions} locale={locale} onOpenFaction={openFactionFromCouncil}>{heroCopy}</FactionCouncilScene> : (
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
        {heroCopy}
      </section>
      )}

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
      <section className={`lp-gallery-section${cinematic ? ` ${gameStyles.cinematicCatalog}` : ""}`} ref={gallery} data-cinematic-catalog={cinematic || undefined}>
        <div className="wrap">
          {!editMode && <ArchiveCardSearch locale={locale} query={archiveQuery} count={resultCount} onQuery={setArchiveQuery} />}
          {/* Filter Bar */}
          <div className="lp-filter-bar">
            {filters.map(filter => (
              <button
                key={filter.key}
                type="button"
                className={`lp-filter-btn ${activeFilter === filter.key ? 'active' : ''}`}
                aria-pressed={activeFilter === filter.key}
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

          {showCarousel && <ArchiveCardCarousel variant="faction" locale={locale} entries={archiveEntries}
            onInspect={(entry, opener) => {
              const card = archiveCards.get(entry.id);
              if (card) openCardArtwork(card, opener);
            }}
            index={{ open: indexOpen, controls: indexId, onToggle: () => setIndexOpen(open => !open) }}
          />}
          <div id={indexId} hidden={showCarousel && !indexOpen}>
          {(editMode || resultCount > 0) && <div className="lp-factions-list">
            {filteredFactions.map(({ faction, visibleCards }) => (
              <div key={faction.id} className="lp-faction-section">
                <div className="lp-faction-header">
                  <h2
                    className="lp-faction-title"
                    data-catalog-faction={faction.id}
                    tabIndex={-1}
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
                  {visibleCards.map(card => {
                    const imageUrl = unavailableCardImage;
                    const artwork = releaseArt.get(card);
                    const displayName = artwork?.title ?? card.name;
                    const approvedThumb = visualFixSrc(artwork?.releaseId, 'card-thumb');
                    const overlayThumb = approvedThumb && !failedOverlayThumbs.has(approvedThumb) ? approvedThumb : undefined;
                    return (
                      <button
                        type="button" aria-haspopup="dialog" aria-label={displayName}
                        aria-description={printedSpelling(artwork, locale)}
                        key={card.image}
                        className="lp-card-item"
                        data-release-card={artwork?.releaseId}
                        onClick={event => openCardArtwork(card, event.currentTarget)}
                        style={{ '--faction-color': faction.color } as React.CSSProperties}
                      >
                        <span className="lp-card-image-wrapper">
                          <ArchiveCardThumbnail
                            src={overlayThumb || (artwork?.thumb ?? imageUrl)}
                            highDensitySrc={overlayThumb ? undefined : artwork?.detail}
                            onError={overlayThumb ? () => setFailedOverlayThumbs(previous => new Set(previous).add(overlayThumb)) : undefined}
                            alt={displayName}
                            className="lp-card-image"
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>}
          </div>
        </div>
      </section>

      {/* Lightbox — now includes card name + description (admin-editable) */}
      <Lightbox
        isOpen={!!lightboxCard}
        inspection={lightboxCard ? { kind: 'faction', id: lightboxCard.id } : undefined}
        archiveEntries={archiveEntries}
        imageSrc={lightboxCard?.src || ''}
        preferredImageSrc={lightboxCard?.native}
        visualFixImageSrc={lightboxCard?.fix}
        locale={locale}
        openerElement={lightboxCard?.opener}
        alt={lightboxCard?.name || (locale === 'ar' ? 'معاينة الكرت' : 'Card Preview')}
        title={lightboxCard?.name}
        description={lightboxCard?.description}
        onClose={() => setLightboxCard(null)}
      />
    </main>
  );
}
